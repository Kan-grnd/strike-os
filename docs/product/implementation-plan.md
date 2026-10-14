# Strike OS — Implementation Plan

**Read this with [decisions.md](./decisions.md).** Every task cites the decisions it
implements. The order is chosen so the product works at the end of every task.

> **Gate:** no application code changes until the operator approves this plan.
> The status legend is in [decisions.md](./decisions.md).

## Sequencing

```
M1  Close the intent → execution loop     ← FIRST MILESTONE [CONFIRMED, D19]
M2  The workforce becomes real            (Brain, delegation, Specialists)
M3  The intervention contract             (approvals, recovery, health, ceilings)
M4  Attention-first surfaces & honesty    (IA, Control Center, Activity)
M5  Hygiene & configuration               (routing, policies, dead controls)
```

Each milestone is independently shippable. Within a milestone, tasks are ordered; a task
may depend on earlier tasks.

---

# M1 — Close the intent → execution loop

*This is the milestone that makes the product real. [D9, D11, D18, D19]*

## M1.1 — A real planner

- **Objective:** replace the keyword `patternMatchPlan` with a genuine LLM plan, and make
  it fail loudly.
- **Affected files:** `src/lib/mission-engine.ts` (`patternMatchPlan` :25-119,
  `llmPlan` :121-125), `src/lib/model-gateway.ts`, `src/app/api/missions/route.ts`.
- **Dependencies:** none.
- **Expected behaviour:** given intent text + available Specialists/Agents + mission
  limits, the Brain returns a structured plan: operations, tasks per operation, the
  specialist/agent intended per task, cadence, estimated cost, required permissions.
- **Acceptance criteria:**
  - A mission with intent "keep the API docs current" yields ≥1 operation with ≥1 task,
    each task naming an intended agent and a model.
  - `llmPlan` is no longer an alias for a keyword matcher.
  - Provider failure returns an **error**, never a silent fallback plan.
  - With no provider configured, the plan is returned and labelled `simulated: true`.
- **Edge cases:** E1, E2.
- **Testing:** unit — plan shape for 3 intents; integration — provider error path returns
  error not a plan; simulation path sets the flag.

## M1.2 — A mission actually creates work

- **Objective:** launching a mission persists an Operation and its Tasks, which the
  existing scheduler picks up.
- **Affected files:** `src/app/api/missions/route.ts` (:29-51 creates no tasks),
  `prisma/schema.prisma` (add `Operation`), `src/lib/task-engine.ts` (unchanged consumer).
- **Dependencies:** M1.1.
- **Expected behaviour:** approving a mission creates one `Operation`
  (`PLANNING→RUNNING`) and its `Task` rows (`QUEUED`). Within one 2s engine tick, the
  scheduler claims them and the agents execute.
- **Acceptance criteria:**
  - `POST` mission → approve → DB has 1 Operation + N Tasks with `status=QUEUED`.
  - Within 3s a task transitions `QUEUED→RUNNING`.
  - `Task.parentOperationId` is set on every task.
- **Edge cases:** E19 (idempotent launch), E14 (edit-during-planning).
- **Testing:** integration — launch a mission against a test DB, assert task creation and
  a `RUNNING` transition; double-POST asserts a single mission.

## M1.3 — Plan review & the launch gate

- **Objective:** the operator reviews the plan and approves it before anything runs.
- **Affected files:** `src/app/(missions)/new` (new route), planner API.
- **Dependencies:** M1.1, M1.2.
- **Expected behaviour:** `/missions/new` shows the plan (operations, tasks, workers,
  cadence, cost, permissions); the operator can edit then approve; approval launches;
  abandoning leaves nothing running.
- **Acceptance criteria:**
  - No task is created before approval.
  - Editing cadence/cost before approval is reflected in the created Operation.
  - Abandon creates no rows.
- **Edge cases:** E1, E19.
- **Testing:** e2e — plan → approve → run; plan → abandon → no rows.

## M1.4 — Honest simulation, end to end

- **Objective:** REAL vs SIMULATED is visible everywhere a result appears; silent
  degradation is removed.
- **Affected files:** `src/lib/task-runner-real.ts` (:68-72 silent mock),
  `src/lib/engine.ts` (`hasApiKeys` :29-54), task/run UI, `src/app/page.tsx`
  (`NEXT_PUBLIC_DASHBOARD_SAMPLE` :90-117).
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

## M1.5 — Correct model policy on tasks

- **Objective:** the task runner reads policy from the task/mission, not the agent's stale
  `memoryScope`.
- **Affected files:** `src/lib/task-runner-real.ts` (:104).
- **Dependencies:** none.
- **Expected behaviour:** routing uses the mission/task `modelPolicy`; the agent's
  `memoryScope` is never consulted for model choice.
- **Acceptance criteria:** a task whose mission policy names model M executes on M
  regardless of the agent's `memoryScope`.
- **Edge cases:** E20.
- **Testing:** unit — policy resolution order.

**M1 exit criteria:** intent → approved plan → running tasks → visible REAL/SIMULATED,
verified on a served build.

---

# M2 — The workforce becomes real

*[D4, D5, D6, D10, D17]*

## M2.1 — The Brain is a real, observable entity
- **Objective:** a Brain with state that reports what it is doing.
- **Affected files:** new `Brain` persistence, `src/lib/events.ts` (:92
  `brain.state.changed` never emitted), `src/app/workforce/brain`.
- **Dependencies:** M1.
- **Expected behaviour:** the Brain has states (idle/planning/delegating/supervising/
  recovering) emitted as real events; `/workforce/brain` shows current state + decisions.
- **Acceptance criteria:** a planning operation emits `brain.state.changed` at least twice;
  the page reflects it live.
- **Edge cases:** E5.
- **Testing:** integration — event emission; e2e — page updates.

## M2.2 — Delegation is real
- **Objective:** the Brain delegates tasks and spawns sub-agents; edges and events are real.
- **Affected files:** `src/lib/runtime-state.ts` (`spawnAgent` :411, `delegating`),
  `delegation.*`/`agent.spawned` emitters.
- **Dependencies:** M2.1.
- **Expected behaviour:** delegating a task sets `delegating`, emits `delegation.*`;
  spawning creates a child agent emitting `agent.spawned`; the live graph draws real edges.
- **Acceptance criteria:** no consumed event lacks an emitter; live flow shows a real
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
- **Affected files:** `src/lib/specialist-bundles.ts` (:167 dev guard),
  `src/app/workforce/specialists` (new), `POST /api/specialists`.
- **Dependencies:** M2.1.
- **Expected behaviour:** installation works against Postgres; Specialists appear in the
  roster and can own standing work.
- **Acceptance criteria:** installing each of the 4 bundles succeeds; the roster lists it;
  the operator is prompted for permissions (a gate, M3.1).
- **Edge cases:** E13.
- **Testing:** integration — install all bundles on a clean DB.

## M2.5 — Live work flow
- **Objective:** `/workforce/live` renders real executing work; empty/reconnecting states.
- **Affected files:** `src/app/workforce/live` (from `/topology`), runtime store.
- **Dependencies:** M2.2.
- **Expected behaviour:** graph shows missions → operations → tasks → agents with live
  edges; reload re-populates current execution only; on drop it stops animating.
- **Acceptance criteria:** during a run, the graph shows the executing agent and its
  delegation edge; killing the stream shows "reconnecting".
- **Edge cases:** E5, D12.
- **Testing:** e2e — run a mission while watching; drop the connection.

---

# M3 — The intervention contract

*[D14, D15, D16, D17, D18]*

## M3.1 — Approvals: create, block, resolve
- **Objective:** gates really pause work and are resolvable.
- **Affected files:** `src/app/api/approvals/route.ts` (nothing blocks / no resolve),
  `runtime-state.ts` (`waiting_for_approval`), engine.
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
  :43-53), engine, health.
- **Dependencies:** M3.1.
- **Expected behaviour:** bounded retry; then reassign → fallback model (within policy) →
  spawn replacement; if all fail, escalate with context; health degrades.
  Outside-policy model fallback is a gate.
- **Acceptance criteria:** a repeatedly-failing task reassigns at least once and then
  escalates; escalation carries the failure context; no silent permanent `FAILED`.
- **Edge cases:** E2, E3, E10, E20.
- **Testing:** integration — scripted failures across each recovery path.

## M3.3 — Health rollup
- **Objective:** task → operation → mission health for the attention surface.
- **Affected files:** new health computation, mission/operation/task reads.
- **Dependencies:** M1.2, M3.2.
- **Expected behaviour:** health computed from children; debounced so a within-tick
  recovery doesn't flash.
- **Acceptance criteria:** a failing task makes its operation `DEGRADED`, a failing
  operation makes its mission `BLOCKED`, within one tick.
- **Testing:** unit — rollup matrix; integration — drive a mission into each state.

## M3.4 — Cost & drift gates
- **Objective:** spending ceilings and drift signals become real gates.
- **Affected files:** mission policy, cost accounting (`model-gateway.ts:65` hardcoded),
  drift detector.
- **Dependencies:** M3.1.
- **Expected behaviour:** crossing a ceiling pauses the operation and asks; drift signals
  route to the attention queue.
- **Acceptance criteria:** a mission with a low ceiling gates mid-run; a mission off
  cadence appears in "needs you".
- **Edge cases:** E15, E16.
- **Testing:** integration — ceiling breach; drift injection.

**M3 exit criteria:** an autonomous run can proceed, gate, recover, and escalate with the
operator's decisions actually controlling execution.

---

# M4 — Attention-first surfaces & IA

*[D3, D10, D11, D20–D25]*

- **M4.1 — Control Center rebuild.** `/` becomes the attention-first surface (queue +
  mission health + live summary). Remove hardcoded KPIs, `"recent"`, dead loops,
  sample-data path. *(Deps: M3.3)*
- **M4.2 — Missions list & detail.** `/missions`, `/missions/[id]`; automations fold in as
  triggers on the detail page. *(Deps: M1.2)*
- **M4.3 — IA reorg.** Apply the five-domain structure; retire redirects
  (`next.config.js`) and the merged `/work`; update `navigation.ts`. Keep
  `check-navigation.ts` green. *(Deps: M4.1, M4.2)*
- **M4.4 — Activity.** Consolidate `/activity/{runs,events,traces}`; kill the
  Observatory/Observability split. *(Deps: M3.3)*
- **M4.5 — Universal states.** Add `loading.tsx`/`error.tsx`/`not-found.tsx` at app and
  route-group level; implement all five states per `ui-spec.md` §3.
- **M4.6 — Dead controls.** Resolve the nine UI promises in `ui-spec.md` §7 — each works
  or is removed.

---

# M5 — Hygiene & configuration

- **M5.1 — Routing.** Rebuild `/routing` against a real endpoint, or mark it a preview and
  remove the fake "Run test" POST to `/api/models/select`. *(D24)*
- **M5.2 — Policies & Limits.** Settings surface for ceilings, retry bounds, spawn limits,
  routing policy. *(D13, D14)*
- **M5.3 — Tools & Permissions.** Make the trust surface real (permission checks, grant
  flows, audit). Wire the ~14 dead buttons. *(D13, D17)*
- **M5.4 — Engine durability.** Re-queue orphaned `RUNNING` tasks on boot with a cap. *(E3)*
- **M5.5 — Retention & cost source.** Implement retention per Q8 and a single cost source
  per Q9 once answered.
- **M5.6 — Docs truth.** Correct `session.md`/`README.md` claims that do not match the
  code (Zustand, missing routes).

---

## Cross-cutting requirements for every task

- **States:** loading / empty / error / success / partial on every data surface. [ui-spec §3]
- **Honesty:** REAL/SIMULATED and connection state are never faked. [D18, realtime §5]
- **Vocabulary:** match [system-hierarchy.md](./system-hierarchy.md) §4 in all UI copy.
- **Accessibility:** keyboard, focus, `aria-live` for live changes, reduced-motion. [ui-spec §5]
- **Verification:** `npx tsc --noEmit` → detached build → serve → verify routes and static
  assets → commit (explicit paths, no push).
- **No emoji in UI;** icons via SVG/icon library.

## Definition of done for the whole plan

A coding agent can build any task above **without guessing intended behaviour**, because
every task names its decisions, its files, its edge cases and its acceptance criteria — and
the product's FIRST loop (state intent → approve → run → observe honestly) works end to end.
