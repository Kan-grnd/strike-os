/**
 * Health rollup (M3.3) — task → operation → mission.
 *
 * Health is **orthogonal to lifecycle** (state-model.md §1): a `RUNNING` mission
 * can be `BLOCKED`, a `PAUSED` mission can be `HEALTHY`. It answers the operator's
 * first question — *is it healthy?* — before they look at any state label.
 *
 *   HEALTHY   nothing needs the operator.
 *   DEGRADED  something is wrong but the run is still progressing.
 *   BLOCKED   the run cannot proceed — a gate, an escalation, or a failing run.
 *   FAILING   terminal failure (the mission/operation itself failed).
 *
 * Scope of severity rises as it rolls up (the acceptance contract):
 *   a **failing task** degrades its operation (`DEGRADED`);
 *   a **failing operation** blocks its mission (`BLOCKED`).
 *
 * Debounce (realtime.md): health follows the **settled** state, so a task that
 * failed but will still retry/recover must not flash the operation. A `FAILED`
 * task with retries remaining is therefore not yet a health signal.
 *
 * Pure and testable; reads only the fields the engine already persists.
 */

export type HealthState = "HEALTHY" | "DEGRADED" | "BLOCKED" | "FAILING";

const RANK: Record<HealthState, number> = { HEALTHY: 0, DEGRADED: 1, BLOCKED: 2, FAILING: 3 };

/** The more severe of two health states (FAILING > BLOCKED > DEGRADED > HEALTHY). */
export function worstHealth(a: HealthState, b: HealthState): HealthState {
  return RANK[a] >= RANK[b] ? a : b;
}

export interface TaskInput {
  status: string;
  retryCount?: number;
  maxRetries?: number;
}

/**
 * A single task's contribution to health.
 *  - `ESCALATED` / `WAITING` (a gate) → BLOCKED: the work is waiting on the operator.
 *  - `FAILED` with retries remaining → HEALTHY: it will retry/recover, so it must
 *    not flash (debounce). A settled failure (retries exhausted) → DEGRADED.
 */
export function taskHealth(task: TaskInput): HealthState {
  if (task.status === "ESCALATED" || task.status === "WAITING") return "BLOCKED";
  if (task.status === "FAILED") {
    const remaining = (task.maxRetries ?? 0) - (task.retryCount ?? 0);
    return remaining > 0 ? "HEALTHY" : "DEGRADED";
  }
  return "HEALTHY";
}

export interface OperationInput {
  status: string;
}

/**
 * An operation's health from its own lifecycle and its tasks. A failed task
 * degrades the operation; a gate or escalation blocks it.
 */
export function operationHealth(op: OperationInput, tasks: TaskInput[]): HealthState {
  if (op.status === "FAILED") return "FAILING";
  if (op.status === "CANCELLED") return "HEALTHY";

  let health: HealthState = "HEALTHY";
  for (const t of tasks) health = worstHealth(health, taskHealth(t));

  // A run paused with nothing else wrong is stalled, not failing.
  if (health === "HEALTHY" && op.status === "PAUSED") return "DEGRADED";
  return health;
}

export interface MissionInput {
  status: string;
}

/**
 * A mission's health from its operations' health. A failing run blocks its
 * mission; a gate/escalation blocks it too. A merely paused mission (nothing
 * failing) is degraded, not blocked.
 */
export function missionHealth(mission: MissionInput, operationHealths: HealthState[]): HealthState {
  if (mission.status === "FAILED") return "FAILING";

  let health: HealthState = "HEALTHY";
  for (const h of operationHealths) health = worstHealth(health, h);

  // A failing run (DEGRADED) or a gated run (BLOCKED) means the mission cannot
  // proceed without the operator → BLOCKED. FAILING rolls up as FAILING above.
  if (health === "DEGRADED" || health === "BLOCKED") return "BLOCKED";
  if (health === "HEALTHY" && mission.status === "PAUSED") return "DEGRADED";
  return health;
}

export interface TaskRollupInput extends TaskInput {
  parentOperationId?: string | null;
}

/**
 * Convenience for read surfaces: roll a mission's health up from raw reads —
 * its operations plus its tasks (grouped by operation; tasks with no run count
 * at the mission level).
 */
export function missionHealthFrom(
  mission: MissionInput,
  operations: (OperationInput & { id: string })[],
  tasks: TaskRollupInput[],
): HealthState {
  const byOp = new Map<string, TaskInput[]>();
  const bare: TaskInput[] = [];
  for (const t of tasks) {
    if (t.parentOperationId) {
      const list = byOp.get(t.parentOperationId) ?? [];
      list.push(t);
      byOp.set(t.parentOperationId, list);
    } else {
      bare.push(t);
    }
  }
  const healths: HealthState[] = [
    ...operations.map((op) => operationHealth(op, byOp.get(op.id) ?? [])),
    ...bare.map(taskHealth),
  ];
  return missionHealth(mission, healths);
}
