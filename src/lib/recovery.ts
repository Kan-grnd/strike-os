/**
 * Failure recovery (M3.2) — the Brain recovering a task it could not finish.
 *
 * When a task exhausts its bounded retries the engine calls `recoverTask`, which
 * walks a fixed ladder, each stage attempted at most once (D53):
 *
 *   reassign → fallback → replacement → escalate
 *
 *   reassign     hand the task to a different capable agent.
 *   fallback     switch to the next model the policy lists (in-policy = silent);
 *                when the policy names none, a model switch would be *outside
 *                policy* → raise a MODEL_FALLBACK gate instead (D54).
 *   replacement  spawn a replacement sub-agent, honouring the spawn ceiling.
 *   escalate     stop and ask the operator, carrying the full failure context;
 *                the task ends non-terminal `ESCALATED`, never a silent FAILED (D55).
 *
 * This is the honesty rule (E2) in code: a task either recovers or is escalated
 * to a human — it never quietly disappears, and never fakes a success.
 */

import { PrismaClient, Task } from "@prisma/client";
import { eventBus } from "./events";
import { setAgentState, spawnAgent } from "./runtime-state";
import { requestApproval } from "./approvals";
import { resolveModelPolicy, ResolvedModelPolicy } from "./model-policy";
import { resolveSpawnCeiling } from "./spawn-policy";
import {
  RecoveryStage,
  RECOVERY_LADDER,
  fallbackDecision,
  nextRecoveryStage,
  parseRecoveryState,
  recordRecoveryAttempt,
} from "./recovery-policy";

const UNUSABLE_AGENT_STATES = [
  "failed",
  "cancelled",
  "stopped",
  "blocked",
  "paused",
  "waiting_for_approval",
];

export interface RecoverResult {
  stage: RecoveryStage;
  outcome: "requeued" | "gated" | "escalated" | "skipped";
}

/**
 * Recover a task that exhausted its retries. Idempotent per stage: the stage
 * that ran is recorded on the task, so calling this again advances the ladder
 * rather than repeating a stage.
 */
export async function recoverTask(
  db: PrismaClient,
  taskId: string,
  error?: string,
): Promise<RecoverResult> {
  const task = await db.task.findUnique({ where: { id: taskId } });
  if (!task) return { stage: "escalate", outcome: "skipped" };

  return attempt(db, task, error);
}

async function attempt(db: PrismaClient, task: Task, error?: string): Promise<RecoverResult> {
  const state = parseRecoveryState(task.recovery);
  const stage = nextRecoveryStage(state.tried);

  await eventBus.emit({
    type: "recovery.started",
    source: "recovery",
    subject: "task",
    subjectId: task.id,
    taskId: task.id,
    missionId: task.missionId,
    agentId: task.ownerAgentId || undefined,
    payload: { stage, tried: state.tried, error: error ?? null },
  });

  switch (stage) {
    case "reassign":
      return reassignStage(db, task, error);
    case "fallback":
      return fallbackStage(db, task, error);
    case "replacement":
      return replacementStage(db, task, error);
    default:
      return escalateStage(db, task, error ?? state.lastError);
  }
}

/* ── reassign ──────────────────────────────────────────────────────────────── */

async function reassignStage(db: PrismaClient, task: Task, error?: string): Promise<RecoverResult> {
  const candidate = await findReassignTarget(db, task);

  if (!candidate) {
    // No other capable agent — record the attempt and move down the ladder.
    await db.task.update({
      where: { id: task.id },
      data: { recovery: recordRecoveryAttempt(task.recovery, "reassign", error) },
    });
    const fresh = await db.task.findUnique({ where: { id: task.id } });
    return attempt(db, fresh!, error);
  }

  await db.task.update({
    where: { id: task.id },
    data: {
      ownerAgentId: candidate,
      status: "QUEUED",
      retryCount: 0,
      recovery: recordRecoveryAttempt(task.recovery, "reassign", error),
    },
  });

  await emitRecovered(task, "reassign", error, { agentId: candidate });
  return { stage: "reassign", outcome: "requeued" };
}

/** Another capable agent to hand the work to: same type preferred, never the
 *  current owner, never an agent that is itself failed/blocked/paused. */
async function findReassignTarget(db: PrismaClient, task: Task): Promise<string | null> {
  const owner = task.ownerAgentId
    ? await db.agent.findUnique({ where: { id: task.ownerAgentId }, select: { type: true } })
    : null;

  const candidates = await db.agent.findMany({
    where: {
      ...(task.ownerAgentId ? { id: { not: task.ownerAgentId } } : {}),
      ...(owner?.type ? { type: owner.type } : {}),
    },
    select: { id: true, runtimeState: true },
  });

  const usable = candidates.find((a) => !UNUSABLE_AGENT_STATES.includes(a.runtimeState));
  return usable?.id ?? null;
}

/* ── fallback ──────────────────────────────────────────────────────────────── */

async function fallbackStage(db: PrismaClient, task: Task, error?: string): Promise<RecoverResult> {
  const policy = await resolvePolicyFor(db, task);
  const decision = fallbackDecision(policy.primary, policy.fallback);

  if (decision.action === "use") {
    const taskPolicy = safeJson(task.policy);
    taskPolicy.primary = decision.model;
    await db.task.update({
      where: { id: task.id },
      data: {
        policy: JSON.stringify(taskPolicy),
        status: "QUEUED",
        retryCount: 0,
        recovery: recordRecoveryAttempt(task.recovery, "fallback", error),
      },
    });
    await emitRecovered(task, "fallback", error, { model: decision.model });
    return { stage: "fallback", outcome: "requeued" };
  }

  // No in-policy fallback: switching models would be outside policy → ask.
  await db.task.update({
    where: { id: task.id },
    data: {
      status: "WAITING",
      recovery: recordRecoveryAttempt(task.recovery, "fallback", error),
    },
  });
  await requestApproval(db, {
    trigger: "MODEL_FALLBACK",
    description: `Task "${task.description.slice(0, 60)}" has no in-policy fallback model — approve falling back outside policy?`,
    missionId: task.missionId,
    operationId: task.parentOperationId,
    taskId: task.id,
    requestedBy: "brain",
    metadata: { primary: policy.primary, fallback: policy.fallback, error: error ?? null },
  });
  return { stage: "fallback", outcome: "gated" };
}

async function resolvePolicyFor(db: PrismaClient, task: Task): Promise<ResolvedModelPolicy> {
  const [operation, mission, agent] = await Promise.all([
    task.parentOperationId
      ? db.operation.findUnique({ where: { id: task.parentOperationId } })
      : Promise.resolve(null),
    db.mission.findUnique({ where: { id: task.missionId } }),
    task.ownerAgentId
      ? db.agent.findUnique({ where: { id: task.ownerAgentId } })
      : Promise.resolve(null),
  ]);
  return resolveModelPolicy({ task, operation, mission, agent });
}

/* ── replacement ───────────────────────────────────────────────────────────── */

async function replacementStage(db: PrismaClient, task: Task, error?: string): Promise<RecoverResult> {
  const spawned = await spawnReplacement(db, task);

  if (spawned) {
    await db.task.update({
      where: { id: task.id },
      data: {
        ownerAgentId: spawned.id,
        status: "QUEUED",
        retryCount: 0,
        recovery: recordRecoveryAttempt(task.recovery, "replacement", error),
      },
    });
    await emitRecovered(task, "replacement", error, { agentId: spawned.id });
    return { stage: "replacement", outcome: "requeued" };
  }

  // At the spawn ceiling → the spawn-ceiling gate (M3.1) decides.
  const parent = task.ownerAgentId
    ? await db.agent.findUnique({ where: { id: task.ownerAgentId } })
    : null;
  await db.task.update({
    where: { id: task.id },
    data: {
      status: "WAITING",
      recovery: recordRecoveryAttempt(task.recovery, "replacement", error),
    },
  });
  await requestApproval(db, {
    trigger: "SPAWN_CEILING",
    description: `Task "${task.description.slice(0, 60)}" needs a replacement agent, but the mission is at its spawn ceiling.`,
    missionId: task.missionId,
    operationId: task.parentOperationId,
    taskId: task.id,
    requestedBy: "brain",
    metadata: {
      agentType: parent?.type ?? "WORKER",
      parentAgentId: parent?.id ?? null,
      taskId: task.id,
      step: "recovery/replacement",
    },
  });
  return { stage: "replacement", outcome: "gated" };
}

/** Spawn a replacement sub-agent for the failed task, or null if the mission is
 *  already at its spawn ceiling. */
async function spawnReplacement(db: PrismaClient, task: Task): Promise<{ id: string } | null> {
  const mission = await db.mission.findUnique({ where: { id: task.missionId } });
  const ceiling = resolveSpawnCeiling(mission?.policy);
  const used = await countMissionSubAgents(db, task.missionId);
  if (used >= ceiling) return null;

  const parent = task.ownerAgentId
    ? await db.agent.findUnique({ where: { id: task.ownerAgentId } })
    : null;

  return spawnAgent({
    name: `Replacement · ${task.description.slice(0, 30)}`,
    type: parent?.type ?? "WORKER",
    description: `Replacement sub-agent for failed task ${task.id}`,
    parentId: parent?.id,
    missionId: task.missionId,
    source: "recovery",
  });
}

/** Count sub-agents (agents with a parent) that currently own work in a mission. */
async function countMissionSubAgents(db: PrismaClient, missionId: string): Promise<number> {
  const owners = await db.task.findMany({
    where: { missionId, ownerAgentId: { not: null } },
    select: { ownerAgentId: true },
    distinct: ["ownerAgentId"],
  });
  const ids = owners.map((t) => t.ownerAgentId!).filter(Boolean);
  if (ids.length === 0) return 0;
  return db.agent.count({ where: { id: { in: ids }, parentId: { not: null } } });
}

/* ── escalate ──────────────────────────────────────────────────────────────── */

async function escalateStage(db: PrismaClient, task: Task, error?: string): Promise<RecoverResult> {
  const state = parseRecoveryState(task.recovery);

  await db.task.update({
    where: { id: task.id },
    data: {
      status: "ESCALATED",
      recovery: recordRecoveryAttempt(task.recovery, "escalate", error),
    },
  });

  if (task.ownerAgentId) {
    await setAgentState(task.ownerAgentId, "blocked", {
      reason: "task escalated to operator",
      taskId: task.id,
      missionId: task.missionId,
      source: "recovery",
    }).catch(() => undefined);
  }

  await eventBus.emit({
    type: "task.escalated",
    source: "recovery",
    subject: "task",
    subjectId: task.id,
    taskId: task.id,
    missionId: task.missionId,
    agentId: task.ownerAgentId || undefined,
    payload: {
      description: task.description,
      tried: state.tried,
      lastError: error ?? null,
    },
  });
  await eventBus.emit({
    type: "recovery.failed",
    source: "recovery",
    subject: "task",
    subjectId: task.id,
    taskId: task.id,
    missionId: task.missionId,
    payload: { stage: "escalate", tried: state.tried, lastError: error ?? null },
  });

  // Carry the whole failure history to the operator — what was tried and why it failed.
  await requestApproval(db, {
    trigger: "ESCALATION",
    description: `Task "${task.description.slice(0, 60)}" could not be recovered after ${state.tried.length || RECOVERY_LADDER.length} attempt(s) — needs you.`,
    scope: "MISSION",
    missionId: task.missionId,
    operationId: task.parentOperationId,
    taskId: task.id,
    requestedBy: "brain",
    metadata: {
      tried: state.tried,
      lastError: error ?? null,
      description: task.description,
    },
  });

  return { stage: "escalate", outcome: "escalated" };
}

/* ── boot recovery (E3) ────────────────────────────────────────────────────── */

/**
 * A `RUNNING` task orphaned by a crash/restart is re-queued on boot, with a
 * reattempt cap so it cannot loop forever; its agent resets out of `executing`.
 * Called once when the engine starts (E3).
 */
export async function requeueOrphanedTasks(db: PrismaClient): Promise<number> {
  const orphans = await db.task.findMany({ where: { status: "RUNNING" } });
  let requeued = 0;

  for (const task of orphans) {
    if (task.retryCount < task.maxRetries) {
      await db.task
        .update({
          where: { id: task.id },
          data: { status: "QUEUED", retryCount: { increment: 1 } },
        })
        .catch(() => undefined);
      requeued += 1;
    } else {
      // Reattempt cap reached — settle honestly, do not loop.
      await db.task
        .update({ where: { id: task.id }, data: { status: "FAILED" } })
        .catch(() => undefined);
    }

    if (task.ownerAgentId) {
      await setAgentState(task.ownerAgentId, "idle", {
        reason: "re-queued after restart (orphaned RUNNING task)",
        taskId: task.id,
        missionId: task.missionId,
        source: "recovery",
      }).catch(() => undefined);
    }
  }

  return requeued;
}

/* ── helpers ───────────────────────────────────────────────────────────────── */

async function emitRecovered(
  task: Task,
  stage: RecoveryStage,
  error: string | undefined,
  extra: Record<string, unknown>,
): Promise<void> {
  await eventBus.emit({
    type: "task.recovered",
    source: "recovery",
    subject: "task",
    subjectId: task.id,
    taskId: task.id,
    missionId: task.missionId,
    agentId: task.ownerAgentId || undefined,
    payload: { stage, error: error ?? null, ...extra },
  });
  await eventBus.emit({
    type: "recovery.succeeded",
    source: "recovery",
    subject: "task",
    subjectId: task.id,
    taskId: task.id,
    missionId: task.missionId,
    payload: { stage, ...extra },
  });
}

function safeJson(raw: string | null | undefined): Record<string, unknown> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}
