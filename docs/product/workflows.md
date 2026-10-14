# Strike OS — Core Workflows

Each workflow is specified with: entry · prerequisites · action · system response ·
loading · success · failure · empty · cancellation · retry · confirmation · undo ·
persistence · permissions · notification · next action.

The flags mark which workflows are the **product's reason to exist** [CONFIRMED].

---

## W1 — Direct a mission (intent → execution) ★ the core loop

**The flagship workflow. Today it is broken: `POST /api/missions` stores a plan and creates
zero tasks (`missions/route.ts:29-51`), and the "planner" is a keyword match. Closing this
is the first milestone.** [CONFIRMED]

> **Correction:** the task-creation logic already exists in `MissionEngine.createMission`
> (`mission-engine.ts:138-212`) — the route never calls it. This is a wiring fix, not a
> build. See [handoff.md](./handoff.md) §3.

- **Entry point:** Control Center "New mission", or the global command bar, or a
  system-authored mission awaiting review.
- **Prerequisites:** at least one installed Specialist or Agent; a provider configured
  (else the app is in *simulation mode* and says so — see W9).
- **Action:** the operator states intent in natural language ("keep our API docs current
  with the code"), optionally sets a cadence, a spending ceiling and tool permissions.
- **System response:** the **Brain plans** — it returns a real plan (operations → tasks),
  the Specialists/Agents it intends to use, the cadence, and the estimated cost. Then it
  **stops and asks for approval.** [CONFIRMED]
- **Loading:** planning is a real LLM call — show a planning state on the mission, with the
  Brain visibly `planning` in the workforce view.
- **Success:** operator approves → mission goes `ACTIVE` → the Brain creates the first
  Operation and its Tasks → the scheduler picks them up → live flow lights up in
  Workforce → Live.
- **Failure:** planning fails (provider error) → **fail loudly**, offer retry; never fall
  back to a keyword plan silently. If no provider is configured, the plan is clearly
  labelled `SIMULATED`.
- **Empty:** no specialists/agents installed → the planner explains what it needs and
  links to Marketplace.
- **Cancellation:** the operator can abandon before approving — nothing is launched.
- **Retry:** re-plan is a first-class action.
- **Confirmation:** **approval of the plan is required to launch** [CONFIRMED — via the
  Brain, you approve its plan]. Editing the plan before approving is allowed.
- **Undo:** pausing a mission stops new operations; it does not retroactively erase runs.
- **Persistence:** the approved mission, its plan, its cadence and limits persist.
- **Permissions:** creating/launching a mission = operator only. The Brain may *draft* a
  system-authored mission but cannot launch it.
- **Notification:** on launch confirm; on first failure, per W4.
- **Next action:** watch it run (W3) or return to Control Center.

---

## W2 — Know it's healthy (the attention-first surface) ★

**The second half of the product's reason to exist. Today the home page is hardcoded KPIs
(`page.tsx:177-200`) and fake recency (`lastEventAgo:"recent"`).**

- **Entry point:** `/` on every visit.
- **Prerequisites:** none.
- **Action:** the operator scans.
- **System response:** a single ranked queue of **what needs the operator**, then mission
  health, then a live summary:
  1. **Needs you** — approvals (`PENDING`), escalations, gated work, drift alerts,
     system-authored missions to review. Each is **actionable in one click** [CONFIRMED].
  2. **Mission health** — every active mission with `HEALTHY/DEGRADED/BLOCKED/FAILING`,
     rolled up from operations. [CONFIRMED — health rollup]
  3. **Live** — a compact "executing now" summary linking to Workforce → Live.
- **Loading:** skeleton queue + skeletons for mission cards; never a blank page.
- **Success:** the operator can answer "is it healthy?" in under five seconds, and act on
  anything that isn't without leaving the page.
- **Failure:** if the data source fails, show an **honest error state** — never substitute
  sample data. (Today `NEXT_PUBLIC_DASHBOARD_SAMPLE` renders the whole page from hardcoded
  data — remove.)
- **Empty:** no missions yet → a single, clear "state your first mission" invitation.
- **Cancellation / retry / undo:** n/a (read surface) — except inline interventions, which
  follow W5.
- **Persistence:** n/a.
- **Permissions:** read = operator.
- **Notification:** the attention **badge** count is the persistent chrome. [CONFIRMED]
- **Next action:** drill into the mission or resolve the gate.

---

## W3 — Watch live work (live work flow) ★

- **Entry point:** Control Center "Live", or Workforce → Live (former `/topology`).
- **Prerequisites:** something is executing.
- **Action:** none — it observes.
- **System response:** a live graph of **missions → operations → tasks → executing agents
  and sub-agents**, with delegation and verification edges lighting up as they happen.
  [CONFIRMED — live work flow]
- **Loading:** empty canvas with "nothing is running" until the first event.
- **Success:** the operator can see exactly what is executing, for which mission, via which
  agent, right now.
- **Failure:** event stream drops → the view shows "reconnecting" and **stops animating
  rather than lying**; it re-syncs from cursor. (The existing store already has stale-event
  guards and resync — reuse them.)
- **Empty:** "The workforce is idle" + last run summary.
- **Persistence:** **live flow is ephemeral** [CONFIRMED] — on reload it re-populates only
  what is currently executing. History lives in Activity.
- **Permissions:** read = operator.
- **Next action:** click a node → the mission/operation/task it belongs to.

---

## W4 — Failure, recovery and escalation ★

**The contract: bounded retry → Brain recovers → escalate.** [CONFIRMED]

- **Entry point:** a task fails; the operator sees it only if recovery fails.
- **Prerequisites:** —
- **Action (operator):** none until escalation.
- **System response:**
  1. **Bounded retry** — the task re-queues up to `retryCount`.
  2. **Brain recovery** — on exhaustion the Brain attempts: **reassign** to another
     agent → **fallback model** within the mission's policy → **spawn a replacement**
     (subject to the spawn ceiling). These are the declared-but-unused `ESCALATE` /
     `SPAWN_REPLACEMENT` policies (`runtime-state.ts:43-53`).
  3. **Escalate** — if recovery fails, the operator gets an intervention with **full
     context attached** (what failed, what was tried, cost so far, affected mission).
  4. **Health degrades** — Task → Operation → Mission. [CONFIRMED — health rollup]
- **Loading:** recovery is visible in the Brain state and the live flow; not a spinner.
- **Success:** the task completes after recovery; the operator may never be bothered.
- **Failure:** unrecovered → escalation. Never a silent `FAILED` (today tasks stay failed
  forever with no notification).
- **Confirmation:** recovery within policy is automatic; a model fallback **outside policy**
  is a gate (W5).
- **Undo:** recovery decisions are logged; the operator can re-run from an operation.
- **Persistence:** all attempts, outcomes and costs persist.
- **Permissions:** operator may force-retry, cancel, or reassign at any time.
- **Notification:** only on escalation.
- **Next action:** resolve the escalation → resume, or adjust policy.

---

## W5 — Approve or deny a gate ★

**Approvals are a real blocking gate.** [CONFIRMED]

- **Entry point:** the "Needs you" queue, the attention badge, or the object's detail page.
- **Prerequisites:** a gate fired — the defined intervention set: [CONFIRMED]
  new tool permission · cost-ceiling breach · model fallback outside policy · mission drift
  · spawn past ceiling · Brain escalation.
- **Action:** the operator reads the request (what, why, what it will cost, what it is
  blocked on) and approves or denies.
- **System response:** **the affected work is PAUSED.** [CONFIRMED] On approve it resumes;
  on deny it rolls back or ends cleanly — never silently fails.
- **Loading:** the approval appears as a `PENDING` row the instant the gate fires.
- **Success:** decision recorded with an audit trail; work resumes.
- **Failure:** a resolve error must surface — the gate stays `PENDING` rather than pretend.
- **Empty:** nothing pending → "Nothing needs you," which is a *good* state, shown plainly.
- **Cancellation:** an approval can be withdrawn if the underlying work is cancelled.
- **Retry:** decisions are not retried; a new gate may fire.
- **Confirmation:** the decision itself is the confirmation; destructive outcomes
  (deny a long-running mission) get an explicit confirm.
- **Undo:** an approved decision can be revoked while the work is still resumable.
- **Persistence:** all approvals, decisions and reasons persist (audit).
- **Permissions:** **operator only** — the Brain cannot approve its own request.
- **Notification:** badge + queue.
- **Next action:** return to the mission or the queue.

---

## W6 — Review a system-authored mission

- **Entry point:** mission appears flagged `SYSTEM` in the attention queue.
- **Action:** the operator reads why the Brain created it, then approves, edits or discards.
- **System response:** it is **not scheduled until reviewed.** [CONFIRMED]
- **Success:** approved → `ACTIVE`, or edited → `DRAFT` → re-plan.
- **Empty/failure/cancel/undo:** standard; discard removes it and logs the reason.
- **Persistence & permissions:** operator-owned once reviewed.
- **Next action:** watch it, or back to the queue.

---

## W7 — Install a Specialist

**Today this is impossible: the page does not exist and the API is permanently 403.**

- **Entry point:** Workforce → Specialists, or Marketplace.
- **Prerequisites:** a bundle available.
- **Action:** install, then grant its permissions.
- **System response:** the Specialist is created, enters the roster, and its permissions
  are shown for approval — **a new tool permission is a gate** [CONFIRMED], so the
  permission grant may itself trigger W5.
- **Success:** the Specialist appears in the workforce and can own standing work.
- **Failure:** the dev-guard bug (`specialist-bundles.ts:167` — `dbUrl.includes("dev.db")`
  against Postgres) must be fixed so installation works in production.
- **Empty:** no bundles → explain how bundles are added.
- **Persistence/permissions:** installed state persists; operator-only.
- **Next action:** assign standing work to the Specialist.

---

## W8 — Configure policy and limits

- **Entry point:** Settings → Policies & Limits; or inline from a mission.
- **Action:** set spending ceilings, spawn ceilings, retry bounds, tool permissions,
  routing policy.
- **System response:** values validate and persist; changes take effect on the **next**
  operation, not mid-flight — inbound rule to avoid surprises.
- **Failure:** invalid/negative values rejected with a clear reason.
- **Persistence:** persists; these govern every future gate.
- **Permissions:** operator-only.
- **Next action:** back to Control Center, or the trust surface (Settings → Tools).

---

## W9 — The simulation-mode contract (cross-cutting)

Every workflow above obeys this: [CONFIRMED]

- If no provider is configured, the app is in **simulation mode**, flagged **app-wide**.
- Every task result carries `simulated: true/false`, and **every place a result is shown
  distinguishes them.**
- A simulated result is **never** presented as work done.
- When a real provider fails mid-run, the task either recovers (W4) or fails honestly —
  it never silently becomes simulated.
