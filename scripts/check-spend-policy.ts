/* Spend-policy checks (M3.4, E15).
 *
 * A mission ceiling is opt-in and comes from the policy — no invented default.
 * Crossing a cap gates; approaching it only warns when a warnRatio is declared.
 *
 * Run: npx tsx scripts/check-spend-policy.ts
 */
import { resolveSpendPolicy, spendDecision } from "../src/lib/spend-policy";

const results: string[] = [];
const check = (label: string, ok: boolean, detail?: string) => {
  results.push(`${ok ? "PASS" : "FAIL"} ${label}${detail ? ` — ${detail}` : ""}`);
};

/* ── Resolution: opt-in, no invented default ───────────────────────────────── */
check("no policy → no ceiling (null)", resolveSpendPolicy(null) === null);
check("empty policy → no ceiling", resolveSpendPolicy("{}") === null);
check("malformed JSON → no ceiling", resolveSpendPolicy("{ not json") === null);
check("negative cap ignored", resolveSpendPolicy('{"spend":{"operationCap":-1}}') === null);
check(
  "bare spendCeiling aliases the operation cap",
  resolveSpendPolicy('{"spendCeiling":0.5}')?.operationCap === 0.5,
);
const both = resolveSpendPolicy('{"spend":{"operationCap":0.5,"missionCap":5,"warnRatio":0.8}}');
check("reads operationCap + missionCap + warnRatio", both?.operationCap === 0.5 && both?.missionCap === 5 && both?.warnRatio === 0.8);
check("warnRatio above 1 is dropped", resolveSpendPolicy('{"spend":{"operationCap":1,"warnRatio":2}}')?.warnRatio === undefined);

/* ── Decisions ─────────────────────────────────────────────────────────────── */
const opCap = resolveSpendPolicy('{"spend":{"operationCap":0.1}}');
check("no policy → allow", spendDecision({ policy: null, operationSpent: 999, missionSpent: 999 }).action === "allow");
check(
  "below the operation cap → allow",
  spendDecision({ policy: opCap, operationSpent: 0.05, missionSpent: 0.05 }).action === "allow",
);
check(
  "reaching the operation cap → gate (operation)",
  (() => {
    const d = spendDecision({ policy: opCap, operationSpent: 0.1, missionSpent: 0.1 });
    return d.action === "gate" && d.dimension === "operation" && d.cap === 0.1;
  })(),
);
check(
  "a projected next cost can cross the cap early",
  spendDecision({ policy: opCap, operationSpent: 0.08, missionSpent: 0.08, projectedNext: 0.05 }).action === "gate",
);

const missionCapOnly = resolveSpendPolicy('{"spend":{"missionCap":1}}');
check(
  "mission cap gates cross-run even when the run is fresh",
  (() => {
    const d = spendDecision({ policy: missionCapOnly, operationSpent: 0.05, missionSpent: 1 });
    return d.action === "gate" && d.dimension === "mission";
  })(),
);

// Whichever trips first: with both caps, the operation (tighter) is preferred.
const bothCaps = resolveSpendPolicy('{"spend":{"operationCap":0.1,"missionCap":10}}');
check(
  "both caps breached → operation wins (tighter)",
  (() => {
    const d = spendDecision({ policy: bothCaps, operationSpent: 0.1, missionSpent: 10 });
    return d.action === "gate" && d.dimension === "operation";
  })(),
);

const warnPolicy = resolveSpendPolicy('{"spend":{"operationCap":1,"warnRatio":0.8}}');
check(
  "approaching the cap warns (does not gate)",
  (() => {
    const d = spendDecision({ policy: warnPolicy, operationSpent: 0.85, missionSpent: 0.85 });
    return d.action === "warn" && d.dimension === "operation";
  })(),
);
check(
  "warn fires only when configured — a cap with no warnRatio never warns",
  spendDecision({ policy: opCap, operationSpent: 0.09, missionSpent: 0.09 }).action === "allow",
);

const failed = results.filter((r) => r.startsWith("FAIL"));
for (const r of results) console.log(r);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
if (failed.length > 0) process.exit(1);
