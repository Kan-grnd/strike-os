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
  `setInterval` (`src/lib/task-engine.ts:50`) that picks up any `QUEUED` task globally and
  drives `QUEUED → ASSIGNED → RUNNING → COMPLETED/FAILED`, with dependency resolution
  (`:64-111`), timeouts (`:113-126`) and **bounded retry with exponential backoff**
  (`:128-158`).
- **The agent state machine.** 15 states in `src/lib/runtime-state.ts:12-71`.
- **The runtime store.** Cursor polling, stale-event guards, TTL transient edges (15s),
  flashes (4s), resync. Keep it — the confirmed model validates this design.
- **The event bus** (`src/lib/events.ts`) with a persisted `Event` table.
- **The model gateway** (`src/lib/model-gateway.ts`) with real provider adapters and a
  fallback chain (`:146-179`).
- **The topology renderer**, the chat path, and the observability pages read real data.

### Scaffolding (declared and consumed, but never emitted or never called)
- `brain.state.changed` — declared and consumed, **never emitted** (`events.ts:92`).
- `spawnAgent()` (`runtime-state.ts:411`) — **never called** during execution; the
  `delegating` state is never set; `delegation.*` / `agent.spawned` never emitted.
- `TriggerEngine` / `ActionEngine` — singletons with **zero callers**
  (`automation-triggers.ts:213`, `automation-actions.ts:274`).
- `Approval` — model exists, **no auto-creation, no resolve endpoint, nothing blocks**
  (`api/approvals/route.ts`); `waiting_for_approval` never set.
- `selectModel()` (`model-gateway.ts:65-143`) — **no callers**.
- Dependency policies `ESCALATE` / `ABORT_BRANCH` / `SPAWN_REPLACEMENT`
  (`runtime-state.ts:43-53`) — **never referenced**.
- `checkCompletion()` (`mission-engine.ts:342`) — called by nothing, so missions never
  complete.
- Tools echo their input and report a hardcoded `successRate: 99` (`tool-fabric.ts:61-84`).
- The SSE endpoint returns one hardcoded "connected" event and closes
  (`observability/events/route.ts:13-28`).

### Silent degradation — the worst defect in the codebase
`RealTaskRunner` catches **every** provider failure and returns a fabricated
`simulated: true` result (`src/lib/task-runner-real.ts:68-72`). Nothing in the UI
distinguishes it. **This is the behaviour D18 exists to kill.**

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
matches: `specialist-bundles.ts:167`, `demo-seed.ts`,
`api/admin/clean-content/route.ts:10`, `api/admin/reset-demo/route.ts:11`,
`edit-tickets.ts:224` (this one has an `ALLOW_EDIT_TICKETS=true` escape).

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
5. **Status vocabulary conflict.** The code uses
   `PLANNING / READY / RUNNING / PAUSED / COMPLETED / FAILED / CANCELLED`
   (`schema.prisma:118`, `mission-engine.ts:156,217`). The product spec proposed
   `DRAFT / ACTIVE / PAUSED / COMPLETED / ARCHIVED`. **See the decision gate below.**

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
- **Never run `npm run build`** — it runs `prisma migrate deploy`, and Postgres is **down**
  at `127.0.0.1:5433`.
- Detached build/serve calls usually hit the 120s shell timeout — poll the log with a
  follow-up `sleep` call rather than blocking.
- **No browser or screenshot tooling.** Visual verification is the operator's eyes only.
- `cn()` is `clsx` + `tailwind-merge` (`src/lib/utils.ts:5`).
- One commit per workstream. Never commit unserved code.

**Because Postgres is down:** `/api/settings` returns 500, and the admin/reset/clean-content
routes and the AI fast lane cannot be exercised. Build against the code and the types;
flag anything you could not verify at runtime.

---

## 5. Decision gates — resolve before the task that needs them

### G1 — Mission status vocabulary (blocks M1.3)
The code and the spec disagree. Options:
- **A — Adopt the code's vocabulary** (`READY` / `RUNNING`). Least churn.
- **B — Adopt the spec's vocabulary** (`DRAFT` / `ACTIVE`) and rename in the engine.
  Reads correctly for standing intent; touches `mission-engine.ts` in four places plus the
  schema default.
- **C — Keep both and map at the boundary.** Worst of both.

**Recommended: B.** "An ACTIVE mission" is the correct mental model for standing work, and
the rename is contained to one file. **Proceed with B unless the operator says otherwise.**

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

**M1.1 — the real planner.** It is the head of the chain: nothing downstream can be
verified until a mission produces a genuine plan. Then M1.2 (wire the route to the engine
and add the `Operation` model), M1.3 (the plan-review gate — resolve G1 first), M1.4
(honest simulation), M1.5 (model policy).

**M1 exit criteria:** intent → approved plan → running tasks → visible REAL/SIMULATED,
verified on a served build.

**Do not start M2 until M1 is verified.** M1.4 in particular is what makes M1 trustworthy —
without it, M1.1–M1.3 produce a working loop that can silently lie, which is worse than the
current broken loop.
