/* Missions-surface checks (M4.2).
 *
 * The Missions list is ordered "needs attention first" (worst health, then
 * running, then the rest, terminal last). Cadence and next-run read from the
 * mission's own cadence and its linked ACTIVE triggers. None of this invents a
 * schedule: no cadence and no trigger = "Manual".
 *
 * Run: npx tsx scripts/check-missions.ts
 */
import {
  missionAttentionRank,
  sortMissionsByAttention,
  formatCadence,
  activeTriggers,
  triggerCount,
  missionNextRun,
  missionLastTriggerRun,
  isScheduled,
  isTerminalMission,
  type MissionInput,
} from "../src/lib/missions";

const results: string[] = [];
const check = (label: string, ok: boolean, detail?: unknown) => {
  results.push(`${ok ? "PASS" : "FAIL"} ${label}${ok ? "" : ` — ${JSON.stringify(detail)}`}`);
};

const ISO = (ms: number) => new Date(ms).toISOString();
const NOW = 2_000_000_000_000;

/* ── terminal detection ────────────────────────────────────────────────────── */
check("COMPLETED is terminal", isTerminalMission("COMPLETED"));
check("RUNNING is not terminal", !isTerminalMission("RUNNING"));

/* ── attention ranking ─────────────────────────────────────────────────────── */
check("FAILING ranks first", missionAttentionRank({ id: "a", status: "RUNNING", health: "FAILING" }) === 0);
check("BLOCKED ranks second", missionAttentionRank({ id: "a", status: "RUNNING", health: "BLOCKED" }) === 1);
check("DEGRADED ranks third", missionAttentionRank({ id: "a", status: "PAUSED", health: "DEGRADED" }) === 2);
check("a healthy RUNNING mission ranks fourth", missionAttentionRank({ id: "a", status: "RUNNING", health: "HEALTHY" }) === 3);
check("a healthy non-running open mission ranks fifth", missionAttentionRank({ id: "a", status: "READY", health: "HEALTHY" }) === 4);
check("a COMPLETED mission sinks last", missionAttentionRank({ id: "a", status: "COMPLETED", health: "HEALTHY" }) === 5);

/* ── sorting: rank asc, then newest updated first ──────────────────────────── */
const rows: MissionInput[] = [
  { id: "done", status: "COMPLETED", health: "HEALTHY", updatedAt: ISO(NOW) },
  { id: "run-new", status: "RUNNING", health: "HEALTHY", updatedAt: ISO(NOW) },
  { id: "fail", status: "RUNNING", health: "FAILING", updatedAt: ISO(NOW - 5000) },
  { id: "run-old", status: "RUNNING", health: "HEALTHY", updatedAt: ISO(NOW - 9000) },
];
const sorted = sortMissionsByAttention(rows).map((m) => m.id);
check("worst health first, terminal last", sorted[0] === "fail" && sorted[3] === "done", sorted);
check("within a rank, newest update wins", sorted[1] === "run-new" && sorted[2] === "run-old", sorted);
check("sortMissionsByAttention does not mutate input", rows[0].id === "done");

/* ── cadence formatting ────────────────────────────────────────────────────── */
check("no cadence → Manual", formatCadence(null) === "Manual");
check("empty → Manual", formatCadence("") === "Manual");
check('{"every":"1d"} → "Every 1d"', formatCadence(JSON.stringify({ every: "1d" })) === "Every 1d");
check("everyMinutes → minutes", formatCadence(JSON.stringify({ everyMinutes: 30 })) === "Every 30m");
check("cron passes through", formatCadence(JSON.stringify({ cron: "0 9 * * *" })) === "0 9 * * *");
check("unparseable cadence is shown verbatim, not thrown", formatCadence("hourly") === "hourly");

/* ── triggers ──────────────────────────────────────────────────────────────── */
const triggers = [
  { status: "ACTIVE", nextRun: ISO(NOW + 60_000), lastRun: ISO(NOW - 60_000) },
  { status: "PAUSED", nextRun: ISO(NOW + 1000), lastRun: ISO(NOW - 10_000) },
  { status: "ACTIVE", nextRun: ISO(NOW + 30_000), lastRun: ISO(NOW - 5_000) },
];
check("only ACTIVE triggers count as active", activeTriggers(triggers).length === 2);
check("triggerCount counts all", triggerCount(triggers) === 3);
const next = missionNextRun(triggers);
check("next run ignores paused triggers and takes the earliest active", next?.getTime() === NOW + 30_000, next);
const last = missionLastTriggerRun(triggers);
check("last run is the most recent across all triggers", last?.getTime() === NOW - 5_000, last);
check("no triggers → no next run", missionNextRun([]) === null);
check("a paused-only trigger set has no next run", missionNextRun([{ status: "PAUSED", nextRun: ISO(NOW) }]) === null);

/* ── scheduled ─────────────────────────────────────────────────────────────── */
check("a mission with cadence is scheduled", isScheduled({ id: "a", status: "RUNNING", cadence: JSON.stringify({ every: "1d" }) }));
check("a mission with an ACTIVE trigger is scheduled", isScheduled({ id: "a", status: "RUNNING", automations: triggers }));
check("a bare mission is not scheduled", !isScheduled({ id: "a", status: "RUNNING" }));

const failed = results.filter((r) => r.startsWith("FAIL"));
for (const r of results) console.log(r);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
if (failed.length > 0) process.exit(1);
