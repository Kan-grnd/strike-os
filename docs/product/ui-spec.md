# Strike OS — UX Specification, Interaction Model & UI Requirements

This is the **behavioural** spec: what each screen is for, what the operator can do, and
what happens in each state. Visual direction is already set by the existing design system
(the glass material system, accent/density/**radius profiles**) and must be **preserved**,
not replaced. Colours and spacing are not contentious here; behaviour is.

---

## 1. The interaction model

Four interaction rules, derived from the confirmed operator and control model.

**IM1 — Direct by intent, not by configuration.** [CONFIRMED]
The primary input is a **global command bar** present on every screen: state a mission,
ask the Brain a question, or jump to anything. Chat is the conversational view of the same
surface — not a separate silo (today it is a bolt-on with its own layout).

**IM2 — One-click interventions.** [CONFIRMED]
Anything in the "Needs you" queue is resolvable without navigation: approve/deny, resume,
retry, open the mission. No modal maze, no "go to Settings to fix".

**IM3 — Drill down, never across.**
The work hierarchy is the navigation spine: Mission → Operation → Task → Agent. Clicking a
node always reveals the next level in place or one step down; it never dumps the operator
into an unrelated infrastructure page.

**IM4 — The interface never lies.** [CONFIRMED]
See [realtime.md](./realtime.md) §5. REAL/SIMULATED, connection state and empty states are
all honest. Sample data is visibly sample data.

**Destructive actions** (delete mission, deny a long-running gate, uninstall a Specialist)
require explicit confirmation and state the consequence.

---

## 2. Screen specifications

### S1 — Control Center (`/`) ★ attention-first primary surface

- **Purpose:** answer "is my workforce healthy, and what needs me?" in one glance.
- **Primary user goal:** know it's healthy. **Primary action:** resolve the top item.
- **Information hierarchy:**
  1. **Needs you** — ranked queue (approvals, escalations, drift, system-authored
     missions). Each row: what, which mission, how long waiting, one primary action.
  2. **Mission health** — the active missions, each with `HEALTHY/DEGRADED/BLOCKED/FAILING`
     and a one-line "what it's doing".
  3. **Live now** — compact summary; links to Workforce → Live.
  4. Secondary: cost today, recent completions.
- **States:** loading = skeleton queue + mission cards; empty = "No missions yet — state
  your first"; error = explicit, **no sample data**; partial = whatever loaded, with the
  failed region marked.
- **Must remove:** hardcoded KPIs (`planning: 0`, `blocked: 0`, `totalProblems={0}`), the
  literal `lastEventAgo:"recent"`, the `NEXT_PUBLIC_DASHBOARD_SAMPLE` path.

### S2 — Missions (`/missions`)

- **Purpose:** the operator's home for standing intent.
- **Primary action:** open a mission. **Secondary:** new mission, pause/resume, filter by
  health.
- **Layout:** a list (not a card grid) — health, cadence, last run, cost, next run are the
  columns that matter. Sort defaults to "needs attention first".
- **States:** loading (rows), empty (invitation to create), error (honest), no-match
  (clear filter affordance).

### S3 — Mission detail (`/missions/[id]`)

- **Purpose:** everything about one mission.
- **Hierarchy:** header (name, state, health, origin) → objective → **operations** timeline
  (current first) → cadence & triggers → limits & permissions → cost → history.
- **Primary actions:** pause/resume, edit, run now, view a run.
- **This is where automations live** — a trigger is a row on this page, not a separate
  product. [CONFIRMED]

### S4 — New mission (`/missions/new`) ★ the planner

- **Purpose:** turn operator intent into an approved, running mission.
- **Flow:** intent → Brain plans → **operator reviews plan** → approve → launch. [CONFIRMED]
- **Plan review shows:** operations and tasks, which Specialists/Agents will do them, the
  cadence, the estimated cost, the permissions required.
- **States:** planning (live, Brain visibly `planning`), plan ready, planning failed
  (**loud, retryable — never a silent keyword fallback**), no workers installed (link to
  Marketplace), simulation mode (plan clearly labelled `SIMULATED`).
- **Editable before approval.** Approval is the gate to launch.

### S5 — Workforce overview (`/workforce`)

- **Purpose:** who is doing the work, and the Brain's state.
- **Hierarchy:** Brain state card (planning/delegating/recovering/idle, what it's waiting
  on) → Specialists → Agents → entry to Live.
- **Primary action:** drill into a worker.

### S6 — Brain (`/workforce/brain`) ★

- **Purpose:** the orchestrator, made observable. [CONFIRMED — Brain has visible state]
- **Shows:** current state, what it is planning/delegating/supervising right now, recent
  decisions, recent recoveries and escalations, and its queue.
- **Feeds:** `brain.state.changed` must actually be emitted (`events.ts:92` — declared and
  consumed but never fired).
- **States:** idle = "Nothing needs planning" + last decision.

### S7 — Specialists (`/workforce/specialists`) + Marketplace

- **Purpose:** installed domain experts that own standing work. [CONFIRMED]
- **Today:** no page; install API permanently 403 (`specialist-bundles.ts:167`).
- **Primary action:** install (from Marketplace) → grant permissions (a gate) → view.
- **States:** none installed (explain + Marketplace link), install-in-progress, install
  failed (honest).

### S8 — Agents (`/workforce/agents`) + Agent detail

- **Exists** (`/agents`, `/agents/[id]`) — keep.
- **Agent detail must show:** current state, current task, its operation/mission, its
  permissions (scoped), its sub-agents (ephemeral), recent activity.
- **Fix:** the status PATCH has no error handling (`agents/[id]/page.tsx:87-94`) — surface
  failures instead of silently doing nothing.

### S9 — Live (`/workforce/live`, was `/topology`) ★ live work flow

- **Purpose:** see what is executing right now. [CONFIRMED]
- **Renders:** missions → operations → tasks → executing agents/sub-agents, with
  delegation/verification edges lighting up live.
- **Must feed real edges:** `delegation.*`/`agent.spawned` are consumed but never emitted —
  emit them. (Today the graph can draw edges that can never occur.)
- **States:** idle ("nothing running" + last run), reconnecting (on stream drop, stops
  animating), empty canvas before first event.
- **Ephemeral:** re-populates from current execution on reload. [CONFIRMED]

### S10 — Activity (`/activity`)

- **Purpose:** what happened. History, not live.
- **Sub-surfaces:** Runs (`/activity/runs`, `/activity/runs/[id]`), Events
  (`/activity/events`), Traces (`/activity/traces`).
- **Run detail:** operations → tasks → outcomes, cost, duration, REAL/SIMULATED per task,
  and the recovery history if any.
- **Replaces:** the "Observatory"/`/observability/*` naming split — **one word: Activity.**
- **States:** paginated empty/loading/error; large history paginated (no client-side loops
  — replace `toHourSeries`, `page.tsx:73-78`).

### S11 — Settings (`/settings/*`)

Sub-pages: **Models & Providers**, **Routing** (rebuild — today 100% mock and its "Run
test" POSTs to a nonexistent `/api/models/select`, always 404), **Tools & Permissions**
(the trust surface), **Memory**, **Policies & Limits**, **Appearance**.

- **Purpose:** configure the machine — never a primary surface.
- **Appearance** already works: accent / density / **radius profile** (recently rebuilt),
  applied app-wide via `AppearanceBoot`. Keep.

---

## 3. Universal state requirements

Every data surface must define all five. No exceptions. [CONFIRMED]

| State | Rule |
|---|---|
| **Loading** | Skeleton that matches the real layout — never a bare spinner, never blank. |
| **Empty** | Explain *why* it's empty and offer the next action. Empty is often *good* ("Nothing needs you"). |
| **Error** | Explicit, honest, with a retry. **Never** substitute sample data. |
| **Success** | Confirm and offer the next action — don't dead-end. |
| **Partial** | Render what loaded; mark the failed region locally. |

**Today's gap:** there are **no** `loading.tsx`, `error.tsx` or `not-found.tsx` files at
all (31 pages, all `"use client"`). These must be added at the app and route-group level.

---

## 4. Responsive behaviour

- **Desktop-first.** This is an operating surface; the command bar, mission list and live
  flow are designed for a wide viewport. [ASSUMED — non-goal: mobile-first]
- **Must not break** down to ~390px: the mission list becomes rows/stacked cards, the
  command bar stays reachable, the live graph degrades to a **list** rather than an
  unreadable tangle.
- Tables → stacked key/value rows below the breakpoint.
- All touch targets ≥ 44px; no hover-only affordances.

---

## 5. Accessibility & keyboard

- Full keyboard operation of the command bar, the intervention queue, and the mission list.
- The attention queue is reachable and resolvable by keyboard alone.
- Live state changes are announced via `aria-live` **politely** — never on every tick.
- Colour is never the sole carrier of health — health has a label and an icon.
- Focus is visible everywhere; modals trap focus and restore it on close.
- Respect `prefers-reduced-motion`: the live flow must render meaningfully with motion off.

---

## 6. Design requirements (preserve, don't redesign)

- **Keep the existing design system:** the glass material system, the token architecture,
  the accent/density/radius-profile settings, dark and light.
- **Radius:** one 12px scale, driven by the profile setting (`[data-radius]`). Preserve the
  documented deny-list (pills, chart micro-tiles, calendar range joins, scrollbar).
- **No AI-slop:** no gratuitous gradients, glassmorphism beyond the established material,
  decorative elements without purpose, or repeated card grids. Every surface has a reason.
- **Hierarchy over decoration:** the attention queue is the loudest thing on the page; the
  live flow is the most alive; Settings is the quietest.
- **Density default suits a data-heavy operating surface** — information-dense but legible.

---

## 7. The nine dead UI promises to resolve

The audit found these render but do not work; each must either work or be removed:

1. `/routing` "Run test" → POSTs to a nonexistent endpoint (always 404).
2. Dashboard KPIs `planning`/`blocked`/`totalProblems` hardcoded to 0.
3. `lastEventAgo` literal `"recent"`.
4. `toHourSeries` — a dead 24-iteration loop.
5. ~14 dead buttons across `/tools`, `/mcp`, `/connectors`, `/decisions`.
6. `/workflows/[id]` "Mark Complete" POSTs to `/cancel` (URL/behaviour mismatch).
7. Chat reachable only by direct URL — nothing links to it.
8. `/workflows/new` and `/context` are 404s but referenced.
9. Specialist install is a permanent 403 with no page.

**Rule:** a control the operator can see must do what it says, or not be there.
