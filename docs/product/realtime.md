# Strike OS — Realtime Behaviour & Persistence

The guiding split is confirmed: **state and history persist; the live flow is ephemeral.**
[CONFIRMED] This document says what that means per surface, and fixes the honesty problems
the audit found.

---

## 1. The two clocks

| | Persistent | Ephemeral (live only) |
|---|---|---|
| **Contents** | Missions, Operations, Tasks, Agents, Approvals, Memories, cost/events | What is executing *right now*: the live work flow, transient edges, pulses |
| **Source** | Database | Runtime event stream |
| **On reload** | Loaded faithfully | Re-populates from current execution only |
| **Truth** | Authoritative | Throwaway — losing it must not lose meaning |

`state-model.md` §8 is the authoritative table of what falls on which side.

---

## 2. How live state is delivered

> **Today:** the runtime store is cursor-polled with stale-event guards, TTL transient
> edges (15s) and flashes (4s), plus a resync path. **The confirmed model validates this
> design** — it does not need replacing. The event *stream* endpoint, however, is a stub:
> `observability/events/route.ts:13-28` returns one hardcoded "connected" event and closes.

**Recommended mechanism** [RECOMMENDED — my determination, not a product decision]:
- Keep the existing **cursor-based polling + resync** as the transport of record — it is
  already built, robust to drops, and stateless-friendly.
- Fix the SSE/stream endpoint **or remove it** so there is no fake "live" path. A stub that
  pretends to stream is worse than no stream.

The operator must never be able to tell, from the interface, which transport is in use —
that is an implementation detail. What they *must* be able to trust is that the data is
real (see §5).

---

## 3. Latency budgets

| Signal | Target | Rationale |
|---|---|---|
| A gate/approval appearing | ≤ ~2s (engine tick) | The operator must see "needs you" promptly |
| Agent state change in live flow | ≤ ~2s | Matches the engine interval (`task-engine.ts:50`) |
| Cost/usage rollup | seconds | Not realtime-critical |
| Health transition | ≤ ~2s | Drives the attention badge |

There is no product requirement for sub-second feedback — the engine itself ticks at 2s.

---

## 4. Flapping and correctness

The live view must not lie when input is noisy:
- **Stale-event guards** — out-of-order events are dropped (already implemented).
- **Transient edges expire** (delegation/verification) so a momentary hand-off does not
  leave a permanent line.
- **Debounce health transitions** — a task that fails and recovers within a tick should not
  flash the mission to `FAILING`. Health follows the **settled** state.
- **One run = one row of truth.** The live view animates; the persisted state is the fact.

---

## 5. Honesty rules (non-negotiable) [CONFIRMED]

1. **REAL vs SIMULATED is always visible** wherever a result is shown. `simulated:true`
   is never rendered as work done.
2. **Simulation mode is app-wide** when no provider is configured — stated plainly, not
   buried per-task.
3. **A dropped connection says so.** The view stops animating and shows "reconnecting";
   it does not freeze on a stale picture and imply liveness.
4. **No fabricated events.** `demo-seed.ts:688-706` currently emits synthetic
   `agent.thinking`/`blocked`/`waiting` events — a demo may generate clearly-labelled
   sample data, but it must be **visibly** sample data, never mixed into real flow.
5. **No sample-data escape hatch in production.** `NEXT_PUBLIC_DASHBOARD_SAMPLE`
   (`page.tsx:90-117`) must not substitute hardcoded content for real content.

---

## 6. Notifications

- **One persistent signal:** the attention badge count on Control Center. [CONFIRMED]
- Channel: in-app. (Desktop/email/push notifications are [OPEN QUESTION].)
- Notification-worthy: gates, escalations, health → `FAILING`/`BLOCKED`, system-authored
  missions. Nothing else — the product must not cry wolf.

---

## 7. Persistence guarantees

- Engine work is durable: a `QUEUED` task survives a restart and resumes.
- A `RUNNING` task interrupted by a crash is **re-queued** with a reattempt cap (a gap
  today — see [edge-cases.md](./edge-cases.md) E3).
- Paused missions stay paused across restart.
- `PENDING` approvals survive restart and are re-surfaced.
- Live flow deliberately does not survive — that is correct, not a bug.
