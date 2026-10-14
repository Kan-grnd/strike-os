/**
 * Recovery policy (M3.2) — the pure vocabulary for failure recovery.
 *
 * When a task exhausts its bounded retries the Brain recovers it along a fixed
 * ladder, each stage attempted at most once:
 *
 *   reassign → fallback → replacement → escalate
 *
 * `reassign`    hand the task to a different capable agent.
 * `fallback`    switch to the next model in the policy's fallback chain (see
 *               `fallbackDecision` — a model the policy does not list is a gate).
 * `replacement` spawn a replacement sub-agent to finish the work.
 * `escalate`    stop and ask the operator — the terminal, always-available stage.
 *
 * Pure and testable; the DB orchestration lives in `recovery.ts`.
 */

export const RECOVERY_LADDER = ["reassign", "fallback", "replacement"] as const;
export type RecoveryLadderStage = (typeof RECOVERY_LADDER)[number];
export type RecoveryStage = RecoveryLadderStage | "escalate";

const RECOVERY_STAGES: readonly RecoveryStage[] = [...RECOVERY_LADDER, "escalate"];

export interface RecoveryState {
  tried: RecoveryStage[];
  lastError?: string;
}

/** Parse a task's recovery bookkeeping tolerantly. */
export function parseRecoveryState(raw: string | null | undefined): RecoveryState {
  if (!raw) return { tried: [] };
  let obj: unknown;
  try {
    obj = JSON.parse(raw);
  } catch {
    return { tried: [] };
  }
  if (!obj || typeof obj !== "object") return { tried: [] };

  const record = obj as Record<string, unknown>;
  const tried = Array.isArray(record.tried)
    ? record.tried.filter(
        (s): s is RecoveryStage => typeof s === "string" && RECOVERY_STAGES.includes(s as RecoveryStage),
      )
    : [];
  const lastError = typeof record.lastError === "string" ? record.lastError : undefined;
  return { tried, lastError };
}

/** The next stage to attempt: the first untried ladder stage, else `escalate`. */
export function nextRecoveryStage(tried: RecoveryStage[]): RecoveryStage {
  for (const stage of RECOVERY_LADDER) {
    if (!tried.includes(stage)) return stage;
  }
  return "escalate";
}

/** True once every recovery stage has been tried and only escalation remains. */
export function isRecoveryExhausted(tried: RecoveryStage[]): boolean {
  return nextRecoveryStage(tried) === "escalate";
}

/**
 * Record that a stage was attempted, keeping the last error as escalation
 * context. Returns the JSON string to persist back onto the task.
 */
export function recordRecoveryAttempt(
  raw: string | null | undefined,
  stage: RecoveryStage,
  error?: string,
): string {
  const state = parseRecoveryState(raw);
  if (!state.tried.includes(stage)) state.tried.push(stage);
  if (error) state.lastError = error;
  return JSON.stringify(state);
}

/**
 * Decide a model-fallback step.
 *  - `use`  → an in-policy fallback model is available; switch to it silently.
 *  - `gate` → the policy names no usable fallback, so switching models would be
 *             *outside policy* → this must be an operator gate, never a silent swap.
 */
export type FallbackDecision = { action: "use"; model: string } | { action: "gate" };

export function fallbackDecision(
  primary: string,
  fallbackChain: string[],
  alreadyTried: string[] = [],
): FallbackDecision {
  const candidate = fallbackChain.find((m) => m && m !== primary && !alreadyTried.includes(m));
  if (candidate) return { action: "use", model: candidate };
  return { action: "gate" };
}
