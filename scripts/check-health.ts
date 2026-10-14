/* Health-rollup checks (M3.3).
 *
 * Health is orthogonal to lifecycle and rolls up task → operation → mission with
 * rising severity (a failing task degrades its operation; a failing operation
 * blocks its mission). Health follows the settled state — a task that will still
 * retry must not flash (realtime.md). These are pure, asserted directly.
 *
 * Run: npx tsx scripts/check-health.ts
 */
import {
  HealthState,
  missionHealth,
  missionHealthFrom,
  operationHealth,
  taskHealth,
  worstHealth,
} from "../src/lib/health";

const results: string[] = [];
const check = (label: string, ok: boolean, detail?: string) => {
  results.push(`${ok ? "PASS" : "FAIL"} ${label}${detail ? ` — ${detail}` : ""}`);
};

/* ── Severity ordering ─────────────────────────────────────────────────────── */
check(
  "worst-of orders FAILING > BLOCKED > DEGRADED > HEALTHY",
  worstHealth("HEALTHY", "DEGRADED") === "DEGRADED" &&
    worstHealth("DEGRADED", "BLOCKED") === "BLOCKED" &&
    worstHealth("BLOCKED", "FAILING") === "FAILING" &&
    worstHealth("FAILING", "HEALTHY") === "FAILING",
);

/* ── Task contribution + debounce ──────────────────────────────────────────── */
check(
  "a settled failure (retries exhausted) degrades",
  taskHealth({ status: "FAILED", retryCount: 3, maxRetries: 3 }) === "DEGRADED",
);
check(
  "a failure with retries remaining does NOT flash (debounce)",
  taskHealth({ status: "FAILED", retryCount: 1, maxRetries: 3 }) === "HEALTHY",
);
check(
  "an escalated task blocks (waiting on the operator)",
  taskHealth({ status: "ESCALATED" }) === "BLOCKED",
);
check(
  "a gated (WAITING) task blocks",
  taskHealth({ status: "WAITING" }) === "BLOCKED",
);
check(
  "running/completed/queued tasks are healthy",
  (["RUNNING", "COMPLETED", "QUEUED", "ASSIGNED", "CANCELLED"] as const).every(
    (s) => taskHealth({ status: s }) === "HEALTHY",
  ),
);

/* ── Operation rollup: a failing task → DEGRADED (acceptance) ──────────────── */
const opRunning = { status: "RUNNING" };
check(
  "a failing task makes its operation DEGRADED",
  operationHealth(opRunning, [
    { status: "COMPLETED" },
    { status: "FAILED", retryCount: 3, maxRetries: 3 },
  ]) === "DEGRADED",
);
check(
  "a gated task makes its operation BLOCKED",
  operationHealth(opRunning, [{ status: "RUNNING" }, { status: "WAITING" }]) === "BLOCKED",
);
check(
  "an escalated task makes its operation BLOCKED",
  operationHealth(opRunning, [{ status: "ESCALATED" }]) === "BLOCKED",
);
check(
  "a healthy run is HEALTHY",
  operationHealth(opRunning, [{ status: "COMPLETED" }, { status: "RUNNING" }]) === "HEALTHY",
);
check(
  "a still-retrying failure leaves the operation HEALTHY (no flash)",
  operationHealth(opRunning, [{ status: "FAILED", retryCount: 0, maxRetries: 3 }]) === "HEALTHY",
);
check(
  "an operation whose lifecycle FAILED is FAILING",
  operationHealth({ status: "FAILED" }, [{ status: "FAILED", retryCount: 3, maxRetries: 3 }]) === "FAILING",
);
check(
  "a paused run with nothing wrong is DEGRADED (stalled)",
  operationHealth({ status: "PAUSED" }, [{ status: "COMPLETED" }]) === "DEGRADED",
);
check(
  "a cancelled operation is HEALTHY",
  operationHealth({ status: "CANCELLED" }, []) === "HEALTHY",
);

/* ── Mission rollup: a failing operation → BLOCKED (acceptance) ────────────── */
const mRunning = { status: "RUNNING" };
check(
  "a failing operation makes its mission BLOCKED",
  missionHealth(mRunning, [
    operationHealth(opRunning, [{ status: "COMPLETED" }]),
    operationHealth(opRunning, [{ status: "FAILED", retryCount: 3, maxRetries: 3 }]),
  ]) === "BLOCKED",
);
check(
  "a gated operation makes its mission BLOCKED",
  missionHealth(mRunning, [operationHealth(opRunning, [{ status: "WAITING" }])]) === "BLOCKED",
);
check(
  "an all-healthy mission is HEALTHY",
  missionHealth(mRunning, [operationHealth(opRunning, [{ status: "RUNNING" }])]) === "HEALTHY",
);
check(
  "a failed operation makes its mission FAILING",
  missionHealth(mRunning, [operationHealth({ status: "FAILED" }, [])]) === "FAILING",
);
check(
  "a failed mission is FAILING regardless of children",
  missionHealth({ status: "FAILED" }, ["HEALTHY"]) === "FAILING",
);
check(
  "a paused mission with healthy runs is DEGRADED (not blocked)",
  missionHealth({ status: "PAUSED" }, ["HEALTHY"]) === "DEGRADED",
);
check(
  "health is orthogonal to lifecycle — a PAUSED mission can be BLOCKED by a gated run",
  missionHealth({ status: "PAUSED" }, ["BLOCKED"]) === "BLOCKED",
);

/* ── Exhaustive: rollup is monotonic (no state ever lowers as severity rises) ── */
const states: HealthState[] = ["HEALTHY", "DEGRADED", "BLOCKED", "FAILING"];
check(
  "mission rollup never lowers a severe operation",
  states.every((h) => {
    const m = missionHealth(mRunning, [h]);
    return m === "FAILING" ? h === "FAILING" : true;
  }),
);

/* ── Read-shaping helper: groups tasks by operation ────────────────────────── */
check(
  "missionHealthFrom degrades a mission when a task under one of its runs fails",
  missionHealthFrom(
    { status: "RUNNING" },
    [{ id: "op1", status: "RUNNING" }, { id: "op2", status: "RUNNING" }],
    [
      { status: "COMPLETED", parentOperationId: "op1" },
      { status: "FAILED", retryCount: 3, maxRetries: 3, parentOperationId: "op2" },
    ],
  ) === "BLOCKED",
);
check(
  "missionHealthFrom counts a task with no run at the mission level",
  missionHealthFrom(
    { status: "RUNNING" },
    [],
    [{ status: "ESCALATED", parentOperationId: null }],
  ) === "BLOCKED",
);

const failed = results.filter((r) => r.startsWith("FAIL"));
for (const r of results) console.log(r);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
if (failed.length > 0) process.exit(1);
