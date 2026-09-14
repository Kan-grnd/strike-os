/**
 * Runtime State — canonical agent/colony lifecycle for Live Topology.
 *
 * The principle: the DATABASE is the source of truth. Every state transition
 * is persisted (preserving `previousRuntimeState` for paused->resume) and
 * emitted to the event bus. The topology renders this state; it never holds
 * a competing graph of its own.
 */

import prisma from "@/lib/db";
import { eventBus, type EventType } from "@/lib/events";

export const AGENT_RUNTIME_STATES = [
  "idle",
  "initializing",
  "thinking",
  "planning",
  "executing",
  "delegating",
  "waiting",
  "waiting_for_approval",
  "retrying",
  "blocked",
  "paused",
  "stopped",
  "completed",
  "failed",
  "cancelled",
] as const;

export type AgentRuntimeState = (typeof AGENT_RUNTIME_STATES)[number];

export const COLONY_RUNTIME_STATES = [
  "active",
  "initializing",
  "paused",
  "stopped",
  "failed",
  "archived",
] as const;

export type ColonyRuntimeState = (typeof COLONY_RUNTIME_STATES)[number];

export const DEPENDENCY_POLICIES = [
  "IGNORE",
  "BLOCK_DEPENDENT",
  "RETRY_DEPENDENCY",
  "SPAWN_REPLACEMENT",
  "ESCALATE",
  "ABORT_BRANCH",
  "ABORT_MISSION",
] as const;

export type DependencyPolicy = (typeof DEPENDENCY_POLICIES)[number];

const STATE_EVENT: Record<AgentRuntimeState, EventType> = {
  idle: "agent.idle",
  initializing: "agent.initializing",
  thinking: "agent.thinking",
  planning: "agent.planning",
  executing: "agent.executing",
  delegating: "agent.delegating",
  waiting: "agent.waiting",
  waiting_for_approval: "agent.waiting_approval",
  retrying: "agent.retrying",
  blocked: "agent.blocked",
  paused: "agent.paused",
  stopped: "agent.stopped",
  completed: "agent.completed",
  failed: "agent.failed",
  cancelled: "agent.cancelled",
};

const COLONY_STATE_EVENT: Record<ColonyRuntimeState, EventType> = {
  active: "colony.resumed",
  initializing: "colony.started",
  paused: "colony.paused",
  stopped: "colony.stopped",
  failed: "colony.failed",
  archived: "colony.archived",
};

export interface AgentStateInput {
  reason?: string;
  blockedBy?: string | null;
  taskId?: string | null;
  missionId?: string | null;
  source?: string;
}

/**
 * Transition an agent to `next`. Persists previousRuntimeState so PAUSED can
 * restore the exact prior state, then emits the corresponding event.
 * `blockedBy` must identify the entity/branch causing a blocked state.
 */
export async function setAgentState(
  agentId: string,
  next: AgentRuntimeState,
  input: AgentStateInput = {}
): Promise<void> {
  const agent = await prisma.agent.findUnique({
    where: { id: agentId },
    select: { id: true, runtimeState: true, name: true },
  });
  if (!agent || agent.runtimeState === next) return;

  const prev = agent.runtimeState;
  await prisma.agent.update({
    where: { id: agentId },
    data: {
      runtimeState: next,
      previousRuntimeState: prev,
      blockedBy:
        input.blockedBy !== undefined
          ? input.blockedBy
          : next === "blocked"
          ? prev
          : null,
      stateReason: input.reason ?? null,
      currentTaskId:
        input.taskId !== undefined ? input.taskId : next === "executing" ? undefined : undefined,
      lastActiveAt: next !== "idle" && next !== "paused" && next !== "blocked" && next !== "stopped" ? new Date() : undefined,
    },
  });

  await eventBus.emit({
    type: STATE_EVENT[next],
    source: input.source ?? "runtime",
    subject: "agent",
    subjectId: agentId,
    agentId,
    missionId: input.missionId ?? undefined,
    taskId: input.taskId ?? undefined,
    payload: {
      agent: agent.name,
      from: prev,
      to: next,
      reason: input.reason,
      blockedBy: input.blockedBy,
    },
  });
}

/**
 * Pause preserves the current state; resume restores it. If agent is already
 * paused this is a no-op. Restore target is previousRuntimeState unless reason
 * forces a clean idle.
 */
export async function pauseAgent(
  agentId: string,
  opts: { reason?: string; source?: string } = {}
): Promise<void> {
  const agent = await prisma.agent.findUnique({
    where: { id: agentId },
    select: { runtimeState: true },
  });
  if (!agent || agent.runtimeState === "paused" || agent.runtimeState === "stopped") return;
  await setAgentState(agentId, "paused", {
    reason: opts.reason ?? "paused by operator",
    source: opts.source,
  });
}

export async function resumeAgent(
  agentId: string,
  opts: { forceIdle?: boolean; reason?: string; source?: string } = {}
): Promise<void> {
  const agent = await prisma.agent.findUnique({
    where: { id: agentId },
    select: { runtimeState: true, previousRuntimeState: true },
  });
  if (!agent || agent.runtimeState !== "paused") return;
  const target: AgentRuntimeState =
    opts.forceIdle || agent.previousRuntimeState === "paused" || agent.previousRuntimeState === "stopped"
      ? "idle"
      : (agent.previousRuntimeState as AgentRuntimeState);
  await setAgentState(agentId, target, {
    reason: opts.reason ?? "resumed by operator",
    source: opts.source,
  });
}

export async function setColonyState(
  colonyId: string,
  next: ColonyRuntimeState,
  input: { reason?: string; source?: string } = {}
): Promise<void> {
  const colony = await prisma.colony.findUnique({
    where: { id: colonyId },
    select: { id: true, status: true, name: true, agents: { select: { id: true } } },
  });
  if (!colony || colony.status.toLowerCase() === next) return;

  const prev = colony.status;
  await prisma.colony.update({
    where: { id: colonyId },
    data: { status: next.toUpperCase() },
  });

  await eventBus.emit({
    type: COLONY_STATE_EVENT[next],
    source: input.source ?? "runtime",
    subject: "colony",
    subjectId: colonyId,
    payload: {
      colony: colony.name,
      from: prev,
      to: next,
      reason: input.reason,
      agentCount: colony.agents.length,
    },
  });
}

/**
 * Pause a colony hierarchically. Returns the classification needed for the
 * confirmation dialog. PAUSE_ALL applies to every descendant agent.
 */
export async function inspectColonyPause(colonyId: string) {
  const colony = await prisma.colony.findUnique({
    where: { id: colonyId },
    select: {
      id: true,
      name: true,
      agents: {
        select: {
          id: true,
          name: true,
          runtimeState: true,
          currentTaskId: true,
          children: { select: { id: true, runtimeState: true, currentTaskId: true } },
        },
      },
    },
  });
  if (!colony) return null;

  const allAgents = colony.agents.flatMap((a) => [
    a,
    ...a.children.map((c) => ({ ...c, parentName: a.name })),
  ]);

  return {
    colonyId: colony.id,
    colonyName: colony.name,
    agentCount: allAgents.length,
    activeAgents: allAgents.filter((a) =>
      ["thinking", "planning", "executing", "delegating", "retrying"].includes(a.runtimeState)
    ).length,
    activeTasks: allAgents.filter((a) => a.currentTaskId).length,
    dependentAgents: allAgents.filter((a) => a.runtimeState === "waiting").length,
    byState: allAgents.reduce<Record<string, number>>((acc, a) => {
      acc[a.runtimeState] = (acc[a.runtimeState] || 0) + 1;
      return acc;
    }, {}),
  };
}

export async function colonyPauseShallow(colonyId: string): Promise<void> {
  const { agentCount, activeAgents } = (await inspectColonyPause(colonyId)) || {};
  await setColonyState(colonyId, "paused", { reason: "paused by operator" });

  const agents = await prisma.agent.findMany({
    where: { colonyId },
    select: { id: true },
  });
  for (const a of agents) {
    await pauseAgent(a.id, { source: "colony.pause" });
  }
  return;
}

export interface DeleteImpact {
  runningTasks: number;
  childAgents: number;
  dependencies: number; // agents/tasks outside that depend on this entity
  dependents: number; // agents depending on this entity
  activeToolUses: number;
}

export async function inspectAgentImpact(agentId: string): Promise<DeleteImpact | null> {
  const agent = await prisma.agent.findUnique({
    where: { id: agentId },
    select: {
      id: true,
      runtimeState: true,
      children: { select: { id: true } },
    },
  });
  if (!agent) return null;

  const [runningTasks, dependents, children] = await Promise.all([
    prisma.task.count({ where: { ownerAgentId: agentId, status: { in: ["QUEUED", "ASSIGNED", "RUNNING"] } } }),
    prisma.agent.count({ where: { blockedBy: agentId } }),
    prisma.agent.count({ where: { parentId: agentId } }),
  ]);

  return {
    runningTasks,
    childAgents: children,
    dependencies: 0,
    dependents,
    activeToolUses: 0,
  };
}

export async function inspectColonyImpact(colonyId: string) {
  const colony = await prisma.colony.findUnique({
    where: { id: colonyId },
    select: {
      id: true,
      name: true,
      agents: {
        select: { id: true, runtimeState: true, currentTaskId: true },
      },
    },
  });
  if (!colony) return null;

  const agentIds = colony.agents.map((a) => a.id);
  const [descendants, tasks] = await Promise.all([
    prisma.agent.count({ where: { colonyId, parentId: { not: null } } }),
    prisma.task.count({
      where: {
        mission: { tasks: { some: {} } },
        ownerAgentId: { in: agentIds },
        status: { in: ["QUEUED", "ASSIGNED", "RUNNING"] },
        missionId: { in: await prisma.mission.findMany({ where: {}, select: { id: true } }).then((m) => m.map((x) => x.id)) },
      },
    }),
  ]);

  return {
    colonyId: colony.id,
    colonyName: colony.name,
    descendants,
    activeExecutions: colony.agents.filter((a) =>
      ["thinking", "planning", "executing", "delegating", "retrying"].includes(a.runtimeState)
    ).length,
    activeTasks: tasks,
    tasksOwned: tasks,
  };
}

export function formatAgentState(s: string): string {
  return s.replace(/_/g, " ").toUpperCase();
}

/* ────────────────────────────────────────────────────────────────
 * Lifecycle services (backed by DB state — never frontend-only)
 * ──────────────────────────────────────────────────────────────── */

export async function stopAgent(
  agentId: string,
  reason = "stopped by operator"
): Promise<void> {
  const agent = await prisma.agent.findUnique({ where: { id: agentId } });
  if (!agent || ["stopped", "cancelled", "failed"].includes(agent.runtimeState)) return;
  await setAgentState(agentId, "stopped", { reason, source: "topology" });
}

/** Unblock restores the state preserved before BLOCKED. */
export async function unblockAgent(agentId: string, reason = "dependency resolved"): Promise<void> {
  const agent = await prisma.agent.findUnique({
    where: { id: agentId },
    select: { runtimeState: true, previousRuntimeState: true },
  });
  if (!agent || agent.runtimeState !== "blocked") return;
  const target: AgentRuntimeState =
    agent.previousRuntimeState && AGENT_RUNTIME_STATES.includes(agent.previousRuntimeState as AgentRuntimeState)
      ? (agent.previousRuntimeState as AgentRuntimeState)
      : "idle";

  await setAgentState(agentId, target, { reason, source: "topology" });
  await eventBus.emit({ type: "agent.unblocked", source: "topology", subject: "agent", subjectId: agentId, payload: { reason, restored: target } });
}

/** Requeue the agent's most recent failed task so the engine retries it. */
export async function retryAgent(agentId: string, reason = "retry requested by operator"): Promise<void> {
  const task = await prisma.task.findFirst({
    where: { ownerAgentId: agentId, status: "FAILED", retryCount: { lt: 3 } },
    orderBy: { updatedAt: "desc" },
  });
  if (!task) return;

  await prisma.task.update({ where: { id: task.id }, data: { status: "QUEUED" } });
  await eventBus.emit({
    type: "task.retried",
    source: "topology",
    subject: "task",
    subjectId: task.id,
    taskId: task.id,
    missionId: task.missionId,
    agentId,
    payload: { retryCount: task.retryCount + 1, reason },
  });
  await setAgentState(agentId, "retrying", { reason, taskId: task.id, missionId: task.missionId, source: "topology" });
}

export interface SpawnAgentInput {
  name: string;
  type?: string;
  description?: string;
  parentId?: string;
  colonyId?: string;
  capabilities?: string[];
  tools?: string[];
  models?: string[];
  memoryScope?: string;
}

export async function spawnAgent(input: SpawnAgentInput & { source?: string }): Promise<{ id: string } | null> {
  if (!input.name) return null;

  const parent = input.parentId
    ? await prisma.agent.findUnique({ where: { id: input.parentId }, select: { colonyId: true } })
    : null;
  const colonyId = input.colonyId ?? parent?.colonyId ?? null;

  const agent = await prisma.agent.create({
    data: {
      name: input.name,
      description: input.description,
      type: input.type ?? "WORKER",
      status: "IDLE",
      runtimeState: "initializing",
      parentId: input.parentId,
      colonyId,
      capabilities: JSON.stringify(input.capabilities ?? []),
      tools: JSON.stringify(input.tools ?? []),
      models: JSON.stringify(input.models ?? []),
      memoryScope: input.memoryScope ?? "AGENT",
    },
  });

  await eventBus.emit({
    type: "agent.created",
    source: input.source ?? "topology",
    subject: "agent",
    subjectId: agent.id,
    agentId: agent.id,
    payload: { name: agent.name, type: agent.type, colonyId, parentId: input.parentId ?? null },
  });
  await setAgentState(agent.id, "initializing", { reason: "agent spawned", source: input.source ?? "topology" });

  // Brief spin-up, then idle
  setTimeout(() => {
    prisma.agent.update({
      where: { id: agent.id },
      data: { runtimeState: "idle", previousRuntimeState: "initializing" },
    }).catch(() => undefined);
    eventBus.emit({
      type: "agent.idle",
      source: "topology",
      subject: "agent",
      subjectId: agent.id,
      agentId: agent.id,
      payload: { name: agent.name, from: "initializing", to: "idle" },
    }).catch(() => undefined);
  }, 1200);

  return { id: agent.id };
}

/* ─── Delete / archive semantics ─────────────────────────────── */

export type DeleteAgentMode = "STOP_AND_REMOVE" | "ARCHIVE" | "REASSIGN_TASKS" | "REPLACE_AGENT" | "CANCEL_BRANCH";

async function descendantAgentIds(seedIds: string[]): Promise<string[]> {
  let frontier = seedIds;
  const all = new Set<string>(seedIds);
  while (frontier.length) {
    const kids = await prisma.agent.findMany({
      where: { parentId: { in: frontier } },
      select: { id: true },
    });
    frontier = kids.map((k) => k.id);
    kids.forEach((k) => all.add(k.id));
  }
  return Array.from(all);
}

async function cancelAgentBranch(agentId: string): Promise<void> {
  const ids = await descendantAgentIds([agentId]);
  await prisma.task.updateMany({
    where: { ownerAgentId: { in: ids }, status: { in: ["QUEUED", "ASSIGNED", "RUNNING", "WAITING"] } },
    data: { status: "CANCELLED" },
  });
  await prisma.agent.updateMany({
    where: { id: { in: ids }, runtimeState: { not: "cancelled" } },
    data: { runtimeState: "cancelled", stateReason: "branch cancelled", previousRuntimeState: "idle" },
  });
  await eventBus.emit({
    type: "agent.cancelled",
    source: "topology",
    subject: "agent",
    subjectId: agentId,
    agentId,
    payload: { branchIds: ids },
  });
}

export async function deleteAgentWithMode(
  agentId: string,
  mode: DeleteAgentMode,
  opts: { targetAgentId?: string; reason?: string; replacementName?: string } = {}
): Promise<{ removed: boolean; note?: string }> {
  const agent = await prisma.agent.findUnique({
    where: { id: agentId },
    include: { children: { select: { id: true } } },
  });
  if (!agent) return { removed: false, note: "agent not found" };
  const openTaskCount = await prisma.task.count({
    where: { ownerAgentId: agentId, status: { in: ["QUEUED", "ASSIGNED", "RUNNING", "WAITING"] } },
  });

  if (mode === "CANCEL_BRANCH") {
    await cancelAgentBranch(agentId);
    return { removed: false, note: "branch cancelled; agents retained" };
  }

  if (mode === "ARCHIVE") {
    await prisma.task.updateMany({
      where: { ownerAgentId: agentId, status: { in: ["QUEUED", "ASSIGNED", "RUNNING", "WAITING"] } },
      data: { status: "CANCELLED" },
    });
    await prisma.agent.update({
      where: { id: agentId },
      data: { runtimeState: "cancelled", status: "ARCHIVED", stateReason: "archived", previousRuntimeState: "idle" },
    });
    await eventBus.emit({ type: "agent.cancelled", source: "topology", subject: "agent", subjectId: agentId, agentId, payload: { archived: true, reason: opts.reason } });
    return { removed: false, note: "archived (visible in history, hidden from topology)" };
  }

  let replacementId: string | undefined;
  if (mode === "REPLACE_AGENT") {
    const spawnResult = await spawnAgent({
      name: opts.replacementName ?? `${agent.name} Replacement`,
      type: agent.type,
      description: agent.description ?? undefined,
      parentId: agent.parentId ?? undefined,
      colonyId: agent.colonyId ?? undefined,
      capabilities: JSON.parse(agent.capabilities) as string[],
      tools: JSON.parse(agent.tools) as string[],
      models: JSON.parse(agent.models) as string[],
      memoryScope: agent.memoryScope,
      source: "topology.replace",
    });
    replacementId = spawnResult?.id;
  }

  const targetId = opts.targetAgentId ?? (mode === "REPLACE_AGENT" ? replacementId : undefined) ?? agent.parentId;
  if (targetId && (mode === "REASSIGN_TASKS" || mode === "REPLACE_AGENT" || mode === "STOP_AND_REMOVE")) {
    await prisma.task.updateMany({
      where: { ownerAgentId: agentId, status: { in: ["QUEUED", "ASSIGNED", "WAITING"] } },
      data: { ownerAgentId: targetId },
    });
  }

  // Rehome children so the hierarchy stays coherent
  if (agent.children.length) {
    await prisma.agent.updateMany({
      where: { parentId: agentId },
      data: { parentId: agent.parentId },
    });
  }

  // Anyone blocked by this agent is downstream of a removed/moved entity
  const dependents = await prisma.agent.findMany({ where: { blockedBy: agentId }, select: { id: true } });
  await prisma.agent.updateMany({ where: { blockedBy: agentId }, data: { blockedBy: null, stateReason: "blocking agent removed" } });
  for (const dep of dependents) await unblockAgent(dep.id, "blocking agent removed").catch(() => undefined);

  await prisma.task.updateMany({
    where: { ownerAgentId: agentId, status: { in: ["RUNNING", "QUEUED", "ASSIGNED", "WAITING"] } },
    data: { status: "CANCELLED" },
  });

  await eventBus.emit({ type: "agent.stopped", source: "topology", subject: "agent", subjectId: agentId, agentId, payload: { mode, replacementId } });

  const deleted = await prisma.agent.delete({ where: { id: agentId } }).catch(() => null);
  if (!deleted) return { removed: false, note: "agent retained (archive recommended)" };
  return { removed: true, note: mode === "REPLACE_AGENT" && replacementId ? `replacement spawned (${replacementId})` : mode };
}

export type DeleteColonyMode = "ARCHIVE_COLONY" | "STOP_ALL_AND_REMOVE" | "REASSIGN_WORK" | "DELETE_SUBTREE" | "CANCEL_BRANCH";

/** Cancel, stop, or delete a colony subtree per the specified mode. */
export async function deleteColonyWithMode(
  colonyId: string,
  mode: DeleteColonyMode,
  opts: { targetColonyId?: string } = {}
): Promise<{ removed: boolean; note?: string }> {
  const colony = await prisma.colony.findUnique({ where: { id: colonyId } });
  if (!colony) return { removed: false, note: "colony not found" };

  const agents = await prisma.agent.findMany({ where: { colonyId }, select: { id: true } });
  const agentIds = await descendantAgentIds(agents.map((a) => a.id));

  if (mode === "ARCHIVE_COLONY") {
    await prisma.colony.update({ where: { id: colonyId }, data: { status: "ARCHIVED" } });
    await prisma.agent.updateMany({
      where: { id: { in: agentIds } },
      data: { runtimeState: "cancelled", status: "ARCHIVED", stateReason: "colony archived" },
    });
    await prisma.task.updateMany({
      where: { ownerAgentId: { in: agentIds }, status: { in: ["QUEUED", "ASSIGNED", "RUNNING", "WAITING"] } },
      data: { status: "CANCELLED" },
    });
    await eventBus.emit({ type: "colony.archived", source: "topology", subject: "colony", subjectId: colonyId, payload: { agentCount: agentIds.length } });
    return { removed: false, note: "colony archived" };
  }

  if (mode === "CANCEL_BRANCH") {
    await prisma.colony.update({ where: { id: colonyId }, data: { status: "STOPPED" } });
    await prisma.task.updateMany({
      where: { ownerAgentId: { in: agentIds }, status: { in: ["QUEUED", "ASSIGNED", "RUNNING", "WAITING"] } },
      data: { status: "CANCELLED" },
    });
    await prisma.agent.updateMany({
      where: { id: { in: agentIds }, runtimeState: { notIn: ["stopped", "cancelled"] } },
      data: { runtimeState: "stopped", stateReason: "colony branch cancelled" },
    });
    await eventBus.emit({ type: "colony.stopped", source: "topology", subject: "colony", subjectId: colonyId, payload: { mode: "CANCEL_BRANCH", agentCount: agentIds.length } });
    return { removed: false, note: "colony branch cancelled; agents retained" };
  }

  if (mode === "REASSIGN_WORK") {
    if (!opts.targetColonyId) return { removed: false, note: "targetColonyId required for REASSIGN_WORK" };
    const targets = await prisma.agent.findMany({ where: { colonyId: opts.targetColonyId }, select: { id: true } });
    const target = targets[0];
    if (target) {
      await prisma.task.updateMany({
        where: { ownerAgentId: { in: agentIds }, status: { in: ["QUEUED", "ASSIGNED", "RUNNING", "WAITING"] } },
        data: { ownerAgentId: target.id },
      });
    }
    await prisma.task.updateMany({
      where: { ownerAgentId: { in: agentIds }, status: { in: ["QUEUED", "ASSIGNED", "RUNNING", "WAITING"] } },
      data: { status: "CANCELLED" },
    });
  }

  // STOP_ALL_AND_REMOVE, REASSIGN_WORK, and DELETE_SUBTREE all physically remove the colony subtree
  await prisma.task.updateMany({
    where: { ownerAgentId: { in: agentIds }, status: { in: ["QUEUED", "ASSIGNED", "RUNNING", "WAITING"] } },
    data: { status: "CANCELLED" },
  });
  const del = await prisma.colony.delete({ where: { id: colonyId } }).catch(() => null);
  if (!del) return { removed: false, note: "colony retained" };

  await eventBus.emit({
    type: mode === "STOP_ALL_AND_REMOVE" ? "colony.stopped" : "colony.archived",
    source: "topology",
    subject: "colony",
    subjectId: colonyId,
    payload: { mode, agentCount: agentIds.length },
  });
  return { removed: true, note: mode };
}

/* ─── Colony pause scopes ────────────────────────────────────── */

export type ColonyPauseScope = "PAUSE_ALL" | "PAUSE_ACTIVE_ONLY" | "PAUSE_COORDINATOR_ONLY";

export async function pauseColonyWithScope(
  colonyId: string,
  scope: ColonyPauseScope = "PAUSE_ALL",
  reason = "paused by operator"
): Promise<void> {
  await setColonyState(colonyId, "paused", { reason, source: "topology" });

  const agents = await prisma.agent.findMany({ where: { colonyId }, select: { id: true, runtimeState: true, type: true } });
  const active = ["thinking", "planning", "executing", "delegating", "retrying"];
  const coordinators = ["ARCHITECT", "PLANNER", "OBSERVER"];

  for (const a of agents) {
    if (scope === "PAUSE_ACTIVE_ONLY" && !a.runtimeState.includes("executing") && !active.includes(a.runtimeState)) continue;
    if (scope === "PAUSE_COORDINATOR_ONLY" && !coordinators.includes(a.type)) continue;
    await pauseAgent(a.id, { reason, source: "colony.pause" });
  }
}

export async function resumeColony(colonyId: string, reason = "resumed by operator"): Promise<void> {
  await setColonyState(colonyId, "active", { reason, source: "topology" });
  const agents = await prisma.agent.findMany({ where: { colonyId }, select: { id: true } });
  for (const a of agents) await resumeAgent(a.id, { reason, source: "colony.resume" });
}

const STATE_ORDER: Record<string, number> = {};
AGENT_RUNTIME_STATES.forEach((s, i) => (STATE_ORDER[s] = i));

/** Aggregate per-state counts for a colony subtree (collapse uses this). */
export async function colonyStateBucket(colonyId: string) {
  const colony = await prisma.colony.findUnique({ where: { id: colonyId }, select: { status: true } });
  const agents = await prisma.agent.findMany({ where: { colonyId }, select: { runtimeState: true, status: true } });
  const byState: Record<string, number> = {};
  let errors = 0;
  let active = 0;
  for (const a of agents) {
    byState[a.runtimeState] = (byState[a.runtimeState] || 0) + 1;
    if (["failed", "blocked"].includes(a.runtimeState)) errors += 1;
    if (["thinking", "planning", "executing", "delegating", "retrying"].includes(a.runtimeState)) active += 1;
  }
  return {
    colonyId,
    status: colony?.status ?? "ACTIVE",
    agentCount: agents.filter((a) => a.status !== "ARCHIVED").length,
    byState,
    errors,
    active,
  };
}