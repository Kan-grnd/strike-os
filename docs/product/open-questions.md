# Strike OS — Open Questions

Deliberately unresolved. Each is a real product decision that does **not** block the first
milestone (closing the intent→execution loop). Grouped by when the answer is needed.

---

## Needed before the control contract ships (milestone 3)

**Q1 — Spending ceiling granularity.** Per operation, per day, per mission-lifetime, or
per period? Default proposal: a mission has a **monthly budget** plus a **per-operation
cap**, whichever trips first. [needs operator]

**Q2 — Drift signals.** Which signals count as "drifting off cadence"? Candidates: missed
cadence by >N intervals; no progress on an operation for >N minutes; cost rising with no
new completions; outputs failing verification. Default proposal: the first three, with
thresholds configurable. [needs operator]

**Q3 — Overlapping operations.** May a mission run a second operation while the previous
is unsettled? Default proposal: **no** — sequential unless the cadence explicitly opts
into concurrency. [recommended default]

**Q4 — Approval-timeout behaviour.** Confirmed that an unanswered approval does *not*
auto-approve. But does it eventually *cancel* the work, or stay paused indefinitely?
Default proposal: stay paused, re-surfaced daily. [recommended default]

## Needed before the workforce ships (milestone 2)

**Q5 — Does the Brain have persistent memory / a persona?** Today `Memory` exists as a
generic store and chat persists both sides. Is the Brain an accumulating entity with its
own learned context, or a stateless orchestrator over shared memory? [needs operator]

**Q6 — May the Brain create missions unattended?** Confirmed it may draft (flagged), and
we allow it to author from triggers/escalations. But may a *trigger* create a mission the
operator never wrote, that then runs before review? Default proposal: **no** — automated
creation always lands as `DRAFT` + review. [recommended default]

**Q7 — Sub-agent permission inheritance depth.** Confirmed scoped subsets. How deep, and
how narrow by default (read-only tools first?)? [needs operator]

## Needed before Activity/observability is final (milestone 4)

**Q8 — Retention.** How long are events, traces and run history kept? Storage cost vs
audit value. Default proposal: 90 days hot, archive beyond. [needs operator]

**Q9 — Cost accounting source of truth.** Provider-reported usage vs locally computed from
token counts (tables are currently hardcoded, `model-gateway.ts:65`). [needs operator]

## Deferred / strategic

**Q10 — Notification channels.** In-app only for now. Desktop, email, push, Slack? [deferred]

**Q11 — Multi-workspace.** One workspace assumed. If a second is ever needed, the
Colony demotion (D21) may reverse. [deferred]

**Q12 — Marketplace depth.** Is Marketplace a curation of first-party bundles, or a real
ecosystem of third-party Specialists? Affects verification/trust design. [deferred]

**Q13 — Voice / ambient input** for the command bar. [deferred]

---

## Resolved (for reference)

- Controllability, intervention set, failure, approvals, spawning, real-vs-simulated,
  first milestone — **all confirmed**; see [decisions.md](./decisions.md) §C.
- Automations, ontology, topology semantics, persistence split — **confirmed**; §B.
