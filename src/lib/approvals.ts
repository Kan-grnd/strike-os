/**
 * Approvals — the intervention contract in practice (M3.1).
 *
 * A gate is not a notification: firing one creates a PENDING `Approval`, pauses
 * the affected scope, and holds the work there until the operator decides
 * (docs/product/permissions.md §4, D16). Resolution is idempotent and never
 * auto-expires to approved (D28/E9); the first decision wins and a raced second
 * resolve returns the existing outcome without repeating any side effect (E7).
 *
 * Pause enforcement lives in two places so it is race-free and visible:
 *   - owning agents move to `waiting_for_approval` (shown in the workforce and
 *     blocked from new work by the task engine);
 *   - the affected operation/mission is marked `PAUSED` (shown in the mission
 *     views; the task engine skips gated work).
 * Because a gate can fire before a run's status is settled, the engine also
 * derives gating from outstanding PENDING approvals rather than trusting the
 * status field alone.
 */

import { PrismaClient, Approval } from "@prisma/client";
import { eventBus } from "./events";
import { setAgentState, spawnAgent } from "./runtime-state";
import { resolveSpawnCeiling } from "./spawn-policy";
import { DEFAULT_PRIMARY } from "./model-policy";
import {
  ApprovalDecision,
  ApprovalScope,
  InterventionTrigger,
  NON_TERMINAL_TASK_STATUSES,
  denyCancelsScope,
  statusForDecision,
  scopeCanResume,
  triggerDefaultScope,
} from "./approval-policy";

const NON_TERMINAL = [...NON_TERMINAL_TASK_STATUSES];
const PRODUCTIVE_STATES = ["initializing", "thinking", "planning", "executing", "delegating", "waiting", "retrying"];

export interface RequestApprovalInput {
  trigger: InterventionTrigger;
  description: string;
  scope?: ApprovalScope;
  missionId?: string | null;
  operationId?: string | null;
  taskId?: string | null;
  requestedBy?: string;
  /** Explicit agents to pause when the scope itself has no derivable owners
   *  (e.g. a tool gate raised outside a mission/operation). */
  pauseAgents?: string[];
  metadata?: Record<string, unknown>;
}

export interface ResolveApprovalResult {
  approval: Approval;
  alreadyResolved: boolean;
}

/**
 * Raise a gate: create the PENDING approval, pause the affected scope, emit
 * `approval.requested`. Returns the created approval.
 */
export async function requestApproval(
  db: PrismaClient,
  input: RequestApprovalInput,
): Promise<Approval> {
  const scope: ApprovalScope = input.scope ?? triggerDefaultScope(input.trigger);

  const approval = await db.approval.create({
    data: {
      type: input.trigger,
      trigger: input.trigger,
      scope,
      description: input.description,
      status: "PENDING",
      policy: "ALWAYS_ASK",
      missionId: input.missionId ?? null,
      operationId: input.operationId ?? null,
      taskId: input.taskId ?? null,
      requestedBy: input.requestedBy ?? "brain",
      metadata: JSON.stringify({
        ...(input.metadata ?? {}),
        ...(input.pauseAgents ? { pauseAgents: input.pauseAgents } : {}),
      }),
    },
  });

  await pauseScope(db, approval);

  await eventBus.emit({
    type: "approval.requested",
    source: "approvals",
    subject: "approval",
    subjectId: approval.id,
    missionId: input.missionId ?? undefined,
    taskId: input.taskId ?? undefined,
    payload: {
      trigger: input.trigger,
      scope,
      description: input.description,
      operationId: input.operationId ?? null,
    },
  });

  return approval;
}

/**
 * Resolve a gate. Idempotent: the first decision wins; a second resolve returns
 * the existing outcome and performs no side effects (E7/D28).
 */
export async function resolveApproval(
  db: PrismaClient,
  id: string,
  decision: ApprovalDecision,
  opts: { resolvedBy?: string; note?: string } = {},
): Promise<ResolveApprovalResult> {
  const next = statusForDecision(decision);

  // Atomic claim: only a PENDING row transitions. A concurrent/duplicate resolve
  // matches zero rows and is treated as already-resolved.
  const claimed = await db.approval.updateMany({
    where: { id, status: "PENDING" },
    data: {
      status: next,
      resolvedAt: new Date(),
      resolvedBy: opts.resolvedBy ?? "operator",
      resolutionNote: opts.note ?? null,
    },
  });

  const approval = await db.approval.findUnique({ where: { id } });
  if (!approval) throw new Error("Approval not found");

  if (claimed.count === 0) {
    return { approval, alreadyResolved: true };
  }

  // First resolution — perform the trigger-specific side effect, then resume.
  if (decision === "APPROVE") {
    await onApprove(db, approval);
  } else {
    await onDeny(db, approval);
  }

  await maybeResumeScope(db, approval);

  await eventBus.emit({
    type: decision === "APPROVE" ? "approval.approved" : "approval.denied",
    source: "approvals",
    subject: "approval",
    subjectId: approval.id,
    missionId: approval.missionId ?? undefined,
    taskId: approval.taskId ?? undefined,
    payload: {
      trigger: approval.trigger,
      scope: approval.scope,
      resolvedBy: approval.resolvedBy,
      note: approval.resolutionNote,
    },
  });

  return { approval, alreadyResolved: false };
}

/** Count PENDING gates for a scope, optionally excluding one approval id. */
export async function pendingForScope(
  db: PrismaClient,
  scope: { scope: ApprovalScope; missionId?: string | null; operationId?: string | null },
  excludeId?: string,
): Promise<number> {
  const scopeWhere =
    scope.scope === "MISSION" && scope.missionId
      ? { missionId: scope.missionId }
      : scope.operationId
        ? { operationId: scope.operationId }
        : null;
  if (!scopeWhere) return 0;
  return db.approval.count({
    where: { status: "PENDING", ...scopeWhere, ...(excludeId ? { id: { not: excludeId } } : {}) },
  });
}

/* ── Pause / resume ────────────────────────────────────────────────────────── */

async function scopeAgentIds(db: PrismaClient, approval: Approval): Promise<string[]> {
  const explicit = safeJson(approval.metadata).pauseAgents;
  const extra = Array.isArray(explicit) ? (explicit as string[]) : [];

  const where =
    approval.scope === "MISSION" && approval.missionId
      ? { missionId: approval.missionId }
      : approval.operationId
        ? { parentOperationId: approval.operationId }
        : null;
  if (!where) return extra;

  const tasks = await db.task.findMany({
    where: { ...where, ownerAgentId: { not: null }, status: { in: NON_TERMINAL } },
    select: { ownerAgentId: true },
    distinct: ["ownerAgentId"],
  });
  return [...new Set([...tasks.map((t) => t.ownerAgentId!).filter(Boolean), ...extra])];
}

async function pauseScope(db: PrismaClient, approval: Approval): Promise<void> {
  if (approval.scope === "MISSION" && approval.missionId) {
    await db.mission
      .update({ where: { id: approval.missionId }, data: { status: "PAUSED" } })
      .catch(() => undefined);
  } else if (approval.operationId) {
    await db.operation
      .update({ where: { id: approval.operationId }, data: { status: "PAUSED" } })
      .catch(() => undefined);
  }

  for (const agentId of await scopeAgentIds(db, approval)) {
    await setAgentState(agentId, "waiting_for_approval", {
      reason: `Awaiting approval: ${approval.description}`,
      missionId: approval.missionId ?? undefined,
      source: "approvals",
    }).catch(() => undefined);
  }
}

async function resumeScope(db: PrismaClient, approval: Approval): Promise<void> {
  if (approval.scope === "MISSION" && approval.missionId) {
    const mission = await db.mission.findUnique({ where: { id: approval.missionId } });
    if (mission && ["PAUSED", "READY", "PLANNING"].includes(mission.status)) {
      await db.mission
        .update({ where: { id: mission.id }, data: { status: "RUNNING" } })
        .catch(() => undefined);
    }
  } else if (approval.operationId) {
    const op = await db.operation.findUnique({ where: { id: approval.operationId } });
    if (op && ["PAUSED", "PLANNING"].includes(op.status)) {
      await db.operation
        .update({ where: { id: op.id }, data: { status: "RUNNING" } })
        .catch(() => undefined);
    }
    // A gate can fire during materialization, before the mission start settled
    // its status — make sure the mission is running again too.
    if (op?.missionId) {
      const mission = await db.mission.findUnique({ where: { id: op.missionId } });
      if (mission && ["PAUSED", "READY", "PLANNING"].includes(mission.status)) {
        await db.mission
          .update({ where: { id: mission.id }, data: { status: "RUNNING" } })
          .catch(() => undefined);
      }
    }
  }

  for (const agentId of await scopeAgentIds(db, approval)) {
    await restoreAgentAfterGate(db, agentId);
  }
}

/** Resume only once every blocking gate for the scope is resolved (E8). */
async function maybeResumeScope(db: PrismaClient, approval: Approval): Promise<void> {
  const remaining = await pendingForScope(
    db,
    {
      scope: approval.scope as ApprovalScope,
      missionId: approval.missionId,
      operationId: approval.operationId,
    },
    approval.id,
  );
  if (scopeCanResume(remaining)) {
    await resumeScope(db, approval);
  }
}

async function restoreAgentAfterGate(db: PrismaClient, agentId: string): Promise<void> {
  const agent = await db.agent.findUnique({
    where: { id: agentId },
    select: { runtimeState: true, previousRuntimeState: true },
  });
  if (!agent || agent.runtimeState !== "waiting_for_approval") return;
  const target =
    agent.previousRuntimeState && PRODUCTIVE_STATES.includes(agent.previousRuntimeState)
      ? agent.previousRuntimeState
      : "idle";
  await setAgentState(agentId, target as never, {
    reason: "Approval resolved",
    source: "approvals",
  }).catch(() => undefined);
}

/* ── Trigger-specific resolution ───────────────────────────────────────────── */

async function onApprove(db: PrismaClient, approval: Approval): Promise<void> {
  switch (approval.trigger) {
    case "SPAWN_CEILING":
      await approveSpawnCeiling(db, approval);
      break;
    case "TOOL_PERMISSION":
      await approveToolPermission(db, approval);
      break;
    case "MODEL_FALLBACK":
      // Operator authorised a fallback outside policy → switch to the default
      // model and re-queue. The recovery stage is already recorded, so the task
      // continues at the replacement stage if it fails again.
      await requeueTaskForRecovery(db, approval, { model: DEFAULT_PRIMARY });
      break;
    case "ESCALATION":
      // Operator took the escalated task on: start a fresh recovery cycle.
      await requeueTaskForRecovery(db, approval, { resetRecovery: true });
      break;
    default:
      // Blocking gates (spend, drift) need no grant — approving simply lifts the
      // pause and the work resumes.
      break;
  }
}

async function onDeny(db: PrismaClient, approval: Approval): Promise<void> {
  if (denyCancelsScope(approval.trigger as InterventionTrigger)) {
    await cancelScope(db, approval);
  }
  // Capability denials (tool, spawn) leave the work running without the
  // capability; the refusal is recorded on the approval.
}

async function cancelScope(db: PrismaClient, approval: Approval): Promise<void> {
  const where =
    approval.scope === "MISSION" && approval.missionId
      ? { missionId: approval.missionId }
      : approval.operationId
        ? { parentOperationId: approval.operationId }
        : null;
  if (!where) return;

  await db.task
    .updateMany({ where: { ...where, status: { in: NON_TERMINAL } }, data: { status: "CANCELLED" } })
    .catch(() => undefined);

  if (approval.operationId) {
    await db.operation
      .update({
        where: { id: approval.operationId },
        data: { status: "CANCELLED", completedAt: new Date() },
      })
      .catch(() => undefined);
  }
  if (approval.scope === "MISSION" && approval.missionId) {
    await db.mission
      .update({
        where: { id: approval.missionId },
        data: { status: "CANCELLED", completedAt: new Date() },
      })
      .catch(() => undefined);
  }
}

/**
 * Approving a spawn-ceiling gate: record the raised allowance, spawn the
 * sub-agent the step needed, and assign it to the unowned task.
 */
async function approveSpawnCeiling(db: PrismaClient, approval: Approval): Promise<void> {
  const meta = safeJson(approval.metadata);

  if (approval.missionId) {
    const mission = await db.mission.findUnique({ where: { id: approval.missionId } });
    if (mission) {
      const policy = safeJson(mission.policy);
      policy.spawnCeiling = resolveSpawnCeiling(mission.policy) + 1;
      await db.mission
        .update({ where: { id: mission.id }, data: { policy: JSON.stringify(policy) } })
        .catch(() => undefined);
    }
  }

  const taskId = approval.taskId ?? (typeof meta.taskId === "string" ? meta.taskId : null);
  if (!taskId) return;

  const task = await db.task.findUnique({ where: { id: taskId } });
  if (!task) return;

  try {
    const spawned = await spawnAgent({
      name: `${(meta.agentType as string) || "WORKER"} · ${task.description.slice(0, 40)}`,
      type: (meta.agentType as string) || "WORKER",
      description: `Sub-agent approved past the spawn ceiling for mission step ${meta.step ?? "?"}`,
      parentId: typeof meta.parentAgentId === "string" ? meta.parentAgentId : undefined,
      missionId: approval.missionId ?? task.missionId,
      source: "approvals",
    });
    if (spawned?.id) {
      await db.task.update({ where: { id: task.id }, data: { ownerAgentId: spawned.id } });
    }
  } catch (err) {
    console.error("[approvals] approved spawn failed:", err);
  }
}

/**
 * Re-queue a task after a recovery gate is approved (M3.2). MODEL_FALLBACK may
 * switch the model; ESCALATION starts a fresh recovery cycle.
 */
async function requeueTaskForRecovery(
  db: PrismaClient,
  approval: Approval,
  opts: { model?: string; resetRecovery?: boolean } = {},
): Promise<void> {
  const meta = safeJson(approval.metadata);
  const taskId = approval.taskId ?? (typeof meta.taskId === "string" ? meta.taskId : null);
  if (!taskId) return;

  const task = await db.task.findUnique({ where: { id: taskId } });
  if (!task) return;

  const data: Record<string, unknown> = { status: "QUEUED", retryCount: 0 };
  if (opts.resetRecovery) data.recovery = "{}";
  if (opts.model) {
    const policy = safeJson(task.policy);
    policy.primary = opts.model;
    data.policy = JSON.stringify(policy);
  }
  await db.task.update({ where: { id: task.id }, data }).catch(() => undefined);
}

/** Approving a tool-permission gate grants the tool to the requesting agent. */
async function approveToolPermission(db: PrismaClient, approval: Approval): Promise<void> {
  const meta = safeJson(approval.metadata);
  const agentId = typeof meta.agentId === "string" ? meta.agentId : null;
  const toolName = typeof meta.toolName === "string" ? meta.toolName : null;
  if (!agentId || !toolName) return;

  const agent = await db.agent.findUnique({ where: { id: agentId } });
  if (!agent) return;
  const tools = safeJsonArray(agent.tools);
  if (!tools.includes(toolName)) {
    await db.agent
      .update({ where: { id: agent.id }, data: { tools: JSON.stringify([...tools, toolName]) } })
      .catch(() => undefined);
  }
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

function safeJsonArray(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as string[]) : [];
  } catch {
    return [];
  }
}
