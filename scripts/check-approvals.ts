/* Approval-policy checks (M3.1).
 *
 * The intervention contract (docs/product/permissions.md §4) fixes six trigger
 * types, each with a default pause scope (D29) and a denial meaning (E10).
 * These are pure, so every edge is asserted directly rather than inferred from
 * an integration run.
 *
 * Run: npx tsx scripts/check-approvals.ts
 */
import {
  INTERVENTION_TRIGGERS,
  isInterventionTrigger,
  triggerDefaultScope,
  denyCancelsScope,
  statusForDecision,
  scopeCanResume,
} from "../src/lib/approval-policy";

const results: string[] = [];
const check = (label: string, ok: boolean, detail?: string) => {
  results.push(`${ok ? "PASS" : "FAIL"} ${label}${detail ? ` — ${detail}` : ""}`);
};

/* ── The intervention set ──────────────────────────────────────────────────── */
check(
  "there are exactly six intervention triggers",
  INTERVENTION_TRIGGERS.length === 6,
  INTERVENTION_TRIGGERS.join(", "),
);

check(
  "the six triggers are the product's intervention set",
  ["TOOL_PERMISSION", "SPEND_CEILING", "MODEL_FALLBACK", "DRIFT", "SPAWN_CEILING", "ESCALATION"].every(
    (t) => (INTERVENTION_TRIGGERS as readonly string[]).includes(t),
  ),
);

check(
  "an unknown string is not a trigger",
  !isInterventionTrigger("PAYMENT") && !isInterventionTrigger("") && !isInterventionTrigger(42),
);

check(
  "a known trigger is recognised",
  isInterventionTrigger("SPAWN_CEILING") && isInterventionTrigger("ESCALATION"),
);

/* ── Default pause scope (D29/D51) ─────────────────────────────────────────── */
check(
  "execution-level gates default to the operation",
  triggerDefaultScope("TOOL_PERMISSION") === "OPERATION" &&
    triggerDefaultScope("SPEND_CEILING") === "OPERATION" &&
    triggerDefaultScope("MODEL_FALLBACK") === "OPERATION" &&
    triggerDefaultScope("SPAWN_CEILING") === "OPERATION",
);

check(
  "mission-wide signals default to the mission",
  triggerDefaultScope("DRIFT") === "MISSION" && triggerDefaultScope("ESCALATION") === "MISSION",
);

/* ── Denial meaning (E10/D52) ──────────────────────────────────────────────── */
check(
  "blocking gates deny the work (cancel the scope)",
  denyCancelsScope("SPEND_CEILING") &&
    denyCancelsScope("MODEL_FALLBACK") &&
    denyCancelsScope("DRIFT") &&
    denyCancelsScope("ESCALATION"),
);

check(
  "capability gates deny only the capability, work continues",
  !denyCancelsScope("TOOL_PERMISSION") && !denyCancelsScope("SPAWN_CEILING"),
);

/* ── Resolution ────────────────────────────────────────────────────────────── */
check(
  "decision maps to a terminal status",
  statusForDecision("APPROVE") === "APPROVED" && statusForDecision("DENY") === "DENIED",
);

check(
  "E8 — a scope resumes only when no blocking gates remain",
  scopeCanResume(0) && !scopeCanResume(1) && !scopeCanResume(2),
);

const failed = results.filter((r) => r.startsWith("FAIL"));
for (const r of results) console.log(r);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
if (failed.length > 0) process.exit(1);
