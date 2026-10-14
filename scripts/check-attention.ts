/* Attention-queue checks (M4.1).
 *
 * The Control Center's "Needs you" queue is derived, not stored. These lock the
 * ranking (severity, then longest-waiting) and the dedupe (a gated mission is
 * shown as its gate, not twice).
 *
 * Run: npx tsx scripts/check-attention.ts
 */
import { buildAttentionQueue } from "../src/lib/attention";

const results: string[] = [];
const check = (label: string, ok: boolean, detail?: unknown) => {
  results.push(`${ok ? "PASS" : "FAIL"} ${label}${ok ? "" : ` — ${JSON.stringify(detail)}`}`);
};

const NOW = 1_000_000_000;

check("no data → empty queue", buildAttentionQueue({ now: NOW }).length === 0);

/* ── approvals: blocking outranks capability ───────────────────────────────── */
const queue = buildAttentionQueue({
  now: NOW,
  approvals: [
    { id: "cap", trigger: "TOOL_PERMISSION", status: "PENDING", createdAt: new Date(NOW - 1000).toISOString(), missionId: "mX" },
    { id: "blk", trigger: "SPEND_CEILING", status: "PENDING", createdAt: new Date(NOW - 2000).toISOString(), missionId: "mY" },
  ],
});
check("both gates appear", queue.length === 2);
check("the blocking gate ranks first (critical)", queue[0]?.approvalId === "blk" && queue[0]?.severity === 0, queue.map((q) => q.approvalId));
check("the capability gate is High", queue[1]?.severity === 1 && queue[1]?.severityLabel === "High");
check("resolved approvals are ignored", buildAttentionQueue({
  now: NOW,
  approvals: [{ id: "x", trigger: "ESCALATION", status: "APPROVED", createdAt: new Date(NOW).toISOString() }],
}).length === 0);

/* ── longest-waiting first within a severity ───────────────────────────────── */
const wait = buildAttentionQueue({
  now: NOW,
  approvals: [
    { id: "young", trigger: "DRIFT", status: "PENDING", createdAt: new Date(NOW - 60_000).toISOString(), missionId: "m1" },
    { id: "old", trigger: "DRIFT", status: "PENDING", createdAt: new Date(NOW - 3_600_000).toISOString(), missionId: "m2" },
  ],
});
check("same severity → oldest waiting first", wait[0]?.approvalId === "old", wait.map((q) => q.approvalId));

/* ── mission health mapping + dedupe ───────────────────────────────────────── */
const missions = buildAttentionQueue({
  now: NOW,
  approvals: [{ id: "a", trigger: "ESCALATION", status: "PENDING", createdAt: new Date(NOW).toISOString(), missionId: "m-blocked" }],
  missions: [
    { id: "m-blocked", goal: "Blocked mission", status: "RUNNING", health: "BLOCKED", updatedAt: new Date(NOW).toISOString() },
    { id: "m-failing", goal: "Failing mission", status: "RUNNING", health: "FAILING", updatedAt: new Date(NOW - 1000).toISOString(), tasks: [{ status: "COMPLETED" }, { status: "RUNNING" }] },
    { id: "m-degraded", goal: "Degraded mission", status: "PAUSED", health: "DEGRADED", updatedAt: new Date(NOW - 1000).toISOString() },
    { id: "m-healthy", goal: "Fine", status: "RUNNING", health: "HEALTHY", updatedAt: new Date(NOW).toISOString() },
  ],
});
check("a gated mission is not listed twice", !missions.some((q) => q.kind === "mission" && q.missionId === "m-blocked"));
check("healthy missions are not queued", !missions.some((q) => q.missionId === "m-healthy"));
check("a FAILING mission is critical", missions.find((q) => q.missionId === "m-failing")?.severity === 0);
check("a DEGRADED mission is Medium", missions.find((q) => q.missionId === "m-degraded")?.severity === 2);
check("mission detail carries progress", /1\/2 complete/.test(missions.find((q) => q.missionId === "m-failing")?.detail || ""));

/* ── unknown trigger is treated as the blocking catch-all ──────────────────── */
const unknown = buildAttentionQueue({
  now: NOW,
  approvals: [{ id: "u", trigger: "SOMETHING_NEW", status: "PENDING", createdAt: new Date(NOW).toISOString(), missionId: "m" }],
});
check("an unknown trigger falls back to ESCALATION (blocking)", unknown[0]?.severity === 0);

/* ── stable ids and hrefs ──────────────────────────────────────────────────── */
check("approval items are namespaced", queue[0]?.id.startsWith("approval-"));
check("a mission item links to the mission detail", missions.find((q) => q.missionId === "m-failing")?.href === "/missions/m-failing");

const failed = results.filter((r) => r.startsWith("FAIL"));
for (const r of results) console.log(r);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
if (failed.length > 0) process.exit(1);
