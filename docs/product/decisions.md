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
| D40 | Defer the `Operation` model, `Task.parentOperationId` and a `Task.simulated` column until Postgres is reachable; M1.2/M1.4 read simulation state from the existing `Task.output` JSON | **RESOLVED / SUPERSEDED** — Postgres came up; the model + columns landed in migration `20261014023002` (`13de2e8`) |
| D41 | M1.2 is *materialize-at-start*: `startMission` creates tasks from the stored plan; the UI route `POST /api/missions` creates the plan only | CONFIRMED |
| D42 | Abandoning a plan keeps the mission row as `CANCELLED` (no hard delete, no orphan) — no tasks are ever created | CONFIRMED |
| D43 | M1.3 is *approve-only*: review + approve + launch ship now; hand-editing the plan before approval is deferred | CONFIRMED |
| D44 | `experimental.instrumentationHook` is enabled so `src/instrumentation.ts` runs on boot and starts the task scheduler; without it the whole loop silently never executes (tasks materialize but stay `QUEUED`) | CONFIRMED |
| D45 | M2.1 keeps `computeBrainRuntime` as the *health* aggregate and adds a separate persisted *activity* state (singleton `BrainState`, states idle/planning/delegating/supervising/recovering) emitted as `brain.state.changed` and shown at `/workforce/brain` — health and activity stay distinct signals | CONFIRMED |
| D46 | M2.2 delegation model: the delegation edge is `brain → ownerAgent`; a sub-agent is spawned (gap-fill) only when no existing agent can own a step, parented off a real loaded agent, and reused by later same-type steps. Scope is **delegation + spawn only** — `communication.*` / `verification.*` emitters are deferred to M2.5 (Live)/M3 (recovery) so no fake verifier/communication semantics are invented now | CONFIRMED |
| D47 | M2.3 spawn ceiling + permission scope: the ceiling is a code default (`DEFAULT_MISSION_SPAWN_CEILING = 5`) overridable per mission via `Mission.policy.spawnCeiling` (operator config surface deferred to Policies & Limits); a sub-agent's grants are the **intersection** of its request with its parent's (inherit when it asks for nothing; a requested grant the parent lacks is denied) so a child always holds ≤ its parent. Ceiling enforcement is immediate — refuse the spawn + emit `spawn.denied`, step runs unowned — the blocking gate + pause is built with approvals in M3.1 | CONFIRMED |
| D48 | M2.4 fixes the Specialist Forge in place: the dev-only `specialistsAllowed()` guard is **removed** (it tested a SQLite `dev.db` so deploy/trial 403'd everywhere in practice; deploying a specialist is a normal operator capability). The forge stays at `/architect` and its domain move is deferred to the IA milestone (M4.3). Trial benchmarks run through `MockTaskRunner`, so the trial record is explicitly `simulated: true` and the UI labels it **SIMULATED**. The operator permission-prompt gate is M3.1 | CONFIRMED |
| D49 | M2.5 is verified in place rather than rebuilt: the live work flow already exists at `/topology` (real runtime subscription, transient `delegation.*` edges with a resolvable `brain` node, honest empty state, `CONNECTED/DISCONNECTED/RECONNECTING` per E5). The planned `/workforce/live` is a relocation into the Workforce domain — part of the unconfirmed five-domain IA (G2) — so it is **deferred to M4.3**, not duplicated now | CONFIRMED |
| D50 | M3.1 builds the **generic gate mechanism** (Approval scope links + `m3_approval_scope`, `requestApproval`/`resolveApproval` primitives that support all six intervention triggers, real pause, idempotent resolve) and wires only the two live sources reachable now: **spawn-past-ceiling** (mission-engine) and **new-tool-permission** (tool-fabric). Fallback/escalation auto-wiring lands in M3.2; spend/drift in M3.4 — both call the same primitive. This resolves the acceptance's "six triggers" without pulling two later milestones forward | CONFIRMED |
| D51 | M3.1 pause scope (D29 in practice): **explicit per approval**; execution gates (tool, spend, fallback, spawn) default to `OPERATION`, mission-wide signals (drift, escalation) to `MISSION`. A gated scope is un-schedulable through two race-free means: the task engine skips work in an operation/mission that has a PENDING approval (derived, not just status), and owning agents move to `waiting_for_approval` (which `agentBlockedFromWork` now treats as blocking). Unrelated missions keep running (E6) | CONFIRMED |
| D52 | M3.1 deny semantics (E10, refined per trigger): **blocking** triggers (spend, fallback, drift, escalation) deny *the work* — the affected scope's non-terminal tasks are cancelled and the operation/mission is marked `CANCELLED` as partial; **capability** triggers (tool permission, spawn ceiling) deny only *the capability* — the work continues without it (step unowned / tool refused) and the refusal is recorded on the approval. Resolution is idempotent (first decision wins; a raced second resolve returns the existing outcome, no repeat side effect) and never auto-expires to approved (D28/E9) | CONFIRMED |
| D53 | M3.2 recovery ladder: a task that exhausts its retries is recovered along a fixed ladder — **reassign → fallback → replacement → escalate** — each stage attempted **at most once**, the stages run recorded on `Task.recovery` (`{tried,lastError}`). Work is therefore bounded (`stages × maxRetries`) and a task advances rather than repeating a stage. `reassign` picks another capable agent (same type preferred; never an agent that is itself failed/blocked/paused); no candidate → the stage is marked tried and the ladder moves on. `replacement` spawns a sub-agent honouring the spawn ceiling (at the ceiling → the M3.1 `SPAWN_CEILING` gate) | CONFIRMED |
| D54 | M3.2 model fallback is **in-policy or gated**: if the task/mission policy lists a fallback model the task switches to it silently (warning emitted); if the policy names **no** fallback, switching models would be *outside policy*, so a `MODEL_FALLBACK` gate is raised (task held non-terminal `WAITING`) instead of a silent swap. Approve authorises the default model and re-queues; deny cancels the scope (blocking trigger per D52) | CONFIRMED |
| D55 | M3.2 escalation: when the ladder is exhausted the task ends non-terminal **`ESCALATED`** (never a silent `FAILED`, E2) and an `ESCALATION` gate (scope `MISSION`, D51) is raised carrying the full context (stages tried + last error). `ESCALATED` joins the non-terminal task set, so the mission cannot settle and stays open for the operator. Approve starts a fresh recovery cycle (clears `tried`); deny cancels the scope. Also E3: an orphaned `RUNNING` task is re-queued on boot with a reattempt cap | CONFIRMED |

## G. Decision gates

Two decisions must be settled before the tasks that depend on them. Both have a
recommended default so the building agent is not blocked.

| Gate | Decision | Blocks | Recommended default |
|---|---|---|---|
| **G1** | ~~Mission status vocabulary~~ **RESOLVED** — keep the code vocabulary `PLANNING`/`READY`/`RUNNING`/`PAUSED`/`COMPLETED`/`FAILED`/`CANCELLED`; spec docs patched to match (no engine rename) | — | ✅ Resolved (was "adopt `DRAFT`/`ACTIVE`") |
| **G2** | The `RECOMMENDED` IA items (D20–D24) | M4.3 | **Build as proposed** unless vetoed |

## F. Open questions

See [open-questions.md](./open-questions.md) — grouped there with owners.
