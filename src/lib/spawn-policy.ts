/**
 * Spawn policy — the per-mission spawn ceiling and scoped permission inheritance.
 *
 * Two rules keep the fleet bounded and honest:
 *
 * 1. **Ceiling** (E12): a mission may only spawn so many sub-agents. The default
 *    lives here; a mission can override it via `Mission.policy` (`spawnCeiling`).
 *    The operator-facing config surface is a later milestone (Policies & Limits).
 * 2. **Scoped inheritance**: a sub-agent holds **≤** its parent's grants. A child
 *    inherits the parent's grants when it asks for nothing, and anything it
 *    explicitly requests that the parent lacks is denied (dropped and recorded).
 *
 * Kept pure so both the engine and the unit check can use it without a database.
 */

export const DEFAULT_MISSION_SPAWN_CEILING = 5;

/** Resolve a mission's spawn ceiling: policy override, else the default. */
export function resolveSpawnCeiling(policyJson: string | null | undefined): number {
  if (!policyJson) return DEFAULT_MISSION_SPAWN_CEILING;
  try {
    const parsed = JSON.parse(policyJson);
    const n = parsed?.spawnCeiling;
    if (typeof n === "number" && Number.isFinite(n) && n >= 0) return Math.floor(n);
  } catch {
    /* fall through to the default */
  }
  return DEFAULT_MISSION_SPAWN_CEILING;
}

/**
 * Intersect a child's requested grants with its parent's. Returns the grants the
 * child may hold (the subset the parent also holds) and the ones denied because
 * the parent lacks them. Order is preserved; duplicates collapse.
 */
export function intersectGrants(
  requested: string[],
  parent: string[],
): { allowed: string[]; denied: string[] } {
  const allowed: string[] = [];
  const denied: string[] = [];
  for (const grant of requested) {
    if (parent.includes(grant)) {
      if (!allowed.includes(grant)) allowed.push(grant);
    } else if (!denied.includes(grant)) {
      denied.push(grant);
    }
  }
  return { allowed, denied };
}
