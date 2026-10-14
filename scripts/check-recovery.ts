/* Recovery-policy checks (M3.2).
 *
 * Failure recovery follows a fixed ladder — reassign → fallback → replacement →
 * escalate — each stage at most once (D53). A model fallback the policy does not
 * list is a gate, never a silent swap (D54). These are pure, so every edge is
 * asserted directly.
 *
 * Run: npx tsx scripts/check-recovery.ts
 */
import {
  RECOVERY_LADDER,
  fallbackDecision,
  isRecoveryExhausted,
  nextRecoveryStage,
  parseRecoveryState,
  recordRecoveryAttempt,
} from "../src/lib/recovery-policy";

const results: string[] = [];
const check = (label: string, ok: boolean, detail?: string) => {
  results.push(`${ok ? "PASS" : "FAIL"} ${label}${detail ? ` — ${detail}` : ""}`);
};

/* ── The ladder ────────────────────────────────────────────────────────────── */
check(
  "the ladder is reassign → fallback → replacement, then escalate",
  RECOVERY_LADDER.join(">") === "reassign>fallback>replacement",
  RECOVERY_LADDER.join(" → "),
);

check(
  "an untouched task starts at reassign",
  nextRecoveryStage([]) === "reassign",
);

check(
  "each stage is attempted at most once, in order",
  nextRecoveryStage(["reassign"]) === "fallback" &&
    nextRecoveryStage(["reassign", "fallback"]) === "replacement",
);

check(
  "once every stage is tried, escalate is the terminal stage",
  nextRecoveryStage(["reassign", "fallback", "replacement"]) === "escalate" &&
    isRecoveryExhausted(["reassign", "fallback", "replacement"]),
);

check(
  "trying a stage twice does not advance the ladder",
  nextRecoveryStage(["reassign", "reassign"]) === "fallback",
);

/* ── State bookkeeping ─────────────────────────────────────────────────────── */
check(
  "recovery state parses tolerantly",
  parseRecoveryState("{}").tried.length === 0 &&
    parseRecoveryState(null).tried.length === 0 &&
    parseRecoveryState("not json").tried.length === 0 &&
    parseRecoveryState('{"tried":["reassign"],"lastError":"boom"}').lastError === "boom",
);

check(
  "unknown stages in stored state are dropped",
  parseRecoveryState('{"tried":["reassign","teleport"]}').tried.join(",") === "reassign",
);

check(
  "recording an attempt accumulates and keeps the last error",
  (() => {
    const a = recordRecoveryAttempt("{}", "reassign", "first");
    const b = recordRecoveryAttempt(a, "fallback", "second");
    const s = parseRecoveryState(b);
    return s.tried.join(",") === "reassign,fallback" && s.lastError === "second";
  })(),
);

check(
  "recording a repeated stage does not duplicate it",
  parseRecoveryState(recordRecoveryAttempt(recordRecoveryAttempt("{}", "reassign"), "reassign")).tried
    .length === 1,
);

/* ── Fallback decision (D54) ───────────────────────────────────────────────── */
check(
  "an in-policy fallback is used silently",
  (() => {
    const d = fallbackDecision("gpt-4o", ["claude-sonnet-4", "claude-haiku-4"]);
    return d.action === "use" && d.model === "claude-sonnet-4";
  })(),
);

check(
  "the primary is never chosen as its own fallback",
  (() => {
    const d = fallbackDecision("gpt-4o", ["gpt-4o", "claude-sonnet-4"]);
    return d.action === "use" && d.model === "claude-sonnet-4";
  })(),
);

check(
  "no in-policy fallback → gate, never a silent swap (D54)",
  fallbackDecision("gpt-4o", []).action === "gate",
);

check(
  "a policy listing only the primary → gate",
  fallbackDecision("gpt-4o", ["gpt-4o"]).action === "gate",
);

check(
  "already-tried fallbacks are skipped",
  fallbackDecision("gpt-4o", ["claude-sonnet-4"], ["claude-sonnet-4"]).action === "gate",
);

/* ── NON_TERMINAL includes ESCALATED (D55) ─────────────────────────────────── */
import { NON_TERMINAL_TASK_STATUSES } from "../src/lib/approval-policy";
check(
  "ESCALATED is non-terminal so a gated mission never settles silently (D55)",
  (NON_TERMINAL_TASK_STATUSES as readonly string[]).includes("ESCALATED"),
);

const failed = results.filter((r) => r.startsWith("FAIL"));
for (const r of results) console.log(r);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
if (failed.length > 0) process.exit(1);
