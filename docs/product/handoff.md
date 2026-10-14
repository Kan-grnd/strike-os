# Strike OS — Build Handoff

**You are the building agent. Read this document first, then
[implementation-plan.md](./implementation-plan.md).** Everything you need to build without
guessing is in these two files plus the product docs they link to.

---

## 0. The one rule

**Close the intent → execution loop, honestly.** Stating intent must produce real running
work, and the interface must never present simulated work as real. Everything else in this
plan is secondary to those two things. [CONFIRMED — D19, D18]

---

## 1. Context — what Strike OS is

**An operating system for a persistent, autonomous AI workforce.** One solo operator
directs standing work; a workforce of AI workers carries it out continuously, including
when the operator is not watching. The operator's second job is knowing the work is being
done well.

- **Operator:** a solo operator/founder. Time-poor, technical, outcome-focused. They will
  not maintain an org chart or click through ten screens to find a blocker.
- **The Brain orchestrates** — plans, delegates, supervises, recovers, escalates. It is a
  real, observable entity, not a decorative orb.
- **Specialists** own standing domain work; **Agents** are general-purpose and retaskable;
  **Sub-agents** are ephemeral, spawned per task and reaped.
- **A Mission is persistent; an Operation is a run; a Task is an atom.** Health rolls up
  Task → Operation → Mission.
- **Control is at mission + policy level**, not per-worker. The operator sets cadences,
  ceilings, permissions and approvals.

Full detail: [product.md](./product.md), [system-hierarchy.md](./system-hierarchy.md).

---

## 2. The state of the code — what is real and what is fake

**Read this before trusting anything in the UI.** The low-level machinery is real; the
high-level product is not. Do not assume a screen that renders is a screen that works.

### Real (build on these)
- **The scheduler.** `instrumentation.ts` → `startEngine()` → `TaskEngine.start()`, a 2s
  `setInterval` (`src/lib/task-engine.ts:53`) that picks up any `QUEUED` task globally and
  drives `QUEUED → ASSIGNED → RUNNING → COMPLETED/FAILED`, with dependency resolution,
  timeouts and **bounded retry with exponential backoff**. **Note (fixed, D44):** it only
  actually started once `experimental.instrumentationHook` was enabled in `next.config.js` —
  before that `register()` never ran and the loop silently froze at `QUEUED`. Now it starts at
  boot (`[TaskEngine] Started scheduling loop` in the server log). On each terminal task it
  also calls `settleMissionIfComplete` so the mission + its `Operation` roll up.
- **The agent state machine.** 15 states in `src/lib/runtime-state.ts:12-71`.
- **The runtime store.** Cursor polling, stale-event guards, TTL transient edges (15s),
  flashes (4s), resync. Keep it — the confirmed model validates this design.
- **The event bus** (`src/lib/events.ts`) with a persisted `Event` table.
- **The model gateway** (`src/lib/model-gateway.ts`) with real provider adapters and a
  fallback chain (`:146-179`).
- **The topology renderer**, the chat path, and the observability pages read real data.

### Scaffolding (declared and consumed, but never emitted or never called)
- ~~`brain.state.changed` — declared and consumed, **never emitted** (`events.ts:92`).~~
  **Emitted since M2.1 (`a82073b`)** — `setBrainState` (`src/lib/brain.ts`) persists a
  `BrainState` singleton and emits the event from planning/launch/task/retry/settlement.
- ~~`spawnAgent()` (`runtime-state.ts:411`) — never called during execution; the
  `delegating` state is never set; `delegation.*` / `agent.spawned` never emitted.~~
  **Real since M2.2 (`a61b550`)** — `materializePlan` gap-fills a missing owner by
  spawning a sub-agent (emits `agent.spawned`); `assignTask` emits `delegation.started`
  (`brain → agent`) and terminal transitions emit `delegation.completed`. `communication.*`
  / `verification.*` emitters remain deferred to M2.5/M3.
- `TriggerEngine` / `ActionEngine` — singletons with **zero callers**
  (`automation-triggers.ts:213`, `automation-actions.ts:274`).
- `Approval` — model exists, **no auto-creation, no resolve endpoint, nothing blocks**
  (`api/approvals/route.ts`); `waiting_for_approval` never set.
- Dependency policies `ESCALATE` / `ABORT_BRANCH` / `SPAWN_REPLACEMENT`
  (`runtime-state.ts:43-53`) — **never referenced**.
- Tools echo their input and report a hardcoded `successRate: 99` (`tool-fabric.ts:61-84`).
- The SSE endpoint returns one hardcoded "connected" event and closes
  (`observability/events/route.ts:13-28`).

> **Resolved in M1 (`13de2e8`):** `selectModel()` was removed (no callers);
> `checkCompletion()` is now driven by `settleMissionIfComplete` (`src/lib/completion.ts`),
> called from the task engine on every terminal transition — missions and their operations
> complete; the silent-degradation defect is gone.

### Silent degradation — **fixed in M1 (`dc7d4c3`)**
`RealTaskRunner` no longer catches provider failures to fabricate a result: `mockFallback`
was **deleted**, so a provider failure now throws and the task goes `FAILED` (no fake
success). The `simulated` flag is persisted to `Task.simulated` and marked in the UI. The
**remaining** simulation is honest: with no provider configured the engine runs
`MockTaskRunner` and labels everything simulated (D18).

### Prototype tells (do not build on these; remove or fix them)
- `/routing` is 100% mock and its "Run test" POSTs to a non-existent `/api/models/select`
  → always 404 (`src/app/routing/page.tsx:23,52`).
- Dashboard KPIs hardcoded: `planning: 0`, `blocked: 0`, `totalProblems={0}`
  (`src/app/page.tsx:177-200`); `lastEventAgo` is the literal `"recent"`.
- `NEXT_PUBLIC_DASHBOARD_SAMPLE` renders the whole home page from hardcoded data
  (`page.tsx:90-117`).
- `toHourSeries` is a dead 24-iteration loop (`page.tsx:73-78`).
- `demo-seed.ts:688-706` fabricates `agent.thinking`/`blocked`/`waiting` events.
- ~14 dead buttons across `/tools`, `/mcp`, `/connectors`, `/decisions`.

### Dev guards that are permanently off
Every guard tests `dbUrl.includes("dev.db")` against a **Postgres** database, so it never
matches: `demo-seed.ts`, `api/admin/clean-content/route.ts:10`,
`api/admin/reset-demo/route.ts:11`, `edit-tickets.ts:224` (this one has an
`ALLOW_EDIT_TICKETS=true` escape).
- ~~`specialist-bundles.ts` `specialistsAllowed()`~~ **Removed in M2.4 (`47e36cd`)** — the
  guard 403'd the forge in every real configuration; deploying a specialist is a normal
  operator action. The forge lives at `/architect`.

### App shape
31 `page.tsx` (all `"use client"`), 31 `layout.tsx`, and **no** `loading.tsx` /
`error.tsx` / `not-found.tsx` anywhere. `src/store/` is empty (the README claims Zustand);
real state is `src/lib/runtime/store.ts` + SWR.

---

## 3. Corrections to the earlier audit — read before starting

Reading the code corrected five things. **The earlier summary overstated some work; these
are the accurate versions.**

1. **Mission task creation already exists.** The *route* `POST /api/missions`
   (`api/missions/route.ts:29-51`) creates no tasks — but `MissionEngine.createMission`
   (`mission-engine.ts:138-212`) **already creates tasks** with dependency resolution,
   agent-type matching and `task.created` events. The route simply never calls the engine.
   **M1.2 is wiring, not building.**
2. **Retry already exists.** Bounded retry with exponential backoff is implemented
   (`task-engine.ts:128-158`), and on exhaustion it emits `task.failed` with
   `retryExhausted: true`. What is missing is **recovery** (reassign / fallback / spawn)
   and **escalation** — not retry. (M3.2)
3. **The `simulated` flag already exists.** `MockTaskRunner` returns `simulated: true`
   (`task-engine.ts:31`) and `mockFallback` does too (`task-runner-real.ts:121`); it is
   written into `Task.output` JSON. The gap is **surfacing and persistence**, not data.
   (M1.4)
4. **The stale model-policy read is in two places.** `RealTaskRunner.parseAgentPolicy`
   (`task-runner-real.ts:104-112`) **and** `ModelGateway.parsePolicy`
   (`model-gateway.ts:198-204`) both read `agent.memoryScope`. The real `modelPolicy` and
   `fallbackModelIds` columns exist and are unused (`schema.prisma:54-55`). (M1.5)
5. **Status vocabulary — RESOLVED (G1).** Keep the code vocabulary
   `PLANNING / READY / RUNNING / PAUSED / COMPLETED / FAILED / CANCELLED`
   (`schema.prisma:118`, `mission-engine.ts`). The spec's earlier `DRAFT / ACTIVE` proposal
   is dropped; the docs were patched to match. No engine rename.

---

## 4. Ground rules — how to work in this repo

**Repo:** `/home/kan/strike-os-redesign`, branch `feat/glass-material-system`.
The shell cwd defaults to `/home/kan` — always `cd` first.

**The standing workflow, every task:**
1. `npx tsc --noEmit` (use `timeout` ≥ 420000).
2. Detached build:
   `setsid nohup npx next build > /tmp/build-<name>.log 2>&1 < /dev/null &`
3. Serve: kill the exact PID from `ss -ltnp | grep :3010` (**never** `pkill -f`), then
   `setsid nohup npx next start --port 3010 --hostname 127.0.0.1 > /tmp/next3010-<name>.log 2>&1 < /dev/null &`
4. Verify: `/` returns 200, zero `/_next/static.*404`, and
   `find src -newer .next/BUILD_ID` is empty.
5. Commit with **explicit paths** (never `git add -A`). **Never push.**

**Hard constraints:**
- **Never run `npm run build`** — it runs `prisma migrate deploy`. (Postgres is now **up**, but
  keep using the detached `npx next build` path anyway.)
- Detached build/serve calls usually hit the 120s shell timeout — poll the log with a
  follow-up `sleep` call rather than blocking.
- **No browser or screenshot tooling.** Visual verification is the operator's eyes only.
- `cn()` is `clsx` + `tailwind-merge` (`src/lib/utils.ts:5`).
- One commit per workstream. Never commit unserved code.

**Database (as of M1 verification):** a throwaway PostgreSQL 18.4 runs at `127.0.0.1:5433`
(user `strike` / `strikeos`, db `strike_os_redesign`) via `embedded-postgres` launched from
`/tmp/opencode/strike-pg/start.mjs`. It is **ephemeral** (gone on reboot) — restart it from
that script. Migrations: `20260928150459_init`, `20261001184414_add_memory_categories`,
`20261014023002_m1_operations_and_policy`. Seed: `npx tsx prisma/seed.ts`. `psql` is **not**
installed — query through the `pg` npm package (`/tmp/opencode/strike-pg/node_modules/pg`) or
the API.

---

## 5. Decision gates — resolve before the task that needs them

### G1 — Mission status vocabulary ✅ RESOLVED
**Kept the code's vocabulary** (`PLANNING` / `READY` / `RUNNING` / `PAUSED` / `COMPLETED` /
`FAILED` / `CANCELLED`) — zero churn, UI + engine + event bus agree. The `DRAFT` / `ACTIVE`
rename is dropped and the spec docs were patched to match. **M1.3 is unblocked.**

### G2 — The `RECOMMENDED` IA items (blocks M4.3)
These are proposals, not confirmed decisions. Build them unless vetoed:
- Five-domain IA: Control Center · Missions · Workforce · Activity · Settings (D20).
- Demote Colony from primary navigation (D21).
- Retire the route redirects and the merged `/work` (D22).
- Rename Observatory/Observability → **Activity** (D23).
- Rebuild `/routing` or mark it a preview (D24).

### G3 — Open questions that do not block M1
Spending-ceiling granularity, drift signals, overlapping operations, approval timeout,
Brain memory, retention, cost source of truth. See
[open-questions.md](./open-questions.md). **Do not invent answers** — leave the behaviour
configurable and flag it.

---

## 6. Conventions

- **Vocabulary:** match [system-hierarchy.md](./system-hierarchy.md) §4. "Brain" never
  means models or routing. "Operation" is a run, never a count. "Specialist" means standing
  domain responsibility.
- **States:** every data surface defines loading / empty / error / success / partial
  ([ui-spec.md](./ui-spec.md) §3). No bare spinners, no blank pages.
- **Honesty:** REAL/SIMULATED and connection state are never faked
  ([realtime.md](./realtime.md) §5). Never substitute sample data for real data.
- **Accessibility:** keyboard operation, visible focus, `aria-live` for live changes,
  `prefers-reduced-motion` respected ([ui-spec.md](./ui-spec.md) §5).
- **No emoji in UI** — use SVG icons.
- **Design system:** preserve the existing glass material system, tokens and the
  accent/density/radius-profile settings. Do not redesign.

---

## 7. The plan

The full, corrected task list is in **[implementation-plan.md](./implementation-plan.md)**.

```
M1  Close the intent → execution loop     ← START HERE [CONFIRMED, D19]
M2  The workforce becomes real            (Brain, delegation, Specialists)
M3  The intervention contract             (approvals, recovery, health, ceilings)
M4  Attention-first surfaces & honesty    (IA, Control Center, Activity)
M5  Hygiene & configuration               (routing, policies, dead controls)
```

Each milestone is independently shippable. Within a milestone, tasks are ordered.

---

## 8. Where to start

**M1 status: ✅ DONE — verified end to end on a served build against a real database** (`13de2e8`).
M1.1–M1.5 all landed (`76e96e2`, `dc7d4c3`, `3273372`, `13de2e8`). The `Operation` model,
`Task.parentOperationId` and `Task.simulated` columns are live (migration `20261014023002`,
D40 resolved); the task→operation→mission policy chain is implemented; and the scheduler now
actually starts (D44). **Verified flow:** create → simulated plan → approve → tasks run
(simulated) → operation + mission `COMPLETED` with rolled-up cost, events
`mission.created → mission.started → mission.completed`. Nothing has yet run against a **real**
model provider — with no provider configured the whole loop runs in honest simulation.

**M2.1 status: ✅ DONE — verified e2e** (`a82073b`). The Brain is now a persisted,
observable entity: a `BrainState` singleton (migration `20261014090431_m2_brain_state`)
plus real `brain.state.changed` emissions from planning/launch/task/retry/settlement,
surfaced at `/workforce/brain` (`GET /api/brain`). **Verified flow:** planning → idle
(Planned 3 steps, simulated) → delegating (3 tasks) → supervising ×3 → idle
(Mission completed). `computeBrainRuntime` (health) is unchanged; activity is the new
beside-it signal (D45).

**M2.2 status: ✅ DONE — verified e2e** (`a61b550`). Delegation is real: `assignTask`
emits `delegation.started` (`brain → agent`) and every terminal transition emits
`delegation.completed`; `materializePlan` gap-fills a missing owner by spawning a
sub-agent (`agent.spawned`). **Verified flow:** mission with no matching agents →
1 sub-agent spawned → 3 tasks delegated (`brain → spawned agent`) → mission `COMPLETED`.
Scope: delegation + spawn only (D46); `communication.*`/`verification.*` emitters deferred.

**M2.3 status: ✅ DONE — verified** (`c2feedf`). New `src/lib/spawn-policy.ts`:
`DEFAULT_MISSION_SPAWN_CEILING` (5), `resolveSpawnCeiling` (policy override via
`Mission.policy.spawnCeiling`), `intersectGrants` (pure). `spawnAgent` now intersects the
child's requested grants with the parent's — it inherits the parent's when it asks for
nothing, and a requested grant the parent lacks is denied and recorded
(`permission.denied`). `materializePlan` enforces the per-mission ceiling (counting
`agent.spawned` for the mission); past it the spawn is refused and recorded (`spawn.denied`)
and the step runs unowned. **Verified:** e2e ceiling 0 → 3 `spawn.denied`, 0 spawned, 3
unowned tasks, mission `COMPLETED`; default ceiling → 1 spawned, 3 owned, `COMPLETED`;
`check-spawn-policy` 11/11. The operator-facing blocking gate + pause is M3.1 (D47).

**M2.4 status: ✅ DONE — verified e2e** (`47e36cd`). The permanent 403 is gone — the
dev-only `specialistsAllowed()` guard (which tested a SQLite `dev.db`) was removed; the
forge UI that already lived at `/architect` (template cards, Deploy, Run trial) now works
against Postgres. `SpecialistTrialRecord.simulated` is set and the UI labels trials
**SIMULATED** (the benchmark runs through `MockTaskRunner`). **Verified:** all 4 bundles
deploy (201) → trial PASS + `simulated=true` + `ACTIVE`; all 4 specialists appear in the
roster; redeploy denied 409. Domain move to `/workforce/specialists` and the
permission-prompt gate are deferred (M4.3 IA / M3.1 approvals). D48.

**M2.5 status: ✅ DONE — verified in place** (no code change, so no commit). The live work
flow already exists at `/topology`: it subscribes to the runtime store (2s poll), draws
`delegation.*` edges (15s TTL) onto a `brain` node (`BRAIN_NODE_ID`), has an honest empty
state, and transitions `CONNECTED → DISCONNECTED → RECONNECTING` per E5 (poll failure sets
`needsResync`, then a cursor resync — never a stale frame implying liveness). **Verified:**
a ghost-agent mission spawned 1 sub-agent and emitted 3 `delegation.started`
(`from="brain"` → that agent, one per task) with the agent present in the live snapshot.
The planned `/workforce/live` is a *relocation* (unconfirmed five-domain IA, G2) → deferred
to M4.3. D49.

**M2 complete.**

**M3.1 status: ✅ DONE, verified** — commit **`6541559`**. Approvals are now a real gate.
New `src/lib/approval-policy.ts` (the six intervention triggers, default pause scope per
D29, deny meaning per E10) + `src/lib/approvals.ts` (`requestApproval` creates a PENDING
gate and pauses the scope; `resolveApproval` is idempotent — the first decision wins, a
raced second resolve returns the existing outcome with no repeat effect, never auto-expires
to approved). `Approval` gained `trigger`/`scope`/`missionId`/`operationId`/`taskId`/
`requestedBy`/`resolutionNote` + the `m3_approval_scope` migration. The task engine skips
work in a gated operation/mission (derived from PENDING approvals) and `agentBlockedFromWork`
now treats `waiting_for_approval` as blocking; owning agents move there when a gate fires.
Two triggers are wired live (D50): **spawn-past-ceiling** (mission-engine — the run starts
`PAUSED`; approving spawns the sub-agent and assigns the step) and **new-tool-permission**
(tool-fabric — approving grants the tool). `POST /api/approvals/[id]` resolves. Deny is
trigger-aware (D52): blocking gates cancel the scope (partial), capability gates let the
work continue. **Verified 45 checks:** pure policy (10); all six triggers pause +
idempotency + deny matrix (20); live wiring via HTTP + tool fabric (13); scheduler
**holds** a gated QUEUED task then runs it on release (2). `tsc` clean; nav 19/19;
selectors 138/138; spawn-policy 11/11; graph 64/0; build clean.

**Next: M3.2 — Failure recovery** (bounded retry already exists → reassign → fallback model
within policy → spawn replacement; if all fail, escalate with context; health degrades.
Outside-policy fallback is a gate — call the M3.1 `requestApproval` primitive here). Same
loop: implement → `tsc` → detached build → serve `:3010` → verify → commit (explicit paths,
no push).

> **M3.1 note for the UI:** the control center (`/`) already lists approvals (rough, via
> `useApprovals`) and `/decisions` exists, but neither can resolve a gate yet — the
> actionable "Needs you" queue is **M4.1**. Operators resolve via `POST /api/approvals/[id]`
> until then.

> **Pre-existing check failures (not ours):** `scripts/check-node-contrast.ts` and
> `scripts/check-orb-palette.ts` both abort because a `clean` theme is referenced but
> missing from the theme registry / `globals.css`. Unrelated to M2.1 (no theme files
> touched). The `npm run build` script includes these, so use `npx next build` directly.

**M1 exit criteria:** ✅ met (see above).
