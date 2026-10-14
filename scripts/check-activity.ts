/* Activity (M4.4) helper checks.
 *
 * The Activity surfaces sort and format runs in pure functions (`src/lib/activity.ts`)
 * precisely so the ordering contract — worst health first, then most recent — is
 * asserted here and not re-derived inside a React component. A run that is FAILING
 * must outrank a HEALTHY one; a still-open run must not claim a duration.
 *
 * Run: npx tsx scripts/check-activity.ts
 */
import {
  isTerminalRun,
  runAttentionRank,
  sortRunsByAttention,
  runDurationMs,
  runTaskCount,
} from "../src/lib/activity";

const results: string[] = [];
const check = (label: string, ok: boolean, detail?: string) => {
  results.push(`${ok ? "PASS" : "FAIL"} ${label}${detail ? ` — ${detail}` : ""}`);
};

/* ── Health ranking ─────────────────────────────────────────────────────────── */
check(
  "health ranks from FAILING down to HEALTHY",
  runAttentionRank({ health: "FAILING" }) > runAttentionRank({ health: "BLOCKED" }) &&
    runAttentionRank({ health: "BLOCKED" }) > runAttentionRank({ health: "DEGRADED" }) &&
    runAttentionRank({ health: "DEGRADED" }) > runAttentionRank({ health: "HEALTHY" }),
  "FAILING > BLOCKED > DEGRADED > HEALTHY"
);
check(
  "unknown or missing health ranks as healthy",
  runAttentionRank({ health: "WEIRD" }) === 0 &&
    runAttentionRank({}) === 0 &&
    runAttentionRank(null) === 0,
  "unknown -> 0"
);

/* ── Ordering ───────────────────────────────────────────────────────────────── */
const runs = [
  { id: "a", health: "HEALTHY", createdAt: "2024-01-01T00:00:00Z" },
  { id: "b", health: "FAILING", createdAt: "2023-12-01T00:00:00Z" },
  { id: "c", health: "DEGRADED", createdAt: "2024-02-01T00:00:00Z" },
  { id: "d", health: "HEALTHY", createdAt: "2024-03-01T00:00:00Z" },
];
const ordered = sortRunsByAttention(runs).map((r) => r.id);
check(
  "worst health first, then most recent",
  JSON.stringify(ordered) === JSON.stringify(["b", "c", "d", "a"]),
  ordered.join(",")
);
check(
  "sorting does not mutate the input",
  runs.map((r) => r.id).join(",") === "a,b,c,d",
  runs.map((r) => r.id).join(",")
);
const tie = sortRunsByAttention([
  { id: "z", health: "HEALTHY", createdAt: "2024-01-01T00:00:00Z" },
  { id: "y", health: "HEALTHY", createdAt: "2024-01-01T00:00:00Z" },
]).map((r) => r.id);
check("ties break stably by id", tie.join(",") === "y,z", tie.join(","));

/* ── Terminality ────────────────────────────────────────────────────────────── */
check(
  "terminal run statuses are recognised case-insensitively",
  isTerminalRun("COMPLETED") && isTerminalRun("failed") && isTerminalRun("CANCELLED") && !isTerminalRun("RUNNING") && !isTerminalRun("PAUSED") && !isTerminalRun(null),
  "COMPLETED/FAILED/CANCELLED terminal; RUNNING/PAUSED not"
);

/* ── Duration ───────────────────────────────────────────────────────────────── */
check(
  "an open run reports no duration",
  runDurationMs({ startedAt: "2024-01-01T00:00:00Z", completedAt: null }) === null &&
    runDurationMs({ startedAt: null }) === null &&
    runDurationMs({}) === null,
  "no completion -> null"
);
check(
  "a settled run reports its elapsed time",
  runDurationMs({ startedAt: "2024-01-01T00:00:00Z", completedAt: "2024-01-01T00:01:30Z" }) === 90000,
  "90s -> 90000ms"
);
check(
  "a clock skew never yields a negative duration",
  runDurationMs({ startedAt: "2024-01-01T00:01:00Z", completedAt: "2024-01-01T00:00:00Z" }) === 0,
  "clamped to 0"
);

/* ── Task count ─────────────────────────────────────────────────────────────── */
check(
  "task count is the run's task list length, never a crash",
  runTaskCount({ tasks: [1, 2, 3] }) === 3 && runTaskCount({}) === 0 && runTaskCount(null) === 0,
  "3 / 0 / 0"
);

const failed = results.filter((r) => r.startsWith("FAIL"));
console.log(results.join("\n"));
console.log(`\n${results.length - failed.length}/${results.length} passed`);
if (failed.length > 0) process.exit(1);
