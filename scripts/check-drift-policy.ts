/* Drift-policy checks (M3.4, E16/Q2).
 *
 * Drift is opt-in: each signal is off unless the policy switches it on, so no
 * threshold is invented. A drifted mission raises a DRIFT gate (mission scope).
 *
 * Run: npx tsx scripts/check-drift-policy.ts
 */
import { resolveDriftPolicy, detectDrift } from "../src/lib/drift-policy";

const results: string[] = [];
const check = (label: string, ok: boolean, detail?: string) => {
  results.push(`${ok ? "PASS" : "FAIL"} ${label}${detail ? ` — ${detail}` : ""}`);
};

const NOW = 1_000_000_000;

/* ── Resolution: opt-in ────────────────────────────────────────────────────── */
check("no policy → not monitored (null)", resolveDriftPolicy(null) === null);
check("empty policy → not monitored", resolveDriftPolicy("{}") === null);
check("malformed JSON → not monitored", resolveDriftPolicy("{ nope") === null);
check("a threshold is required to enable", resolveDriftPolicy('{"drift":{"grace":1}}') === null);
check(
  "reads the thresholds",
  (() => {
    const p = resolveDriftPolicy('{"drift":{"stallMs":60000,"risingCostWindowMs":90000,"cadenceMs":3600000,"cadenceGrace":1}}');
    return p?.stallMs === 60000 && p?.risingCostWindowMs === 90000 && p?.cadenceMs === 3600000 && p?.cadenceGrace === 1;
  })(),
);

/* ── stalled ───────────────────────────────────────────────────────────────── */
const stall = resolveDriftPolicy('{"drift":{"stallMs":60000}}');
check("no policy → never drifts", detectDrift({ now: NOW }, null).drifted === false);
check(
  "a quiet RUNNING run past stallMs → stalled",
  (() => {
    const d = detectDrift({ now: NOW, operation: { status: "RUNNING", lastActivityAt: NOW - 61000 } }, stall);
    return d.drifted && d.signals.includes("stalled");
  })(),
);
check(
  "a run active within stallMs → no drift",
  detectDrift({ now: NOW, operation: { status: "RUNNING", lastActivityAt: NOW - 1000 } }, stall).drifted === false,
);
check(
  "a non-RUNNING operation never stalls",
  detectDrift({ now: NOW, operation: { status: "PAUSED", lastActivityAt: NOW - 999999 } }, stall).drifted === false,
);

/* ── rising_cost ───────────────────────────────────────────────────────────── */
const rising = resolveDriftPolicy('{"drift":{"risingCostWindowMs":90000}}');
check(
  "spend with no completion past the window → rising_cost",
  (() => {
    const d = detectDrift({ now: NOW, lastCompletionAt: NOW - 100000, spent: 0.5 }, rising);
    return d.drifted && d.signals.includes("rising_cost");
  })(),
);
check(
  "rising_cost needs spend > 0",
  detectDrift({ now: NOW, lastCompletionAt: NOW - 100000, spent: 0 }, rising).drifted === false,
);
check(
  "a recent completion suppresses rising_cost",
  detectDrift({ now: NOW, lastCompletionAt: NOW - 1000, spent: 0.5 }, rising).drifted === false,
);

/* ── missed_cadence ────────────────────────────────────────────────────────── */
const cadence = resolveDriftPolicy('{"drift":{"cadenceMs":3600000}}');
check(
  "no run within the cadence → missed_cadence",
  (() => {
    const d = detectDrift({ now: NOW, lastRunAt: NOW - 3700000 }, cadence);
    return d.drifted && d.signals.includes("missed_cadence");
  })(),
);
check(
  "grace tolerates extra intervals",
  (() => {
    const p = resolveDriftPolicy('{"drift":{"cadenceMs":3600000,"cadenceGrace":1}}');
    // 1.5 intervals late is within the 2-interval tolerance.
    return detectDrift({ now: NOW, lastRunAt: NOW - 5400000 }, p).drifted === false;
  })(),
);
check(
  "cadence needs a lastRunAt to judge",
  detectDrift({ now: NOW, lastRunAt: null }, cadence).drifted === false,
);

/* ── multiple signals ──────────────────────────────────────────────────────── */
check(
  "several signals can fire together",
  (() => {
    const p = resolveDriftPolicy('{"drift":{"stallMs":60000,"risingCostWindowMs":90000,"cadenceMs":3600000}}');
    const d = detectDrift(
      { now: NOW, operation: { status: "RUNNING", lastActivityAt: NOW - 120000 }, lastCompletionAt: NOW - 120000, spent: 1, lastRunAt: NOW - 7200000 },
      p,
    );
    return d.signals.length === 3;
  })(),
);

const failed = results.filter((r) => r.startsWith("FAIL"));
for (const r of results) console.log(r);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
if (failed.length > 0) process.exit(1);
