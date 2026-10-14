# Strike OS — Decision Register

Every decision that shapes the product. Statuses:
**CONFIRMED** (operator chose it) · **RECOMMENDED** (proposed, awaiting word) ·
**ASSUMED** (proceeded on; not endorsed) · **OPEN QUESTION**.

Nothing here silently became a requirement. Assumptions are marked and graduate only when
the operator says so.

---

## A. Product identity

| # | Decision | Chosen | Alternatives considered | Why | Affects | Status |
|---|---|---|---|---|---|---|
| D1 | What is Strike OS | An **autonomous workforce** doing 24/7 background work | mission-per-job tool; copilot | The product's reason to be missed is that it works when you're not looking | everything | CONFIRMED |
| D2 | Who operates it | A **solo operator / founder** | team; multi-seat org | Drives the whole control model — one person must run it at a glance | IA, controls, density | CONFIRMED |
| D3 | Core accomplishment | **Direct persistent work, and know it's healthy** | build/manage agents | Defines the two primary surfaces: Missions + Control Center | IA, home page | CONFIRMED |
| D4 | What the Brain is | The **orchestrator** — plans, delegates, supervises, escalates | a label for models/routing; a decorative orb | The model has no meaning without a real orchestrator | hierarchy, execution, nav | CONFIRMED |
| D5 | Specialist vs Agent | A **role distinction** — Specialists own standing domain work | Specialists as agents with a label | Gives standing expertise a real home and a real page | workforce, Marketplace | CONFIRMED |
| D6 | Sub-agents | **Ephemeral** — spawned per task, reaped at end | persistent workers you provision | The workforce scales itself; no provisioning | execution, ceiling | CONFIRMED |

## B. The work model

| # | Decision | Chosen | Alternatives considered | Why | Affects | Status |
|---|---|---|---|---|---|---|
| D7 | The ontology | **Mission persistent · Operation = a run · Task = an atom** | mission=job/run; two levels only | Gives health a rollup path and history a home | data model, health, Activity | CONFIRMED |
| D8 | Automations | **Fold into missions as triggers** | a separate Automations product | Removes a whole orphaned surface; the engines become the scheduling layer | IA, missions, engines | CONFIRMED |
| D9 | How missions are created | **Via the Brain — the operator approves its plan** | form-based manual creation | Matches "direct by intent"; makes the planner real | planner, chat, missions | CONFIRMED |
| D10 | What the topology is | **Live work flow** — what's executing now | a fleet org chart; static architecture diagram | Answers "what is it doing right now" | Workforce → Live | CONFIRMED |
| D11 | Primary surface | **Attention-first control center** | dashboard of KPIs | The operator's job is to know what needs them | home page | CONFIRMED |
| D12 | Persistence | **State + history persist; live flow is ephemeral** | persist everything including animation | Validates the existing TTL/cursor design | realtime, storage | CONFIRMED |

## C. Control & intervention

| # | Decision | Chosen | Alternatives considered | Why | Affects | Status |
|---|---|---|---|---|---|---|
| D13 | What the operator controls | **Mission + policy level — not workers** | full manual control; exceptions-only; policy-only | Matches a time-poor solo operator | permissions, missions | CONFIRMED |
| D14 | What requires intervention | **A defined set: trust, spend, drift, force** (+ Brain escalation) | only on failure; everything; Brain decides | Predictable and auditable | gates, permissions | CONFIRMED |
| D15 | Failure behaviour | **Retry → Brain recovers → escalate** | retry-then-fail; retry forever; fail-fast-ask | Uses the declared recovery policies; doesn't drown the operator | engine, health | CONFIRMED |
| D16 | Approvals | **A real blocking gate — work pauses** | advisory; per-agent tiers; none | The model exists; only the wiring is missing | approvals, engine | CONFIRMED |
| D17 | Spawning | **Policy-bounded, reported live, approval past ceiling** | Brain-only; always-ask; free | Autonomy with a leash; scoped permission inheritance | execution, permissions | CONFIRMED |
| D18 | Real vs simulated | **Always labelled; never disguised** | never simulate; demo mode; keep silent fallback | Silent degradation of a fabricated result is the worst trust defect found | every surface | CONFIRMED |
| D19 | First milestone | **Close the intent → execution loop** | trust first; intervention first; hygiene first | Until intent produces running work, nothing else is real | plan sequencing | CONFIRMED |

## D. IA & structure

| # | Decision | Chosen | Why | Affects | Status |
|---|---|---|---|---|---|
| D20 | Navigation shape | **Five domains:** Control Center · Missions · Workforce · Activity · Settings | Serves direct→verify→intervene instead of infrastructure | `navigation.ts`, all routes | RECOMMENDED |
| D21 | Colony container | **Demote from primary navigation** | One workspace — it adds a level the operator never asked for | nav, routing | RECOMMENDED |
| D22 | Route redirects | **Retire the half-done merge** (`/missions`→`/work` etc.) and the merged `/work` | Root cause of automation-detail-at-workflow-URL bug | `next.config.js`, routes | RECOMMENDED |
| D23 | Naming | **One word: Activity** (kills "Observatory"/"Observability" split) | Vocabulary drift is the audit's core finding | nav, routes | RECOMMENDED |
| D24 | `/routing` | **Rebuild it, or mark it a preview** | Today it is 100% mock and POSTs to a 404 | Settings → Routing | RECOMMENDED |
| D25 | Notification scope | **Gates, escalations, health→FAILING/BLOCKED, system-authored missions only** | Don't cry wolf | notifications | RECOMMENDED |
| D26 | Realtime transport | **Keep cursor polling as the record; fix or remove the SSE stub** | The store already works; a fake stream is worse than none | realtime | RECOMMENDED |
| D27 | Orphaned RUNNING tasks | **Re-queue on boot with a reattempt cap** | Gap today — work can strand | engine, edge cases | RECOMMENDED |
| D28 | Approval resolution | **Idempotent; never auto-expire to approved** | Money and trust | approvals | RECOMMENDED |
| D29 | Pause scope | **Explicit per approval** ("this operation" vs "this mission") | Avoid over/under-stopping | approvals | RECOMMENDED |
| D30 | Specialist uninstall | **Its missions pause and surface for reassignment** | Don't silently orphan standing work | workforce | RECOMMENDED |
| D31 | Duplicate launch | **Idempotent** | Double-clicks must not double-spawn | planner | RECOMMENDED |
| D32 | Cadence timezone | **Explicit timezone; DST-safe** | Don't skip or double a run | scheduling | RECOMMENDED |

## E. Assumptions in force

These are **not** endorsed — they were adopted to keep moving. Veto freely.

| # | Assumption | Status |
|---|---|---|
| D33 | Single-tenant, single operator workspace | ASSUMED |
| D34 | Desktop-first; mobile must not break but is not primary | ASSUMED |
| D35 | English UI | ASSUMED |
| D36 | Keep the Next.js / Prisma / Postgres stack | ASSUMED |
| D37 | Offline = explicit error, not local queuing | ASSUMED |
| D38 | Recovery *within policy* is automatic; outside policy is a gate | ASSUMED |
| D39 | Keep the existing glass design system and radius profiles | ASSUMED |

## G. Decision gates

Two decisions must be settled before the tasks that depend on them. Both have a
recommended default so the building agent is not blocked.

| Gate | Decision | Blocks | Recommended default |
|---|---|---|---|
| **G1** | Mission status vocabulary — code says `READY`/`RUNNING`, spec says `DRAFT`/`ACTIVE` | M1.3 | **Adopt `DRAFT`/`ACTIVE`** and rename in `mission-engine.ts` |
| **G2** | The `RECOMMENDED` IA items (D20–D24) | M4.3 | **Build as proposed** unless vetoed |

## F. Open questions

See [open-questions.md](./open-questions.md) — grouped there with owners.
