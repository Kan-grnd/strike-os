/**
 * Activity (M4.4) — pure presentation helpers for the runs/events/traces
 * surfaces. A **run is an operation** (system-hierarchy §4: "Operation is a run,
 * never a count"), so these read the operation shape the API returns.
 *
 * Kept pure and testable, exactly like `missions.ts`: the list ordering and the
 * duration maths are the things most likely to drift, so they are asserted in
 * `scripts/check-activity.ts` rather than buried in a component.
 */

export type RunHealth = "HEALTHY" | "DEGRADED" | "BLOCKED" | "FAILING";

const HEALTH_RANK: Record<string, number> = {
  FAILING: 3,
  BLOCKED: 2,
  DEGRADED: 1,
  HEALTHY: 0,
};

const TERMINAL_RUN_STATUSES = new Set(["COMPLETED", "FAILED", "CANCELLED"]);

/** A run that has settled — no longer executing. */
export function isTerminalRun(status: unknown): boolean {
  return TERMINAL_RUN_STATUSES.has(String(status ?? "").toUpperCase());
}

/** Higher = needs the operator more. Unknown health is treated as healthy-ish. */
export function runAttentionRank(run: { health?: unknown } | null | undefined): number {
  const h = String(run?.health ?? "").toUpperCase();
  return HEALTH_RANK[h] ?? 0;
}

/** Worst health first, then most recent, then stable by id. Non-mutating. */
export function sortRunsByAttention<T extends { health?: unknown; createdAt?: unknown; id?: unknown }>(
  runs: T[]
): T[] {
  return [...runs].sort((a, b) => {
    const byHealth = runAttentionRank(b) - runAttentionRank(a);
    if (byHealth !== 0) return byHealth;
    const ta = a.createdAt ? new Date(a.createdAt as string).getTime() : 0;
    const tb = b.createdAt ? new Date(b.createdAt as string).getTime() : 0;
    if (tb !== ta) return tb - ta;
    return String(a.id ?? "").localeCompare(String(b.id ?? ""));
  });
}

/** Milliseconds a run took, or null while it is still open (no completion). */
export function runDurationMs(run: {
  startedAt?: unknown;
  completedAt?: unknown;
} | null | undefined): number | null {
  if (!run?.startedAt) return null;
  const start = new Date(run.startedAt as string).getTime();
  if (Number.isNaN(start)) return null;
  const end = run.completedAt ? new Date(run.completedAt as string).getTime() : null;
  if (end == null || Number.isNaN(end)) return null;
  return Math.max(0, end - start);
}

/** The event count a run produced (its tasks), for the runs list column. */
export function runTaskCount(run: { tasks?: unknown[] } | null | undefined): number {
  return Array.isArray(run?.tasks) ? run.tasks.length : 0;
}
