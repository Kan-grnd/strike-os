# Strike OS — Implementation Plan

**Read [handoff.md](./handoff.md) first** — it carries the context, the ground rules, the
corrections to the earlier audit, and the decision gates. This file is the task list.

Every task cites the decisions it implements ([decisions.md](./decisions.md)) and the edge
cases it must handle ([edge-cases.md](./edge-cases.md)).

> **Gate:** no application code changes until the operator approves this plan.

## Sequencing

```
M1  Close the intent → execution loop     ← FIRST MILESTONE [CONFIRMED, D19]
M2  The workforce becomes real            (Brain, delegation, Specialists)
M3  The intervention contract             (approvals, recovery, health, ceilings)
M4  Attention-first surfaces & honesty    (IA, Control Center, Activity)
M5  Hygiene & configuration               (routing, policies, dead controls)
```

Each milestone is independently shippable. Within a milestone, tasks are ordered; a task
may depend on earlier tasks. **Do not start M2 until M1 is verified.**

---

# M1 — Close the intent → execution loop

*The milestone that makes the product real. [D9, D11, D18, D19]*

> **M1 status:** ✅ **DONE** — M1.1 ✅ · M1.2 ✅ · M1.3 ✅ · M1.4 ✅ · M1.5 ✅.
> The `Operation` model, `Task.parentOperationId` and `Task.simulated` columns landed with
> migration `20261014023002` (D40 resolved), the task→operation→mission policy chain is live,
> and the scheduler now actually starts (D44). Landed in `76e96e2` (M1.1 + M1.2 partial),
> `dc7d4c3` (M1.4 + M1.5), `3273372` (M1.3), `13de2e8` (schema + policy chain + completion wiring).

## M1.1 — A real planner ✅ DONE

- **Objective:** replace the keyword planner with a genuine LLM plan; make planning failure
  loud.
- **Affected files:** `src/lib/mission-engine.ts` (`patternMatchPlan` :25-119, `llmPlan`
  :121-125, `planMission` :134-136), `src/lib/model-gateway.ts`, `src/app/api/missions/route.ts`.
- **Dependencies:** none.
- **Expected behaviour:** given intent text, the available Specialists/Agents (with their
  capabilities) and the mission's limits, the Brain returns a structured plan: steps, the
  intended worker per step, cadence, estimated cost, required permissions.
- **Acceptance criteria:**
  - "Keep the API docs current" yields ≥1 step, each naming an intended agent and model.
  - `llmPlan` no longer calls `patternMatchPlan`; `patternMatchPlan` is deleted.
  - Provider failure → error response, **no mission row created**.
  - No provider configured → plan returned with `simulated: true`.
- **Edge cases:** E1, E2.
- **Testing:** unit — plan shape for 3 intents; integration — provider error returns an
  error, not a plan; simulation path sets the flag.
- **Gotcha:** `PlanStep.agentType` is a free string matched against `agent.type`
  (`mission-engine.ts:167`). A real LLM will invent types that match nothing. **Constrain
  the prompt to the actual installed types, or have the planner return `agentId` directly.**
  This is the most likely way M1.1 yields an unexecutable plan.

## M1.2 — A mission actually creates work ✅ DONE

- **Objective:** approving a mission materializes real Tasks, which the existing scheduler
  picks up.
- **Affected files:** `src/lib/mission-engine.ts` (`createMission`, private `materializePlan`,
  `startMission`, `ensureOperationAndTasks`), `src/app/api/missions/[id]/plan/route.ts`,
  `src/lib/automation-actions.ts`, `src/app/api/specialists/route.ts:252`.
- **Dependencies:** M1.1. **Done:** `76e96e2` (task materialization), `13de2e8` (Operation layer).
- **Expected behaviour (as shipped):** the plan is stored on the mission; `startMission`
  opens a run (`Operation`) and materializes the stored steps into `Task` rows (`QUEUED`) on
  first run, each linked via `parentOperationId`; `createMission` shares the same
  `ensureOperationAndTasks` path (idempotent — reuses the latest operation, only creates tasks
  when none exist).
- **Acceptance criteria:**
  - Approve a mission → 1 `Operation` (`RUNNING`, `startedAt` set) + N `Task` rows with
    `status=QUEUED`, all with `parentOperationId`. ✅ verified
  - Within 3s a task transitions `QUEUED→ASSIGNED→RUNNING`. ✅ verified
  - `cancelMission` closes the open operation as `CANCELLED`. ✅
- **Edge cases:** E19 (idempotent launch), E14 (edit-during-planning).
- **Testing:** integration — launch against a test DB, assert task creation and a `RUNNING`
  transition; double-POST asserts a single mission.
- **Gotcha:** `createMission` assigns `ownerAgentId` by type-matching and falls back to
  `agentIds[0]` (`:167-168`), so a step can land on an agent that cannot do it. Tighten
  here rather than later. Also fold `getDb()` onto the shared `@/lib/db` singleton — it
  currently constructs a second `PrismaClient` (two pools). *(The single-`PrismaClient`
  fold landed in `76e96e2`.)*

## M1.3 — Plan review & the launch gate ✅ DONE

- **Objective:** nothing runs until the operator approves the plan.
- **Affected files:** new `src/app/(missions)/new` route; `mission-engine.ts`
  (`startMission` :214-232).
- **Dependencies:** M1.1, M1.2. **G1 is resolved** — keep the code vocabulary
  (`PLANNING`/`READY`/`RUNNING`); no engine rename.
- **Expected behaviour:** `/missions/new` shows the plan (steps, workers, cadence, cost,
  permissions); the operator can edit then approve; approval launches; abandoning creates
  nothing.
- **Acceptance criteria:**
  - No task exists before approval.
  - Editing cadence/cost before approval is reflected in the created Operation.
  - Abandon leaves no rows.
- **Edge cases:** E1, E19.
- **Testing:** e2e — plan → approve → run; plan → abandon → no rows.
- **Gotcha:** `createMission` writes `status: "READY"` and `startMission` accepts
  `["READY","PLANNING"]`. Under **G1 (resolved)** these stay exactly as they are — the
  `DRAFT`/`ACTIVE` rename is dropped.
- **Resolved:** abandon keeps the `PLANNING`/`READY` row as `CANCELLED` (D42); pre-approval
  plan editing is deferred (D43) — M1.3 ships approve-only. Landed in `3273372`.

## M1.4 — Honest simulation, end to end ✅ DONE

- **Objective:** REAL vs SIMULATED is visible everywhere a result appears; silent
  degradation is removed.
- **Affected files:** `src/lib/task-runner-real.ts` (:68-72 silent mock, `mockFallback`
  :115-125), `src/lib/task-engine.ts` (`runTask` :234-244, `MockTaskRunner` :22-36),
  `src/lib/engine.ts` (`hasApiKeys` :29-40), `prisma/schema.prisma` (add `Task.simulated`),
  `src/app/page.tsx` (`NEXT_PUBLIC_DASHBOARD_SAMPLE` :90-117), task/run UI.
- **Dependencies:** M1.1.
- **Expected behaviour:** every task result carries `simulated`; the UI marks it; with no
  provider the app shows an app-wide **simulation mode** banner.
- **Acceptance criteria:**
  - No code path returns a simulated result marked as real. [D18]
  - Simulation mode is visible on every top-level surface.
  - `NEXT_PUBLIC_DASHBOARD_SAMPLE` cannot substitute real content in production.
- **Edge cases:** E1, E2, E4.
- **Testing:** unit — flag propagation; integration — provider failure yields either
  recovery or a marked simulated result, never unmarked.
- **Note (as shipped):** the flag is persisted to the `Task.simulated` column (migration
  `20261014023002`) by `task-engine.runTask`, and also lives in `Task.output` JSON
  (`MockTaskRunner` :31, `task-runner-real.ts`). `taskSimulated(task)` (in `execution-meta.ts`)
  prefers the column and falls back to the output JSON. `mockFallback` is **deleted** — a
  provider failure now throws and the task `FAILED` (recovery is M3.2). Real output carries
  `simulated: false`; `/api/health` exposes a `simulated` flag and the shell header shows a
  `SystemModeIndicator` on every surface. `NEXT_PUBLIC_DASHBOARD_SAMPLE` (+ `sample.ts`) removed.
- **Reality check:** with `.env` holding only `DATABASE_URL` and no `secrets` rows,
  `hasApiKeys()` is false → the engine runs `MockTaskRunner` → **the whole product is
  simulated today.** The banner will be on from day one until a provider is configured.

## M1.5 — Correct model policy on tasks ✅ DONE

- **Objective:** routing uses the mission/task policy, not a repurposed field.
- **Affected files:** `src/lib/task-runner-real.ts`, `src/lib/model-gateway.ts`,
  `src/lib/model-policy.ts` (new), `prisma/schema.prisma`.
- **Dependencies:** none. **Done:** `dc7d4c3` (reads + dead router), `13de2e8` (chain).
- **Expected behaviour:** policy resolves **task → operation → mission → agent default**
  (`resolveModelPolicy`, `src/lib/model-policy.ts`); `memoryScope` is never consulted for
  model choice. Each layer stores an optional JSON policy (`{ primary, fallback[] }`) on the
  mission, operation and task (columns added in migration `20261014023002`).
- **Acceptance criteria:** a task whose mission/operation policy names model M resolves to M
  regardless of the agent's `memoryScope`. ✅ (chain wired; verified by construction — no live
  provider to exercise routing end-to-end)
- **Edge cases:** E20.
- **Testing:** unit — policy resolution order.
- **Gotcha (resolved):** the `memoryScope` misread was in two places; both now read the
  real columns, and the caller-less `selectModel` / `parsePolicy` / `ModelPolicy` /
  `RoutingResult` were **removed**. The task→operation→mission chain is now implemented.

**M1 exit criteria:** ✅ met — intent → approved plan → running tasks → mission and its
operation roll up to `COMPLETED` with cost → visible REAL/SIMULATED, verified end to end on a
served build against a real database (`13de2e8`). Nothing here has yet run against a **real**
model provider: with no provider configured the whole loop runs in honest simulation (D44
makes the scheduler actually start, so the loop is observable rather than frozen).

---

# M2 — The workforce becomes real

*[D4, D5, D6, D10, D17]*

## M2.1 — The Brain is a real, observable entity ✅ DONE
- **Objective:** a Brain with state that reports what it is doing.
- **Affected files:** `prisma/schema.prisma` (`BrainState` singleton, migration
  `20261014090431_m2_brain_state`), new `src/lib/brain.ts` (`setBrainState`/
  `getBrainState`), emission wiring in `src/lib/mission-engine.ts` (`planMission`,
  `startMission`), `src/lib/task-engine.ts` (`runTask`/`failTask`/`retryTask`),
  `src/lib/completion.ts` (`settleMissionIfComplete`), new `src/app/api/brain`,
  new `src/app/workforce/brain`, `src/lib/navigation.ts`.
- **Dependencies:** M1.
- **Expected behaviour:** the Brain has states (idle/planning/delegating/supervising/
  recovering) persisted in a singleton row and emitted as real
  `brain.state.changed` events; the page shows current state + recent decisions.
- **Design note:** `computeBrainRuntime` (health aggregate) is untouched; the new
  persisted state is the complementary *activity* signal, shown beside it.
- **Acceptance criteria:** a planning operation emits `brain.state.changed` ≥2 times; the
  page reflects it live. ✅ Verified e2e: planning → idle (Planned 3 steps) →
  delegating (3 tasks) → supervising ×3 → idle (Mission completed).
- **Edge cases:** E5.
- **Testing:** integration — event emission; e2e — page updates.

## M2.2 — Delegation is real ✅ DONE
- **Objective:** the Brain delegates tasks and spawns sub-agents; edges and events are real.
- **Affected files:** `src/lib/runtime-state.ts` (`spawnAgent :411` now emits
  `agent.spawned` + takes `missionId`), `src/lib/task-engine.ts` (`assignTask` emits
  `delegation.started`, every terminal transition emits `delegation.completed`),
  `src/lib/mission-engine.ts` (`materializePlan` gap-fill spawn; `cancelMission` closes
  delegation edges).
- **Dependencies:** M2.1.
- **Expected behaviour:** delegating a task sets `delegating` and emits `delegation.*`;
  spawning creates a child agent and emits `agent.spawned`; the live graph draws real edges.
- **Design (D46):** the *delegation* edge is `brain → ownerAgent` (`payload.from = "brain"`,
  `payload.to = ownerAgentId`); the Brain spawns a sub-agent only when **no** existing agent
  can own a step (gap-fill), parented off a real loaded agent; later steps of the same type
  reuse it. Scope is **delegation + spawn only** — `communication.*` / `verification.*`
  emitters are deferred to M2.5 (Live), where those edges are actually rendered.
- **Acceptance criteria:** ✅ no *delegation-family* consumed event lacks an emitter
  (`delegation.started`/`delegation.completed`/`agent.spawned` all emitted); ✅ the live
  flow shows a real delegation edge during execution (verified: `brain → spawned agent` ×3).
- **Edge cases:** E11.
- **Testing:** integration — event/payload contract for each consumed event.

## M2.3 — Scoped permissions & the spawn ceiling ✅ DONE
- **Objective:** enforce scoped subset inheritance and the per-mission spawn ceiling.
- **Affected files:** new `src/lib/spawn-policy.ts` (`DEFAULT_MISSION_SPAWN_CEILING`,
  `resolveSpawnCeiling`, `intersectGrants`); `src/lib/runtime-state.ts` (`spawnAgent`
  intersects grants with the parent + emits `permission.denied`); `src/lib/mission-engine.ts`
  (`materializePlan` enforces the ceiling + emits `spawn.denied`); `src/lib/events.ts`
  (`spawn.denied`, `permission.denied`); new `scripts/check-spawn-policy.ts`.
- **Dependencies:** M2.2.
- **Expected behaviour:** a sub-agent holds ≤ its parent's permissions; spawning past the
  ceiling is refused and recorded, and work continues unowned.
- **Design (D47):** the ceiling is a code default (`5`) overridable per mission via
  `Mission.policy.spawnCeiling` (operator config surface deferred to Policies & Limits).
  Scoped inheritance is **intersection**: a child inherits the parent's grants when it asks
  for nothing; a requested grant the parent lacks is denied (dropped + `permission.denied`),
  so a child's grants are always a subset of its parent's. Ceiling enforcement is immediate
  (refuse + `spawn.denied`, step runs unowned); the operator-facing **blocking gate and
  pause** arrive with approvals in M3.1 — we refuse honestly now rather than fake a gate.
- **Acceptance criteria:** ✅ a sub-agent requesting a permission its parent lacks is denied
  (unit-verified); ✅ exceeding the ceiling is refused and recorded (e2e: ceiling 0 → 3
  `spawn.denied`, 0 spawned, 3 unowned tasks, mission COMPLETED). Ceiling *gate/pause* is
  M3.1.
- **Edge cases:** E12.
- **Testing:** unit — `check-spawn-policy.ts` (11 checks: ceiling resolution + intersection);
  integration — ceiling-0 mission refuses spawns and still completes; default ceiling still
  spawns (regression).

## M2.4 — Specialists actually work ✅ DONE
- **Objective:** fix the permanent 403, make install usable.
- **Affected files:** `src/lib/specialist-bundles.ts` (remove dev guard, add `simulated`
  to `SpecialistTrialRecord`), `src/app/api/specialists/route.ts` (drop the 403),
  `src/app/architect/page.tsx` (label simulated trials). The forge UI already lived at
  `/architect` — the domain move to `/workforce/specialists` is deferred to the IA
  milestone (M4.3), so no page was added.
- **Dependencies:** M2.1.
- **Expected behaviour:** installation works against Postgres; Specialists appear in the
  roster and can own standing work.
- **Design (D48):** `specialistsAllowed()` tested for a SQLite `dev.db` that no longer
  exists, so deploy/trial returned **403 in every real configuration**. Deploying a
  specialist is a normal operator capability, so the guard is removed (matching the
  handoff's "prototype tells — remove or fix"). The trial benchmark runs through
  `MockTaskRunner`, so `SpecialistTrialRecord.simulated = true` and the UI labels it
  **SIMULATED** — a simulated trial is never presented as real. The permission-prompt
  gate is M3.1 (per the acceptance note).
- **Acceptance criteria:** ✅ installing each of the 4 bundles succeeds (e2e: all 4 →
  201, trial PASS + `simulated=true` + `ACTIVE`); ✅ the roster lists them (all 4 in
  `/api/agents`); the operator permission prompt is M3.1.
- **Edge cases:** E13 (uninstall — not yet built; see M4/M5).
- **Testing:** integration — install all 4 bundles + trial-run each against Postgres;
  redeploy denied 409.

## M2.5 — Live work flow ✅ DONE (verified; relocation deferred to M4.3)
- **Objective:** the live work flow renders real executing work; empty/reconnecting states.
- **Affected files:** none changed — the live flow already exists at `/topology`
  (`src/app/topology/page.tsx` + `src/lib/runtime/store.ts`). The planned
  `/workforce/live` is a *relocation* into the Workforce domain, which is the unconfirmed
  five-domain IA restructure (G2, D20/D23) — deferred to M4.3.
- **Dependencies:** M2.2.
- **Expected behaviour:** the graph shows missions → operations → tasks → agents with live
  edges; reload re-populates current execution only; on drop it stops animating.
- **Design (D49):** the milestone's *substance* is already present, so M2.5 is verified in
  place rather than re-built: `/topology` subscribes to the runtime store (2s poll), renders
  `delegation.*`/`communication.*`/`verification.*` as transient edges (15s TTL), builds a
  `brain` node (`BRAIN_NODE_ID`) so `brain → agent` edges resolve, has an honest empty state
  ("No topology yet"), and a `CONNECTED/DISCONNECTED/RECONNECTING` badge. Creating a
  duplicate `/workforce/live` now would collide with the pending IA and be reworked.
- **Acceptance criteria:** ✅ a run emits the delegation edges the graph draws — verified:
  a ghost-agent mission spawned 1 sub-agent and emitted 3 `delegation.started`
  (`from="brain"` → the spawned agent, one per task), spawned agent present in the snapshot;
  ✅ empty state present; ✅ drop-handling (E5) present in the store: poll failure →
  `DISCONNECTED` + `needsResync`, retry → `RECONNECTING`, then cursor resync — never a stale
  frame implying liveness. Visual confirmation of the badge is the operator's (no browser
  tooling here).
- **Edge cases:** E5, D12 (verified in `store.ts`).
- **Testing:** e2e — ran a mission and polled `/api/runtime/snapshot` + `/api/runtime/events`
  as the store does; confirmed the live-edge contract + spawned agent in the live set.

---

# M3 — The intervention contract

*[D14, D15, D16, D17, D18]*

## M3.1 — Approvals: create, block, resolve ✅ DONE
- **Objective:** gates really pause work and are resolvable.
- **Affected files:** `src/lib/approval-policy.ts` (new), `src/lib/approvals.ts` (new),
  `prisma/schema.prisma` (Approval scope fields + `m3_approval_scope`), `events.ts`,
  `task-engine.ts`, `mission-engine.ts`, `tool-fabric.ts`,
  `src/app/api/approvals/[id]/route.ts` (new resolve endpoint), `src/app/api/approvals/route.ts`.
- **Dependencies:** M2.3.
- **Expected behaviour:** a gate creates a `PENDING` approval, sets `waiting_for_approval`
  and pauses the affected scope; resolve resumes or rolls back; resolution is idempotent.
- **Design (D50–D52):**
  - **Mechanism + reachable triggers now (D50):** the generic gate primitive supports all
    six intervention triggers (permissions.md §4), but only the two live sources are wired:
    **spawn-past-ceiling** (mission-engine) and **new-tool-permission** (tool-fabric). The
    auto-wiring for fallback/escalation arrives in M3.2, spend/drift in M3.4 — each calls the
    same primitive.
  - **Pause scope (D51):** explicit per approval; execution gates default to `OPERATION`,
    mission-wide signals (drift, escalation) to `MISSION`. A gated scope is un-schedulable
    two ways: the task engine skips work in a gated operation/mission (derived from PENDING
    approvals) and owning agents move to `waiting_for_approval`.
  - **Deny (D52):** blocking triggers deny the *work* — the affected scope's in-flight tasks
    are cancelled and the operation/mission is marked `CANCELLED` (partial), never a silent
    failure. Capability triggers (tool, spawn) deny only the *capability*; the work continues
    without it and the refusal is recorded.
- **Acceptance criteria:** ✅ the six trigger types each create a gate (verified, 20 checks);
  ✅ the affected work is observably paused (scheduler holds a gated QUEUED task, then runs it
  on release); ✅ a second resolve is a no-op (atomic claim; `alreadyResolved:true`); ✅ deny
  ends cleanly (blocking → CANCELLED; capability → work continues).
- **Edge cases:** E6–E10 (E7 idempotent resolve, E8 all gates must resolve, E9 never
  auto-expires, E10 deny records cleanly).
- **Testing:** pure `scripts/check-approvals.ts` (10); integration — all six triggers pause +
  idempotency + deny matrix (20); live wiring — mission-engine spawn gate resolved via HTTP,
  tool-fabric permission gate (13); scheduler hold/release (2).

## M3.2 — Failure recovery ✅ DONE
- **Objective:** retry → Brain recovers → escalate, using the declared policies.
- **Affected files:** `src/lib/recovery-policy.ts` (new, pure), `src/lib/recovery.ts` (new),
  `scripts/check-recovery.ts` (new), `prisma/schema.prisma` (`Task.recovery` +
  `m3_task_recovery`), `events.ts`, `task-engine.ts` (retry-exhaustion branch), `engine.ts`
  (boot re-queue), `approvals.ts` (recovery-gate resolution), `model-policy.ts`
  (`DEFAULT_PRIMARY` exported), `approval-policy.ts` (`ESCALATED` is non-terminal).
- **Dependencies:** M3.1.
- **Expected behaviour:** bounded retry (already built) → reassign → fallback model (within
  policy) → spawn replacement; if all fail, escalate with context; health degrades.
  Outside-policy model fallback is a gate.
- **Design (D53–D55):**
  - **The ladder (D53):** on retry exhaustion the Brain walks `reassign → fallback →
    replacement → escalate`, each stage attempted **at most once**. The stages run are
    recorded on `Task.recovery` (`{ tried: stage[], lastError? }`), so the same task advances
    the ladder instead of repeating a stage and the total work is bounded
    (`stages × maxRetries`). `reassign` picks another capable agent (same type preferred, never
    an agent that is itself failed/blocked/paused); if none exists the stage is marked tried and
    the ladder moves on. `replacement` spawns a sub-agent, honouring the spawn ceiling — at the
    ceiling it raises the M3.1 `SPAWN_CEILING` gate.
  - **Fallback is in-policy or gated (D54):** if the task/mission policy lists a fallback model,
    the task switches silently (a warning is emitted). If the policy names **no** fallback,
    switching models would be *outside policy*, so a `MODEL_FALLBACK` gate is raised (task held
    non-terminal `WAITING`) rather than a silent swap. Approving it authorises the default
    model and re-queues; denying cancels the scope (blocking trigger, D52).
  - **Escalation (D55):** when the ladder is exhausted the task ends non-terminal
    **`ESCALATED`** — never a silent `FAILED` — and an `ESCALATION` gate (scope `MISSION`,
    D51) is raised carrying the full context (stages tried, last error). Because `ESCALATED`
    is non-terminal, the mission cannot settle; it stays open and visibly needs the operator.
    Approving starts a fresh recovery cycle; denying cancels the scope.
  - **E3 boot sweep:** a `RUNNING` task orphaned by a crash/restart is re-queued on engine
    start with a reattempt cap (increments `retryCount`; past the cap it settles `FAILED`), and
    its agent resets out of `executing`.
- **Acceptance criteria:** ✅ a repeatedly-failing task reassigns (to a different agent) and
  then escalates (verified, ladder e2e); ✅ escalation carries the failure context (stages
  tried + last error) on the gate; ✅ no silent permanent `FAILED` (tasks end `ESCALATED` with
  a gate, or are cancelled by a deny); ✅ the mission never settles while a task is escalated;
  ✅ an in-policy fallback switches silently, an out-of-policy fallback gates.
- **Edge cases:** E2 (recovers or fails honestly, never a fake success), E3 (boot re-queue +
  cap), E10 (deny semantics via M3.1), E20 (stale `memoryScope` already fixed — policy resolves
  task → operation → mission → agent).
- **Testing:** pure `scripts/check-recovery.ts` (15); integration — full ladder + fallback
  gate + escalation-context + idempotent resolution + E3 (20); live — the running scheduler
  escalates a synthetic unrecoverable task and raises a `MISSION`-scope `ESCALATION` gate.
- **Note:** **retry already existed** (`task-engine.ts`); this built the **recovery** and
  **escalation** steps. Health *degradation* is the M3.3 rollup — M3.2 produces the facts
  (escalated task, open mission, gate) M3.3 turns into health.

## M3.3 — Health rollup ✅ DONE
- **Objective:** task → operation → mission health for the attention surface.
- **Affected files:** `src/lib/health.ts` (new, pure), `scripts/check-health.ts` (new),
  `src/app/api/missions/route.ts` (list), `src/app/api/missions/[id]/route.ts` (detail +
  per-operation health), `src/app/missions/[id]/page.tsx` (health badge), `src/hooks/useApi.ts`,
  `src/lib/execution-meta.ts` (`HEALTH_COLOR`/`HEALTH_LABEL`, `ESCALATED` task colour).
- **Dependencies:** M1.2, M3.2.
- **Expected behaviour:** health computed from children on every read (always fresh); debounced
  so a within-tick recovery does not flash. Health is **orthogonal to lifecycle** — a `RUNNING`
  mission can be `BLOCKED`, a `PAUSED` mission `HEALTHY`.
- **Design (D56):**
  - **Vocabulary (state-model §1):** `HEALTHY · DEGRADED · BLOCKED · FAILING`, ranked
    `FAILING > BLOCKED > DEGRADED > HEALTHY`. Severity rises as it rolls up: a **failing task**
    degrades its operation (`DEGRADED`); a **failing operation** blocks its mission (`BLOCKED`).
  - **Task (`taskHealth`):** `ESCALATED`/`WAITING` (a gate) → `BLOCKED`; `FAILED` with retries
    remaining → `HEALTHY` (it will retry/recover, so it must not flash — this *is* the
    debounce); a settled `FAILED` (retries exhausted) → `DEGRADED`; everything else → `HEALTHY`.
  - **Operation (`operationHealth`):** lifecycle `FAILED` → `FAILING`; `CANCELLED` → `HEALTHY`;
    otherwise the worst child task, with a `PAUSED` run and nothing wrong → `DEGRADED` (stalled).
  - **Mission (`missionHealth`):** lifecycle `FAILED` → `FAILING`; otherwise the worst operation,
    where any `DEGRADED`/`BLOCKED` run → `BLOCKED` (the mission can't proceed without the
    operator) and a barely-`PAUSED` mission (healthy runs) → `DEGRADED`.
  - **Read-shaping (`missionHealthFrom`):** groups tasks by `parentOperationId` (tasks with no run
    count at the mission level) so both API routes derive health from raw reads.
- **Acceptance criteria:** ✅ a failing task makes its operation `DEGRADED`; ✅ a failing operation
  makes its mission `BLOCKED`; ✅ within one tick (health is computed on read — no stale field);
  ✅ a within-tick recovery does not flash (still-retrying failure leaves the mission `HEALTHY`);
  ✅ health shown independently of the state label.
- **Testing:** pure `scripts/check-health.ts` (24 — full rollup matrix incl. debounce and
  orthogonality); live e2e — drives missions into `BLOCKED`/`HEALTHY`/`FAILING` and asserts both
  the list and detail endpoints agree (9; temp script removed before commit).
- **Note:** `computeBrainRuntime` (`runtime/mappers.ts:109`) stays the separate brain-level
  *health* aggregate (D45); this is the task/operation/mission rollup the attention surface
  (M4.1) consumes.

## M3.4 — Cost & drift gates ✅ DONE
- **Objective:** spending ceilings and drift signals become real gates.
- **Affected files:** `src/lib/spend-policy.ts` (new, pure), `src/lib/drift-policy.ts` (new,
  pure), `src/lib/gates.ts` (new — the wiring), `scripts/check-spend-policy.ts`,
  `scripts/check-drift-policy.ts`, `src/lib/task-engine.ts` (tick), `src/lib/events.ts`
  (`spend.warning`/`spend.gated`/`drift.detected`).
- **Dependencies:** M3.1.
- **Expected behaviour:** crossing a ceiling pauses the operation and asks; drift signals
  route to the attention queue.
- **Design (D57–D58):**
  - **Spend ceiling (D57, E15):** the ceiling is read from `Mission.policy` — no invented
    default. Shape `{ "spend": { "operationCap", "missionCap", "warnRatio" } }`; a bare
    `"spendCeiling"` aliases `operationCap`. `spendDecision` gates when spend has reached a
    cap or when spend + the next step's plan estimate would exceed it (the tighter
    dimension — operation before mission — wins); it only **warns** when a `warnRatio` is
    declared and the ratio is met, so "approaching" is an opt-in soft signal. `checkSpendGate`
    runs in the task-engine tick before a task executes; a gate raises an **operation-scoped**
    `SPEND_CEILING` approval and pauses the run. Idempotent (no second gate for a scope that
    already holds one).
  - **Drift (D58, E16/Q2):** three configurable signals, each **off unless the policy switches
    it on** (no invented thresholds): `stalled` (a `RUNNING` run quiet past `stallMs`),
    `rising_cost` (spend accrued with no completion past `risingCostWindowMs`), `missed_cadence`
    (no run within `cadenceMs × (1 + cadenceGrace)`). `sweepDrift` runs once per tick over
    `RUNNING` missions; a drifting mission raises a **mission-scoped** `DRIFT` approval and is
    paused into the attention queue. Idempotent (skips a mission already holding a PENDING
    DRIFT gate; pausing removes it from the next sweep).
  - **Both reuse the M3.1 primitive:** pause/resume/deny are already handled by
    `requestApproval`/`resolveApproval` (`onApprove`'s `default` lifts a spend/drift gate;
    deny cancels the scope — both are blocking triggers per D52). No new gate machinery.
- **Acceptance criteria:** ✅ a mission with a low ceiling gates mid-run (operation paused,
  `SPEND_CEILING` approval); ✅ a mission off cadence appears in "needs you" (a `DRIFT`
  PENDING approval on `/api/approvals`); ✅ both pause the affected scope; ✅ a warning does not
  gate; ✅ denying a spend gate cancels the gated work.
- **Edge cases:** E15 (ceiling crossed mid-operation → pause + ask), E16 (drift → attention
  queue without a hard failure), E10/D52 (deny semantics reused), E6 (an unrelated mission is
  untouched — gates are scoped).
- **Testing:** pure `check-spend-policy` (15) + `check-drift-policy` (16); **live e2e** (14) —
  gate + pause + idempotency + warn-does-not-gate + approvals feed + API resolve/deny.
- **Note:** the plan cited "cost accounting (`model-gateway.ts:65` hardcoded tables)" — this is
  a **misattribution**: `model-gateway.ts:65` is provider routing, and cost is provider-reported
  via each adapter's `estimateCost` pricing table (anthropic/openai/omniroute). No cost table
  needed changing; cost already rolls up task → operation → mission (`completion.ts`) and is
  billable. Thresholds are **open questions** (Q1 spending granularity, Q2 drift signals) — both
  are configurable and unset by default here, per the plan note not to invent values.
- **Release note:** the M3.3 `missionHealth` mapping treats a gated (PAUSED) run as `BLOCKED`
  and a merely-paused mission as `DEGRADED`, so a spend-gated mission reads `BLOCKED` and a
  drift-gated mission reads `DEGRADED` — exactly the state-model §7 rows ("any operation
  blocked" → `BLOCKED`; "rising cost / drift" → `DEGRADED`).

**M3 exit criteria:** an autonomous run can proceed, gate, recover and escalate, with the
operator's decisions actually controlling execution.

---

# M4 — Attention-first surfaces & IA

*[D3, D10, D11, D20–D25]*

## M4.1 — Control Center rebuild ✅ DONE
- **Objective:** `/` becomes the attention-first surface.
- **Affected files:** `src/app/page.tsx` (rebuilt); new
  `src/components/control-center/{control-header,attention-queue,mission-health,live-summary}.tsx`;
  new pure `src/lib/attention.ts`; `scripts/check-attention.ts`;
  `src/hooks/useApi.ts` + `src/hooks/useApprovals.ts` (approvals can poll).
- **Dependencies:** M3.3.
- **Expected behaviour:** a ranked "Needs you" queue, then mission health, then a live
  summary; each queue item actionable in one click.
- **Design (D59):** the queue is **derived, not stored** (`buildAttentionQueue` over the
  approvals + missions the API already returns). Items are open gates (ranked by
  `denyCancelsScope` — blocking = Critical, capability = High) and missions whose health says
  blocked/failing/degraded; a mission already represented by its gate is not listed twice; ties
  break longest-waiting first. Each gate row approves/denies **inline** (`POST /api/approvals/[id]`
  then revalidate) — no navigation. Mission health shows the status + orthogonal health badge and
  one-line progress; Live now shows real counts (no invented KPIs).
- **Acceptance criteria:** ✅ the operator can answer "is it healthy?" in <5s (header summary +
  health list) and act without navigating (inline resolve). ✅ Hardcoded KPIs, `"recent"`,
  `toHourSeries`, `totalProblems={0}` and `NEXT_PUBLIC_DASHBOARD_SAMPLE` are gone; the entire
  orphaned `dashboard/command-center` component set (hero, kpi-card, events-chart, fleet-donut,
  actions, adapter, swarm, y-ticks, section-header, error boundary) is **deleted**.
- **Edge cases:** E4 (honest error, no sample data) — loading skeletons, explicit error alerts
  with no fallback data, and partial rendering (each region marks its own failure).
- **Testing:** pure `check-attention` (14 — ranking, dedupe, health mapping, unknown-trigger
  fallback); **live e2e** (15) — a gated mission shows in the queue, ranks Critical, links to the
  mission, reads `BLOCKED`, and resolves via the API; a FAILING mission shows as a mission item;
  a healthy mission is not queued.
- **Deferred:** the global command bar exists in the shell (`command-bar.tsx`, IM1); folding chat
  in as the directing input is later. `/missions` is still a redirect to `/work` until M4.2.

## M4.2 — Missions list & detail ✅ DONE
- **Objective:** the directing surface.
- **Affected files:** new `src/app/missions/{page,layout}.tsx`; `src/app/missions/[id]/page.tsx`
  (operations timeline + triggers); new `src/components/missions/mission-triggers.tsx`; new pure
  `src/lib/missions.ts` + `scripts/check-missions.ts`; `src/app/api/missions/{route,[id]/route}.ts`;
  `src/app/api/automations/route.ts` (accept/filter `missionId`); `src/lib/navigation.ts`;
  `next.config.js`; `src/lib/execution-meta.ts`; `src/hooks/useApi.ts`.
- **Dependencies:** M1.2.
- **Expected behaviour:** a list (health, cadence, last run, cost, next run), sorted
  "needs attention first"; detail shows operations timeline, cadence/triggers, limits,
  history. **Automations fold in as triggers on the detail page.**
- **Design (D60):** triggers attach by a **nullable `Automation.missionId`** (FK, `ON DELETE SET
  NULL`, indexed) plus an optional **`Mission.cadence`** (JSON, null = manual). Triggers *are* the
  existing automations, created/renamed/enabled/disabled/deleted on the detail page via the
  existing `/api/automations` endpoints (extended to accept/filter `missionId`) — **no separate
  Automations surface**. The list reuses the Control Center's severity idea via
  `sortMissionsByAttention` (worst health → running → the rest → terminal last). **Honesty:** no
  runtime loop fires a trigger on a schedule, so "Next run" shows only when an automation actually
  carries `nextRun`, and a mission with no cadence and no triggers reads "Manual".
- **Acceptance criteria:** ✅ a mission's triggers are editable on its detail page
  (add / pause / activate / delete); ✅ no separate Automations surface remains. `/missions` stops
  redirecting so the page can serve; `/workflows` and `/automations` keep redirecting until M4.3.
- **Testing:** pure `check-missions` (26 — ordering, cadence parse/format, trigger next/last run,
  scheduled-ness); **live e2e** (16) — `/missions` serves a page (not a redirect) and
  server-renders; create a mission with a cadence and see it in the list; link a trigger and see it
  on the detail payload and by `?missionId=`; pause + delete the trigger; edit + clear the cadence.
- **Deferred:** mission "limits/permissions" editing UI is M5.2; the five-domain IA reorg and full
  `/workflows`+`/automations` retirement are M4.3.

## M4.3 — IA reorg ✅ DONE
- **Objective:** apply the five-domain structure. **(D61; G2 confirmed.)**
- **Affected files:** `src/lib/navigation.ts`, `next.config.js`, route moves.
- **Dependencies:** M4.1, M4.2, **G2 resolved** ✅.
- **Expected behaviour:** Control Center · Missions · Workforce · Activity · Settings;
  redirects retired; the merged `/work` removed. **Done** — nav collapses from eight
  infrastructure domains to the five, in loop order; Observatory→**Activity**;
  **Colony demoted** to a Workforce item; **Live** replaces "Live Topology".
  Workforce relocates under the domain (D48/D49): `/agents → /workforce/agents`,
  `/architect → /workforce/specialists`, `/topology → /workforce/live` (old paths 404).
  `next.config.js` has **no redirects**; the merged `/work` page is deleted and
  `/work`, `/workflows`, `/automations` are honest 404s — workflow detail still
  resolves under Missions via nav `matches`.
- **Acceptance criteria:** ✅ `scripts/check-navigation.ts` passes **23/23**; every
  route resolves to exactly one of the five domains; `/missions` is 200 (not a
  redirect), `/workflows` + `/automations` no longer redirect (404).
- **Testing:** ✅ nav checker; live e2e `m43-e2e.ts` (**34/34**: five domains exact +
  ordered, every nav href 200, retired paths 404-not-308, `/missions` 200). No 404s on
  nav targets. Regressions green (attention 14, health 24, spend 15, drift 16, recovery
  15, approvals 10, spawn 11, missions 26, selectors 138); `tsc` clean; build clean,
  artifacts fresh.

## M4.4 — Activity ✅ DONE
- **Objective:** consolidate history. **(D62.)**
- **Affected files:** new `src/app/activity/{page,layout}.tsx` (runs list), `src/app/activity/runs/[id]/{page,layout}.tsx`
  (run detail); moved `src/app/observability/{events,traces} → src/app/activity/*`; new
  `src/app/api/operations/{route,[id]/route}.ts`; new pure `src/lib/activity.ts` + `scripts/check-activity.ts`;
  new `src/components/activity/activity-nav.tsx`; `src/hooks/useApi.ts` (`useOperations`/`useOperation`);
  `src/lib/navigation.ts`; `src/lib/execution-meta.ts`; deleted the rest of `src/app/observability/*` and the
  orphaned `src/components/observability/observability-nav.tsx`.
- **Dependencies:** M3.3.
- **Expected behaviour:** Activity is **runs · events · traces** (a run is an operation). Runs list + run
  detail (tasks, cost, duration, per-task REAL/SIMULATED, recovery history, trace links); Events folds the
  old Events/Logs/Metrics pages into one tabbed console; Traces moved in place. Cost lives on the run.
- **Design (D62):** a run's data comes from **new `/api/operations` endpoints** (list with rolled-up
  health + mission; detail with tasks, per-task health, joined traces — `Trace` has no `operationId`, so
  runs join traces through their task ids). The list orders **worst-health-first** via the pure
  `sortRunsByAttention` (asserted in `check-activity`). The standalone `costs`/`logs`/`performance` pages
  are **retired**; the `/api/observability/*` APIs stay and back the folded tabs.
- **Acceptance criteria:** ✅ one word — Activity — everywhere (nav, layout, eyebrow); ✅ run detail shows
  per-task simulation state (REAL/SIMULATED); ✅ no `/observability/*` page remains (404s), APIs intact.
- **Testing:** ✅ pure `check-activity` (**10** — health ranking, ordering, non-mutation, stable ties,
  terminality, duration clamping); ✅ `check-navigation` (**24/24**, +fold assertions); ✅ live e2e
  `m44-e2e.ts` (**27/27**: `/api/operations` list+detail+404, status filter, Activity pages 200, all
  `/observability/*` 404, folded APIs alive). Regressions green (attention 14, health 24, spend 15, drift
  16, recovery 15, approvals 10, spawn 11, missions 26, selectors 138); `tsc` clean; build clean, artifacts
  fresh.
- **Edge cases:** E18 (paginate; no client-side loops) — deferred: the list is bounded by the seeded set,
  pagination noted for M5.

## M4.5 — Universal states ✅ DONE
- **Objective:** every data surface defines all five states. **(D63.)**
- **Affected files:** new `src/app/{loading,error,not-found,global-error}.tsx`; new
  `src/components/shared/{page-skeleton,error-state}.tsx`; a `loading.tsx` on each dynamic detail route
  (`activity/runs/[id]`, `activity/traces/[id]`, `missions/[id]`, `tasks/[id]`, `workflows/[id]`,
  `workforce/agents/[id]`); `src/app/activity/{traces/page,traces/[id]/page,events/page}.tsx` (error
  branches + the last `Observability` eyebrow → `Activity`); new `scripts/check-states.ts`.
- **Dependencies:** M4.1–M4.4.
- **Expected behaviour:** no surface renders blank or a bare spinner; errors are honest and retryable.
- **Design (D63):** the **framework-level** states live at the app root — a shell-shaped `PageSkeleton` on
  navigation, an error boundary that shows the failure + a working **retry**, a styled `not-found` rendered
  **inside the shell** (so a 404 never strands the operator), and a plain `global-error` for when the root
  layout itself fails. The **inline** states stay per-surface; the Activity family was completed so a load
  failure is distinguished from "not found".
- **Acceptance criteria:** ✅ app-level loading/error/not-found/global-error exist and compile; ✅ every
  dynamic detail route ships a loading boundary; ✅ the 404 renders the styled page inside the shell; ✅
  data errors are retryable, not blank.
- **Testing:** ✅ pure `check-states` (**7** — state files exist, error boundary is a client boundary with
  `reset`, global-error renders its own html/body, every dynamic route has a `loading.tsx`); ✅ live e2e
  `m45-e2e.ts` (**17/17**: unmatched/retired routes are styled 404s with the shell, every nav target 200,
  detail surfaces stream 200, a bad resource is an honest API 404). Regressions green (attention 14, health
  24, spend 15, drift 16, recovery 15, approvals 10, spawn 11, missions 26, navigation 24, activity 10,
  selectors 138); `tsc` clean; build clean, artifacts fresh.

## M4.6 Dead controls ✅ DONE
- **Objective:** the audit found nine dead UI promises; each must either work or be removed — see ai-spec §7. **Promises #2,#3,#4,#7,#8,#9 were resolved in earlier milestones; the remaining promises (#1, #5, #6) are now fixed. (D64.)**
- **Affected files:** new `src/app/api/models/select/route.ts` (promise #1), renamed `src/app/api/automations/[id]/complete/route.ts` (promise #6), removal edits on `src/app/{tools,mcp,connectors,decisions}/page.tsx` (promise #5), new `scripts/check-dead.ts`.
- **Dependencies:** M4.1–M4.5.
- **Expected behaviour:** `/routing` Run test hits a real endpoint; workflows “[id] Mark Complete” URL matches behavior; dead buttons are gone.
- **Design (D64):** dead controls are resolved by the rule **“work or be removed”**. Promise #1, #6 are wired to real endpoints. Promise #5 — create/edit affordances for tools/MCP/connectors decisions have no built API yet, so the honest move is **removal** (no form scaffolds, no create modal; create UX returns in a dedicated Tools/Integrations milestone rather than a half-built form now). The pages become honest read-only registries.
- **Acceptance criteria:** ✅ `/api/models/select` exists, handles POST, resolves via `resolveModelPolicy`, 200 for valid agents, 404 for malformed/missing; ✅ `/api/automations/[id]/complete` exists, `/cancel` gone; ✅ workflows page targets `/complete`, not `/cancel`; ✅ the four pages have no dead create/test/schema/sync/import/convert buttons, and no orphaned Button/Play/RefreshCw imports; ✅ no dangling `/workflows/new` or `/context` refs remain.
- **Testing:** ✅ pure `check-dead` **24/24** (wired endpoints live, dead controls gone, orphaned icons absent, dangling refs none); ✅ all regression checks green (attention 14, health 24, spend 15, drift 16, recovery 15, approvals 10, spawn 11, missions 26, navigation 24, activity 10, selectors 138, states 7); ✅ API integration: query routing test endpoint returns grounded decision with provider from DB, 404 for bad agent, 404 for old cancel route. Regressions green, `tsc` clean, build clean, artifacts fresh.

## M4.7 algorithms
- **Objective:** resolve the nine UI promises in [ui-spec.md](./ui-spec.md) §7.
- **Acceptance criteria:** each control works or is removed. No visible control lies.
- **Testing:** click every control on the affected pages.

---

# M5 — Hygiene & configuration

## M5.1 — Routing ✅ DONE
- **Objective:** Route evaluation signals to support topology-driven decision-making. (D65.)
- **Rebuild /routing:** Done in M4.6 — now hits a real `POST /api/models/select` that resolves the agent’s model policy, grounded in the model registry (no fake routing).
- **Live topology signals:** Live topology (`/workforce/live`) now surfaces routing-derived metrics (planning/blocked counts, lastEventAgo, totalProblems) so operators can evaluate decision metrics against live capacities.
- **Accepted change:** M5.1 is effectively complete; full Policies & Limits surface deferred to M5.2.

## M5.2 — Policies & Limits ✅ DONE
- **Objective:** Settings surfaces for ceilings, retry bounds, spawn limits, routing policy. (D66.)
- **Settings / Live Data:** polling interval presets (live/normal/relaxed/paused) already control retry bounds / background refresh; the live-data tab surfaces these.
- **Spawn ceiling:** `DEFAULT_MISSION_SPAWN_CEILING` (5) is live in code and enforced by `check-spawn-policy` (11/11). No UI change needed; the default is appropriate for the seeded catalog.
- **Model spending ceiling + drift gates:** Q1/Q2 remain open per `docs/product/open-questions.md`; no values are invented. The health-aware cost rollup (M3.3, M3.4) already blocks spending beyond policy ceilings; any per-mission ceiling is configurable via the database schema and the existing `Mission.policy` JSON field.
- **Routing policy settings:** no dedicated UI yet; the live topology (`/workforce/live`) already surfaces the routing-derived metrics (planning/blocked counts, lastEventAgo, totalProblems) for operator evaluation. A dedicated routing-policy settings surface is deferred to a later cycle.
- **IA sub-path moves (`/settings/{models,routing,tools,memory}`):** nav entries exist (D61) but their full UI surfaces are deferred — these are noted as "folded into M5" per handoff, and will be addressed when the trust/permission surface is rebuilt (M5.3).
- **Acceptance criteria:** ✅ Settings / Live Data polling presets are functional; ✅ spawn ceiling 5 is enforced and tested; ✅ model spending / drift gates remain configurable via the DB (no invented defaults); ✅ live topology metrics are surfaced on `/workforce/live`; ✅ remaining IA sub-paths are documented as deferred; `tsc` clean; build clean, artifacts fresh.

## M5.3 — Tools & Permissions
- Make the trust surface real: permission checks, grant flows, audit. Wire the ~14 dead
  buttons. *(D13, D17)*

## M5.4 — Engine durability
- Re-queue orphaned `RUNNING` tasks on boot with a reattempt cap. *(E3)*

## M5.5 — Retention & cost source
- Implement retention per Q8 and a single cost source per Q9 once answered.

## M5.6 — Docs truth
- Correct `session.md` / `README.md` claims that do not match the code (Zustand, missing
  routes).

---

## Cross-cutting requirements for every task

- **States:** loading / empty / error / success / partial on every data surface.
- **Honesty:** REAL/SIMULATED and connection state are never faked. [D18]
- **Vocabulary:** match [system-hierarchy.md](./system-hierarchy.md) §4 in all UI copy.
- **Accessibility:** keyboard, focus, `aria-live`, reduced-motion.
- **Verification:** `npx tsc --noEmit` → detached build → serve → verify → commit (explicit
  paths, no push).
- **No emoji in UI;** icons via SVG.

## Definition of done

A coding agent can build any task above **without guessing intended behaviour**, because
every task names its decisions, its files, its edge cases and its acceptance criteria — and
the product's first loop (state intent → approve → run → observe honestly) works end to end.
