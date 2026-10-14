/**
 * Approval policy — the intervention contract, as pure data (M3.1).
 *
 * The set of things the Brain must ask for is fixed by the product
 * (docs/product/permissions.md §4). A gate is a real blocking stop, not a
 * notification, so the *kind* of intervention decides two things that are worth
 * testing in isolation rather than inferring from an integration run:
 *
 *   - its default pause scope (D29): an execution-level gate stops the affected
 *     operation; a mission-wide signal stops the whole mission;
 *   - what a denial means (E10): some gates deny *the capability* (the work
 *     continues without it, recorded), others deny *the work itself* (the
 *     affected scope is rolled back cleanly).
 */

export const INTERVENTION_TRIGGERS = [
  "TOOL_PERMISSION", // a new tool permission is required — the trust boundary
  "SPEND_CEILING", // a mission spending ceiling would be breached
  "MODEL_FALLBACK", // a model fallback outside the mission's policy
  "DRIFT", // the mission has drifted off its cadence
  "SPAWN_CEILING", // the workforce would scale past its spawn ceiling
  "ESCALATION", // the Brain cannot resolve something — the catch-all
] as const;

export type InterventionTrigger = (typeof INTERVENTION_TRIGGERS)[number];

export type ApprovalScope = "OPERATION" | "MISSION";

export type ApprovalStatus = "PENDING" | "APPROVED" | "DENIED";

export type ApprovalDecision = "APPROVE" | "DENY";

export function isInterventionTrigger(value: unknown): value is InterventionTrigger {
  return typeof value === "string" && (INTERVENTION_TRIGGERS as readonly string[]).includes(value);
}

/**
 * Default pause scope per trigger (D29/D51). Execution-level gates pause only
 * the affected operation, so unrelated missions keep running (E6). Signals that
 * are inherently about the mission as a whole pause the mission.
 */
export const DEFAULT_SCOPE: Record<InterventionTrigger, ApprovalScope> = {
  TOOL_PERMISSION: "OPERATION",
  SPEND_CEILING: "OPERATION",
  MODEL_FALLBACK: "OPERATION",
  DRIFT: "MISSION",
  SPAWN_CEILING: "OPERATION",
  ESCALATION: "MISSION",
};

export function triggerDefaultScope(trigger: InterventionTrigger): ApprovalScope {
  return DEFAULT_SCOPE[trigger];
}

/**
 * What a denial means (E10/D52). Blocking triggers deny the work — the affected
 * scope is cancelled cleanly, never a silent failure. Capability triggers deny
 * only the requested capability; the work continues without it, and the refusal
 * is recorded on the approval.
 */
export const DENY_CANCELS_SCOPE: Record<InterventionTrigger, boolean> = {
  TOOL_PERMISSION: false,
  SPEND_CEILING: true,
  MODEL_FALLBACK: true,
  DRIFT: true,
  SPAWN_CEILING: false,
  ESCALATION: true,
};

export function denyCancelsScope(trigger: InterventionTrigger): boolean {
  return DENY_CANCELS_SCOPE[trigger];
}

export function statusForDecision(decision: ApprovalDecision): ApprovalStatus {
  return decision === "APPROVE" ? "APPROVED" : "DENIED";
}

/**
 * E8 — work stays paused until *all* blocking gates for a scope are resolved.
 * Given how many PENDING approvals remain for the scope (excluding the one just
 * resolved), report whether the scope may resume.
 */
export function scopeCanResume(remainingPending: number): boolean {
  return remainingPending <= 0;
}

/** Task statuses that count as "still in flight" for pause/deny purposes. */
export const NON_TERMINAL_TASK_STATUSES = ["QUEUED", "ASSIGNED", "RUNNING", "WAITING"] as const;
