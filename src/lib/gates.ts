/**
 * Gates — cost & drift signals that feed the attention queue (M3.4).
 *
 * These are the two remaining intervention triggers from permissions.md §4 that
 * M3.1 built the mechanism for but left unwired (the same `requestApproval`
 * primitive the spawn and tool gates already use):
 *
 *   - SPEND_CEILING: a task would cross the mission's spending ceiling → the
 *     operation is paused and the operator is asked (E15).
 *   - DRIFT: the mission is off its cadence / stalled / burning cost with no
 *     progress → the mission is paused and enters the attention queue, without
 *     waiting for a hard failure (E16).
 *
 * Both are opt-in and fully configurable — the policy carries the values, so no
 * threshold is invented (Q1/Q2). A mission with no `spend`/`drift` policy is never
 * gated by this module.
 */

import { PrismaClient } from "@prisma/client";
import { eventBus } from "./events";
import { requestApproval } from "./approvals";
import { resolveSpendPolicy, spendDecision, SpendDecision } from "./spend-policy";
import { resolveDriftPolicy, detectDrift } from "./drift-policy";
import { parseMissionPlan } from "./plan";

/** Cost already booked against a run, and against the mission lifetime. */
async function costsFor(db: PrismaClient, missionId: string, operationId: string | null) {
  const missionAgg = await db.task.aggregate({
    where: { missionId },
    _sum: { cost: true },
  });
  const operationAgg = operationId
    ? await db.task.aggregate({ where: { parentOperationId: operationId }, _sum: { cost: true } })
    : { _sum: { cost: 0 as number } };
  return {
    missionSpent: missionAgg._sum.cost ?? 0,
    operationSpent: operationAgg._sum.cost ?? 0,
  };
}

/** The plan's estimated cost for the work a task represents (0 when unknown). */
function projectedForTask(planJson: string | null, taskDescription: string): number {
  try {
    const plan = parseMissionPlan(planJson);
    const step = plan.steps.find((s) => s.description === taskDescription);
    return step?.estimatedCost ?? 0;
  } catch {
    return 0;
  }
}

/**
 * Decide whether a task may run. When it would cross the mission's spending
 * ceiling, raise the `SPEND_CEILING` gate (operation scope) and hold. Returns
 * true when the work was gated.
 *
 * Idempotent: if a SPEND_CEILING gate is already PENDING for the operation, no
 * second gate is raised (the work stays paused either way).
 */
export async function checkSpendGate(
  db: PrismaClient,
  task: { id: string; missionId: string | null; parentOperationId: string | null; description: string },
): Promise<boolean> {
  if (!task.missionId) return false;

  const mission = await db.mission.findUnique({ where: { id: task.missionId } });
  if (!mission) return false;
  const policy = resolveSpendPolicy(mission.policy);
  if (!policy) return false;

  const { missionSpent, operationSpent } = await costsFor(db, mission.id, task.parentOperationId);
  const decision: SpendDecision = spendDecision({
    policy,
    operationSpent,
    missionSpent,
    projectedNext: projectedForTask(mission.plan, task.description),
  });

  if (decision.action === "allow") return false;

  if (decision.action === "warn") {
    await eventBus.emit({
      type: "spend.warning",
      source: "gates",
      subject: "mission",
      subjectId: mission.id,
      missionId: mission.id,
      taskId: task.id,
      payload: {
        dimension: decision.dimension,
        cap: decision.cap,
        spent: decision.spent,
        ratio: Number(decision.ratio.toFixed(3)),
      },
    });
    return false;
  }

  // decision.action === "gate" — don't stack gates for the same scope.
  const existing = await db.approval.findFirst({
    where: {
      status: "PENDING",
      trigger: "SPEND_CEILING",
      ...(task.parentOperationId ? { operationId: task.parentOperationId } : { missionId: mission.id }),
    },
    select: { id: true },
  });
  if (existing) return true;

  await requestApproval(db, {
    trigger: "SPEND_CEILING",
    scope: task.parentOperationId ? "OPERATION" : "MISSION",
    missionId: mission.id,
    operationId: task.parentOperationId,
    taskId: task.id,
    description: `Spending ceiling reached — the mission has spent $${decision.spent.toFixed(4)} of its $${decision.cap.toFixed(4)} ${decision.dimension} ceiling.`,
    metadata: {
      dimension: decision.dimension,
      cap: decision.cap,
      spent: decision.spent,
      projected: decision.projected,
    },
  });

  await eventBus.emit({
    type: "spend.gated",
    source: "gates",
    subject: "mission",
    subjectId: mission.id,
    missionId: mission.id,
    taskId: task.id,
    payload: {
      dimension: decision.dimension,
      cap: decision.cap,
      spent: decision.spent,
    },
  });

  return true;
}

/**
 * Sweep RUNNING missions for drift and raise a `DRIFT` gate (mission scope) for
 * each that is drifting. Returns the number of gates raised. Idempotent: a
 * mission already holding a PENDING DRIFT gate is skipped, and pausing the
 * mission removes it from the next sweep.
 */
export async function sweepDrift(db: PrismaClient): Promise<number> {
  const missions = await db.mission.findMany({ where: { status: "RUNNING" } });
  let raised = 0;

  for (const mission of missions) {
    const policy = resolveDriftPolicy(mission.policy);
    if (!policy) continue;

    const [operation, tasks, pending] = await Promise.all([
      db.operation.findFirst({
        where: { missionId: mission.id, status: "RUNNING" },
        orderBy: { createdAt: "desc" },
      }),
      db.task.findMany({
        where: { missionId: mission.id },
        select: { status: true, cost: true, updatedAt: true, completedAt: true },
      }),
      db.approval.findFirst({
        where: { status: "PENDING", trigger: "DRIFT", missionId: mission.id },
        select: { id: true },
      }),
    ]);
    if (pending) continue;

    const lastActivityAt = tasks.reduce<number | null>(
      (max, t) => (t.updatedAt ? Math.max(max ?? 0, t.updatedAt.getTime()) : max),
      null,
    );
    const lastCompletionAt = tasks.reduce<number | null>(
      (max, t) => (t.completedAt ? Math.max(max ?? 0, t.completedAt.getTime()) : max),
      null,
    );
    const spent = tasks.reduce((sum, t) => sum + t.cost, 0);

    const { drifted, signals } = detectDrift(
      {
        now: Date.now(),
        operation: operation ? { status: operation.status, lastActivityAt } : null,
        lastCompletionAt,
        lastRunAt: operation?.startedAt?.getTime() ?? mission.createdAt.getTime(),
        spent,
      },
      policy,
    );
    if (!drifted) continue;

    await requestApproval(db, {
      trigger: "DRIFT",
      scope: "MISSION",
      missionId: mission.id,
      description: `Mission is drifting off cadence (${signals.join(", ")}).`,
      metadata: { signals, spent },
    });

    await eventBus.emit({
      type: "drift.detected",
      source: "gates",
      subject: "mission",
      subjectId: mission.id,
      missionId: mission.id,
      payload: { signals, spent },
    });

    raised += 1;
  }

  return raised;
}
