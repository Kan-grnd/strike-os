# Strike OS — State Model & Entity Lifecycle

This defines what states exist, what they mean, how things move between them, and what
survives a restart. It is the contract the UI, the engine and the event bus all read from.

Status: structural decisions below are [CONFIRMED]; the specific enumerations I derived
from the existing code are cited as facts; anything I chose freely is marked [ASSUMED].

---

## 1. Mission lifecycle

| State | Meaning | Entered by |
|---|---|---|
| `DRAFT` | Created but not launched. Not scheduling work. | Operator creates a mission, or Brain authors one (flagged PENDING REVIEW) |
| `ACTIVE` | Standing intent is live. The Brain schedules operations on cadence/trigger. | Operator approves launch (or reviews a system-authored mission) |
| `PAUSED` | No new operations start. In-flight operations may finish or be halted per the pause scope. | Operator, or an automatic pause on a gated approval |
| `COMPLETED` | The mission's objective is met and it stops being scheduled. | Brain marks it complete (operator-confirmed if consequential), or operator |
| `ARCHIVED` | Retained for history, out of the default view. | Operator |

**Orthogonal field — `health`:** `HEALTHY · DEGRADED · BLOCKED · FAILING`. Health is
independent of lifecycle state: an `ACTIVE` mission can be `BLOCKED`, a `PAUSED` mission
can be `HEALTHY`.

**Orthogonal field — `origin`:** `OPERATOR · SYSTEM`. System-authored missions render
with a distinct marker and appear in the attention queue until reviewed. [CONFIRMED]

**Transitions**
```
DRAFT ──launch──▶ ACTIVE ──pause──▶ PAUSED ──resume──▶ ACTIVE
  │                 │  │                                │
  │                 │  └──complete──▶ COMPLETED ──archive──▶ ARCHIVED
  │                 └──fail (operator)──▶ PAUSED (health FAILING)
  └──discard──▶ (deleted)
```

> **Vocabulary conflict — resolve before building (gate G1).** The code uses
> `PLANNING / READY / RUNNING / PAUSED / COMPLETED / FAILED / CANCELLED`
> (`schema.prisma:118`, `mission-engine.ts:156,217`). This document proposes
> `DRAFT / ACTIVE / PAUSED / COMPLETED / ARCHIVED`. **Recommended: adopt this document's
> vocabulary** (`DRAFT`/`ACTIVE`) and rename in the engine — "an ACTIVE mission" is the
> correct mental model for standing intent, and the rename is contained to one file. See
> [handoff.md](./handoff.md) §5 G1.

---

## 2. Operation lifecycle — a run [CONFIRMED]

| State | Meaning | Entered by |
|---|---|---|
| `PLANNING` | Brain is decomposing the mission step into operations/tasks. | Brain, at run start |
| `AWAITING_APPROVAL` | A task in this operation hit a gate. **The operation is paused.** | Brain, on a gate trigger |
| `RUNNING` | Tasks are executing. | Brain, once the plan is accepted |
| `PAUSED` | Halts; resumable. | Operator, or parent mission pause |
| `COMPLETED` | All tasks succeeded and completion is verified. | Brain |
| `FAILED` | Unrecoverable after bounded recovery attempts. | Brain, after escalation is unresolvable |
| `CANCELLED` | Deliberately stopped; not a failure. | Operator or Brain (superseded) |

**Operation carries:** `plan`, `taskIds`, `cost`, `startedAt`, `endedAt`, `outcome`.

> **Today:** Operations do not exist as objects. Only `BrainRuntime.operationCount`.
> This is new modelling, but it maps cleanly onto the existing "one run of a mission"
> notion and requires no runtime rewrite — only a persisted row per run.

---

## 3. Task lifecycle

| State | Meaning |
|---|---|
| `QUEUED` | Persisted and eligible for the scheduler. This is the only state the engine picks up today (`task-engine.ts:50`). |
| `RUNNING` | Claimed by an agent. |
| `COMPLETED` | Succeeded. |
| `FAILED` | Terminal for the attempt-set; feeds recovery. |
| `CANCELLED` | Deliberately stopped. |

**Fields that matter to the contract:**
- `retryCount` — bounded retry before recovery/escalation. [CONFIRMED]
- `simulated: boolean` — **REAL vs SIMULATED**. Must be persisted and surfaced everywhere
  a task result is shown. [CONFIRMED]
- `parentOperationId` — ties the task to its run.
- `agentId` — exactly one executing agent (sub-agents show as their own rows with a
  `parentAgentId`).

**Transitions**
```
QUEUED ──claim──▶ RUNNING ──ok──▶ COMPLETED
   ▲                 │
   │                 ├──fail──▶ FAILED ──recovery──▶ (reassign → QUEUED | replacement spawn)
   │                 │                       └──unrecoverable──▶ escalate → attention queue
   └──retry (bounded)─┘
```

---

## 4. Agent runtime state

**Authoritative source:** `src/lib/runtime-state.ts:12-71` (15 states). That enum is the
single source of truth; do not introduce a parallel set.

The 15 states group into five behaviours:

| Group | Meaning | States include |
|---|---|---|
| At rest | Not executing; available | `idle` |
| Working | Actively progressing a task | `thinking`, `planning`, `executing` |
| Coordinating | Handling the workforce rather than the work | `delegating`, `supervising` |
| Waiting | Blocked on something external | `blocked`, `waiting`, `waiting_for_approval` |
| Terminal | An outcome was reached | `completed`, `failed`, `cancelled` |

*(The exhaustively correct list is the enum in `runtime-state.ts` — read it there.)*

**Two states that exist but are never set today** — and part of closing the loop:
- `delegating` — never set because `spawnAgent()` is never called.
- `waiting_for_approval` — never set because nothing creates or blocks on approvals.

**Dependency policies already declared:** `ESCALATE`, `ABORT_BRANCH`, `SPAWN_REPLACEMENT`
(`runtime-state.ts:43-53`) — never referenced. They become the recovery vocabulary.
[CONFIRMED — recovery = reassign / fallback model / spawn replacement]

---

## 5. Sub-agent lifecycle [CONFIRMED]

```
(none) ──spawn (within ceiling)──▶ ACTIVE
                  │
                  ├──spawn past ceiling──▶ AWAITING_APPROVAL (work pauses)
                  │
                  └──task ends──▶ REAPED (row retained for history, marked ephemeral)
```

- Ephemeral: created for one task, reaped when it ends.
- **Inherits a scoped subset of the parent's permissions** — never the full set.
- Every spawn is recorded and reported live (topology + audit trail).
- Ceiling is configured per mission; crossing it joins the intervention set.

---

## 6. Approval lifecycle [CONFIRMED — a real blocking gate]

| State | Meaning |
|---|---|
| `PENDING` | Raised; the affected work is **paused**. |
| `APPROVED` | Operator approved; execution resumes. |
| `DENIED` | Operator refused; the work rolls back or ends, not fails silently. |
| `EXPIRED` | Unanswered past a window; the gated work stays paused and is re-surfaced. |

**What creates an approval** — the defined intervention set: [CONFIRMED]
1. A new tool permission is required.
2. A spending ceiling would be breached.
3. The Brain wants to fall back to a model outside the mission's policy.
4. A mission has drifted off cadence (or a drift signal fires).
5. Spawning would exceed the mission ceiling.
6. The Brain cannot resolve something, and escalates it.

> **Today:** the `Approval` model, `waiting_for_approval` state and a read route exist.
> There is **no auto-creation, no resolve endpoint, and nothing blocks**
> (`api/approvals/route.ts`). This is a core-loop task, not a nice-to-have.

---

## 7. Health rollup [CONFIRMED]

```
task.health ──▶ operation.health ──▶ mission.health
```

| Level | HEALTHY | DEGRADED | BLOCKED | FAILING |
|---|---|---|---|---|
| Task | completed | slow / retrying | waiting on a gate | FAILED, unrecovered |
| Operation | all tasks ok | some retried | any task gated | unrecoverable |
| Mission | last runs ok | rising cost / drift | any operation blocked | operations failing |

Health is **computed** from children, never independently stored as truth. The attention
surface reads mission health first.

---

## 8. What persists vs what is ephemeral [CONFIRMED]

| Persists across restart | Ephemeral (live only) |
|---|---|
| Missions, Operations, Tasks, Agents, Approvals, Memories, Relationships | Live execution flow (topology animation) |
| Mission/Operation/Task state and health | Transient edges (delegation, verification) |
| Cost and token records | Flash/notification pulses |
| Event history / traces | Cursor position, "currently executing" glow |
| Simulation flag on every result | In-flight progress bars |

> **Today:** the runtime store already implements TTL transient edges (15s) and flashes
> (4s), with stale-event guards and a resync path. **The confirmed model validates the
> existing design** — it does not require replacing it.

---

## 9. Restart behaviour [ASSUMED unless noted]

- On boot, `instrumentation.ts` starts the engine; `QUEUED` tasks resume being claimed.
- `RUNNING` tasks whose process died are **re-queued** (with a reattempt cap), not left
  stranded — this is a gap today and an edge case in [edge-cases.md](./edge-cases.md).
- Paused missions stay paused. Pending approvals stay pending and are re-surfaced.
- The live topology starts empty and re-populates from current execution — correct by
  design, since live flow is ephemeral.
