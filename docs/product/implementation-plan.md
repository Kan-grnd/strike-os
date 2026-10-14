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

## M1.1 — A real planner

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

## M1.2 — A mission actually creates work

- **Objective:** approving a mission persists an Operation and its Tasks, which the
  existing scheduler picks up.
- **Affected files:** `src/app/api/missions/route.ts` (:29-51 — bypasses the engine),
  `src/lib/mission-engine.ts` (`createMission` :138-212 — already creates tasks),
  `prisma/schema.prisma` (add `Operation`; add `Task.parentOperationId`),
  `src/lib/engine.ts` (`getDb()` :24-27).
- **Dependencies:** M1.1.
- **Expected behaviour:** the route calls `getMissionEngine()` → `createMission(...)`,
  which creates one `Operation` (`PLANNING→RUNNING`) and its `Task` rows (`QUEUED`), each
  with `parentOperationId`. Within one 2s tick the scheduler claims them.
- **Acceptance criteria:**
  - Approve a mission → 1 `Operation` + N `Task` rows with `status=QUEUED`.
  - Within 3s a task transitions `QUEUED→ASSIGNED→RUNNING`.
  - Every task has `parentOperationId`.
- **Edge cases:** E19 (idempotent launch), E14 (edit-during-planning).
- **Testing:** integration — launch against a test DB, assert task creation and a `RUNNING`
  transition; double-POST asserts a single mission.
- **Gotcha:** `createMission` assigns `ownerAgentId` by type-matching and falls back to
  `agentIds[0]` (`:167-168`), so a step can land on an agent that cannot do it. Tighten
  here rather than later. Also fold `getDb()` onto the shared `@/lib/db` singleton — it
  currently constructs a second `PrismaClient` (two pools).

## M1.3 — Plan review & the launch gate

- **Objective:** nothing runs until the operator approves the plan.
- **Affected files:** new `src/app/(missions)/new` route; `mission-engine.ts`
  (`startMission` :214-232).
- **Dependencies:** M1.1, M1.2, **G1 resolved** (status vocabulary).
- **Expected behaviour:** `/missions/new` shows the plan (steps, workers, cadence, cost,
  permissions); the operator can edit then approve; approval launches; abandoning creates
  nothing.
- **Acceptance criteria:**
  - No task exists before approval.
  - Editing cadence/cost before approval is reflected in the created Operation.
  - Abandon leaves no rows.
- **Edge cases:** E1, E19.
- **Testing:** e2e — plan → approve → run; plan → abandon → no rows.
- **Gotcha:** `createMission` writes `status: "READY"` (`:156`) and `startMission` accepts
  `["READY","PLANNING"]` (`:217`). Under **G1 option B** these become `DRAFT` / `ACTIVE`.

## M1.4 — Honest simulation, end to end

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
- **Note:** the flag **already exists** in `Task.output` JSON (`task-engine.ts:31`,
  `task-runner-real.ts:121`). Add a real `Task.simulated` boolean column so it is
  queryable, set it in `runTask`, and **delete `mockFallback`** — the runner must recover
  (M3.2) or throw.
- **Reality check:** with `.env` holding only `DATABASE_URL` and no `secrets` rows,
  `hasApiKeys()` is false → the engine runs `MockTaskRunner` → **the whole product is
  simulated today.** The banner will be on from day one until a provider is configured.

## M1.5 — Correct model policy on tasks

- **Objective:** routing uses the mission/task policy, not a repurposed field.
- **Affected files:** `src/lib/task-runner-real.ts` (`parseAgentPolicy` :104-112),
  `src/lib/model-gateway.ts` (`parsePolicy` :198-204, `selectModel` :65-143).
- **Dependencies:** none.
- **Expected behaviour:** policy resolves **task → operation → mission → agent default**;
  `memoryScope` is never consulted for model choice.
- **Acceptance criteria:** a task whose mission policy names model M executes on M
  regardless of the agent's `memoryScope`.
- **Edge cases:** E20.
- **Testing:** unit — policy resolution order.
- **Gotcha:** the bug is in **two** places, and `selectModel` has **no callers** — either
  wire it in or remove it. A router nobody calls is a lie in the UI.

**M1 exit criteria:** intent → approved plan → running tasks → visible REAL/SIMULATED,
verified on a served build.

---

# M2 — The workforce becomes real

*[D4, D5, D6, D10, D17]*

## M2.1 — The Brain is a real, observable entity
- **Objective:** a Brain with state that reports what it is doing.
- **Affected files:** new `Brain` persistence, `src/lib/events.ts` (:92
  `brain.state.changed` never emitted), new `src/app/workforce/brain`.
- **Dependencies:** M1.
- **Expected behaviour:** the Brain has states (idle/planning/delegating/supervising/
  recovering) emitted as real events; the page shows current state + recent decisions.
- **Acceptance criteria:** a planning operation emits `brain.state.changed` ≥2 times; the
  page reflects it live.
- **Edge cases:** E5.
- **Testing:** integration — event emission; e2e — page updates.

## M2.2 — Delegation is real
- **Objective:** the Brain delegates tasks and spawns sub-agents; edges and events are real.
- **Affected files:** `src/lib/runtime-state.ts` (`spawnAgent` :411, `delegating`),
  `delegation.*` / `agent.spawned` emitters.
- **Dependencies:** M2.1.
- **Expected behaviour:** delegating a task sets `delegating` and emits `delegation.*`;
  spawning creates a child agent and emits `agent.spawned`; the live graph draws real edges.
- **Acceptance criteria:** no consumed event lacks an emitter; the live flow shows a real
  delegation edge during execution.
- **Edge cases:** E11.
- **Testing:** integration — event/payload contract for each consumed event.

## M2.3 — Scoped permissions & the spawn ceiling
- **Objective:** enforce scoped subset inheritance and the per-mission spawn ceiling.
- **Affected files:** tool-permission layer, `runtime-state.ts`, mission policy.
- **Dependencies:** M2.2.
- **Expected behaviour:** a sub-agent holds ≤ its parent's permissions; spawning past the
  ceiling creates a gate and pauses (M3.1).
- **Acceptance criteria:** a sub-agent requesting a permission its parent lacks is denied;
  exceeding the ceiling gates.
- **Edge cases:** E12.
- **Testing:** unit — permission intersection; integration — ceiling gate.

## M2.4 — Specialists actually work
- **Objective:** fix the permanent 403, add the page, make install usable.
- **Affected files:** `src/lib/specialist-bundles.ts` (:167 dev guard), new
  `src/app/workforce/specialists`, `POST /api/specialists`.
- **Dependencies:** M2.1.
- **Expected behaviour:** installation works against Postgres; Specialists appear in the
  roster and can own standing work.
- **Acceptance criteria:** installing each of the 4 bundles succeeds; the roster lists it;
  the operator is prompted for permissions (a gate, M3.1).
- **Edge cases:** E13.
- **Testing:** integration — install all bundles on a clean DB.

## M2.5 — Live work flow
- **Objective:** `/workforce/live` renders real executing work; empty/reconnecting states.
- **Affected files:** new `src/app/workforce/live` (from `/topology`), runtime store.
- **Dependencies:** M2.2.
- **Expected behaviour:** the graph shows missions → operations → tasks → agents with live
  edges; reload re-populates current execution only; on drop it stops animating.
- **Acceptance criteria:** during a run the graph shows the executing agent and its
  delegation edge; killing the stream shows "reconnecting".
- **Edge cases:** E5, D12.
- **Testing:** e2e — run a mission while watching; drop the connection.

---

# M3 — The intervention contract

*[D14, D15, D16, D17, D18]*

## M3.1 — Approvals: create, block, resolve
- **Objective:** gates really pause work and are resolvable.
- **Affected files:** `src/app/api/approvals/route.ts` (nothing blocks / no resolve),
  `runtime-state.ts` (`waiting_for_approval`), the engine.
- **Dependencies:** M2.3.
- **Expected behaviour:** a gate creates a `PENDING` approval, sets `waiting_for_approval`
  and pauses the affected scope; resolve resumes or rolls back; resolution is idempotent.
- **Acceptance criteria:** the six trigger types [D14] each create a gate; the affected
  work is observably paused; a second resolve is a no-op; deny ends cleanly.
- **Edge cases:** E6–E10.
- **Testing:** integration — each trigger pauses; idempotent resolve; deny rollback.

## M3.2 — Failure recovery
- **Objective:** retry → Brain recovers → escalate, using the declared policies.
- **Affected files:** `runtime-state.ts` (`ESCALATE`/`ABORT_BRANCH`/`SPAWN_REPLACEMENT`
  :43-53), `task-engine.ts` (retry loop :128-158), health.
- **Dependencies:** M3.1.
- **Expected behaviour:** bounded retry (already built) → reassign → fallback model (within
  policy) → spawn replacement; if all fail, escalate with context; health degrades.
  Outside-policy model fallback is a gate.
- **Acceptance criteria:** a repeatedly-failing task reassigns at least once and then
  escalates; escalation carries the failure context; no silent permanent `FAILED`.
- **Edge cases:** E2, E3, E10, E20.
- **Testing:** integration — scripted failures across each recovery path.
- **Note:** **retry already exists** (`task-engine.ts:128-158`) and already emits
  `task.failed` with `retryExhausted: true` on exhaustion. Build the **recovery** and
  **escalation** steps, not the retry.

## M3.3 — Health rollup
- **Objective:** task → operation → mission health for the attention surface.
- **Affected files:** new health computation; mission/operation/task reads.
- **Dependencies:** M1.2, M3.2.
- **Expected behaviour:** health computed from children; debounced so a within-tick
  recovery does not flash.
- **Acceptance criteria:** a failing task makes its operation `DEGRADED`; a failing
  operation makes its mission `BLOCKED`, within one tick.
- **Testing:** unit — rollup matrix; integration — drive a mission into each state.

## M3.4 — Cost & drift gates
- **Objective:** spending ceilings and drift signals become real gates.
- **Affected files:** mission policy, cost accounting (`model-gateway.ts:65` hardcoded
  tables), drift detector.
- **Dependencies:** M3.1.
- **Expected behaviour:** crossing a ceiling pauses the operation and asks; drift signals
  route to the attention queue.
- **Acceptance criteria:** a mission with a low ceiling gates mid-run; a mission off
  cadence appears in "needs you".
- **Edge cases:** E15, E16.
- **Testing:** integration — ceiling breach; drift injection.
- **Note:** thresholds are **open questions** (Q1, Q2). Make them configurable; do not
  invent values.

**M3 exit criteria:** an autonomous run can proceed, gate, recover and escalate, with the
operator's decisions actually controlling execution.

---

# M4 — Attention-first surfaces & IA

*[D3, D10, D11, D20–D25]*

## M4.1 — Control Center rebuild
- **Objective:** `/` becomes the attention-first surface.
- **Affected files:** `src/app/page.tsx`.
- **Dependencies:** M3.3.
- **Expected behaviour:** a ranked "Needs you" queue, then mission health, then a live
  summary; each queue item actionable in one click.
- **Acceptance criteria:** the operator can answer "is it healthy?" in <5s and act without
  navigating. Hardcoded KPIs, `"recent"`, `toHourSeries` and `NEXT_PUBLIC_DASHBOARD_SAMPLE`
  are gone.
- **Edge cases:** E4 (honest error, no sample data).
- **Testing:** e2e — with a blocked mission, the queue shows it and resolves it.

## M4.2 — Missions list & detail
- **Objective:** the directing surface.
- **Affected files:** new `src/app/missions`, `src/app/missions/[id]`.
- **Dependencies:** M1.2.
- **Expected behaviour:** a list (health, cadence, last run, cost, next run), sorted
  "needs attention first"; detail shows operations timeline, cadence/triggers, limits,
  history. **Automations fold in as triggers on the detail page.**
- **Acceptance criteria:** a mission's triggers are editable on its detail page; no
  separate Automations surface remains.
- **Testing:** e2e — create, view, pause, resume.

## M4.3 — IA reorg
- **Objective:** apply the five-domain structure.
- **Affected files:** `src/lib/navigation.ts`, `next.config.js`, route moves.
- **Dependencies:** M4.1, M4.2, **G2 resolved**.
- **Expected behaviour:** Control Center · Missions · Workforce · Activity · Settings;
  redirects retired; the merged `/work` removed.
- **Acceptance criteria:** `scripts/check-navigation.ts` passes; every route appears
  exactly once; `/missions`, `/workflows`, `/automations` no longer redirect.
- **Testing:** run the nav checker; assert no 404s on nav targets.

## M4.4 — Activity
- **Objective:** consolidate history.
- **Affected files:** new `src/app/activity/{runs,events,traces}`; retire the
  Observatory/Observability split.
- **Dependencies:** M3.3.
- **Expected behaviour:** runs list + run detail (tasks, cost, duration, REAL/SIMULATED,
  recovery history), events, traces.
- **Acceptance criteria:** one word — Activity — everywhere; run detail shows per-task
  simulation state.
- **Edge cases:** E18 (paginate; no client-side loops).
- **Testing:** e2e — open a completed run.

## M4.5 — Universal states
- **Objective:** every data surface defines all five states.
- **Affected files:** app-level and route-group `loading.tsx` / `error.tsx` /
  `not-found.tsx` (none exist today).
- **Dependencies:** M4.1–M4.4.
- **Acceptance criteria:** no surface renders blank or a bare spinner; errors are honest
  and retryable.
- **Testing:** simulate slow/failed/empty responses per surface.

## M4.6 — Dead controls
- **Objective:** resolve the nine UI promises in [ui-spec.md](./ui-spec.md) §7.
- **Acceptance criteria:** each control works or is removed. No visible control lies.
- **Testing:** click every control on the affected pages.

---

# M5 — Hygiene & configuration

## M5.1 — Routing
- Rebuild `/routing` against a real endpoint, or mark it a preview and remove the fake
  "Run test" POST to `/api/models/select`. *(D24)*

## M5.2 — Policies & Limits
- Settings surface for ceilings, retry bounds, spawn limits, routing policy. *(D13, D14)*

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
