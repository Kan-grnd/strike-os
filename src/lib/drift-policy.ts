/**
 * Drift policy — "the mission is no longer doing what was asked", as pure data
 * (M3.4, E16/Q2).
 *
 * The product contract (E16): a **drift signal** fires *without waiting for a
 * hard failure* and the mission enters the attention queue. permissions.md §4
 * lists "a mission drifts off cadence" as an intervention trigger — so a drifted
 * mission raises a `DRIFT` gate (mission scope) and is paused for the operator.
 *
 * Which signals count (Q2) is an **open question**, so the signals are
 * configurable and each is **off unless the policy switches it on** — no invented
 * thresholds. Candidates implemented (the Q2 default proposal):
 *   - `stalled`       — a RUNNING run with no activity for `stallMs`;
 *   - `rising_cost`   — cost accrued but nothing completed for `risingCostWindowMs`;
 *   - `missed_cadence`— no run started within `cadenceMs * (1 + cadenceGrace)`.
 *
 * Policy shape (`Mission.policy`):
 *   { "drift": { "stallMs": 600000, "risingCostWindowMs": 900000,
 *                "cadenceMs": 86400000, "cadenceGrace": 0 } }
 */

export type DriftSignal = "stalled" | "rising_cost" | "missed_cadence";

export interface DriftPolicy {
  stallMs?: number;
  risingCostWindowMs?: number;
  cadenceMs?: number;
  /** Extra cadence intervals tolerated before a miss counts (default 0). */
  cadenceGrace?: number;
}

export interface DriftInput {
  now: number;
  /** The mission's open run, if any. */
  operation?: { status: string; lastActivityAt?: number | null } | null;
  /** When the mission last completed a task (ms epoch), if ever. */
  lastCompletionAt?: number | null;
  /** When the mission last started a run (ms epoch), if ever. */
  lastRunAt?: number | null;
  /** Mission spend to date; a rising-cost signal needs spend to be non-zero. */
  spent?: number;
}

export interface DriftResult {
  drifted: boolean;
  signals: DriftSignal[];
}

function positiveNumber(v: unknown): number | undefined {
  return typeof v === "number" && Number.isFinite(v) && v > 0 ? v : undefined;
}

/** Parse the drift policy out of a mission's policy JSON. `null` = not monitored. */
export function resolveDriftPolicy(policyJson: string | null | undefined): DriftPolicy | null {
  let parsed: any = {};
  if (policyJson) {
    try {
      parsed = JSON.parse(policyJson);
    } catch {
      return null;
    }
  }
  const drift = parsed?.drift ?? {};
  const stallMs = positiveNumber(drift.stallMs);
  const risingCostWindowMs = positiveNumber(drift.risingCostWindowMs);
  const cadenceMs = positiveNumber(drift.cadenceMs);
  const cadenceGrace = positiveNumber(drift.cadenceGrace);

  if (stallMs === undefined && risingCostWindowMs === undefined && cadenceMs === undefined) {
    return null;
  }
  return {
    ...(stallMs !== undefined ? { stallMs } : {}),
    ...(risingCostWindowMs !== undefined ? { risingCostWindowMs } : {}),
    ...(cadenceMs !== undefined ? { cadenceMs } : {}),
    ...(cadenceGrace !== undefined ? { cadenceGrace } : {}),
  };
}

/** Pure drift detection. Returns the signals that fired (empty = not drifting). */
export function detectDrift(input: DriftInput, policy: DriftPolicy | null): DriftResult {
  const signals: DriftSignal[] = [];
  if (!policy) return { drifted: false, signals };

  // 1. A run that is RUNNING but has gone quiet.
  if (
    policy.stallMs !== undefined &&
    input.operation?.status === "RUNNING" &&
    input.operation.lastActivityAt != null &&
    input.now - input.operation.lastActivityAt > policy.stallMs
  ) {
    signals.push("stalled");
  }

  // 2. Cost rising with no new completions.
  if (
    policy.risingCostWindowMs !== undefined &&
    (input.spent ?? 0) > 0 &&
    input.lastCompletionAt != null &&
    input.now - input.lastCompletionAt > policy.risingCostWindowMs
  ) {
    signals.push("rising_cost");
  }

  // 3. Missed cadence by more than the tolerated intervals.
  if (policy.cadenceMs !== undefined && input.lastRunAt != null) {
    const tolerated = policy.cadenceMs * (1 + (policy.cadenceGrace ?? 0));
    if (input.now - input.lastRunAt > tolerated) signals.push("missed_cadence");
  }

  return { drifted: signals.length > 0, signals };
}
