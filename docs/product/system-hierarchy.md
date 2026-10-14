# Strike OS — System Hierarchy

Two hierarchies run in parallel and must not be confused. [CONFIRMED]

- The **workforce hierarchy** answers *who does the work* — Brain, Specialists, Agents,
  Sub-agents.
- The **work hierarchy** answers *what is being worked on* — Mission, Operation, Task.

The audit's central finding was that the product's navigation expresses neither: it lists
infrastructure domains (Model Brain, Observability, Topology, Memory, Tools, Marketplace)
that describe *how the machine is built* rather than *what it is doing*.

---

## 1. The workforce hierarchy

```
                        ┌───────────────────────────────┐
                        │            BRAIN              │
                        │  The orchestrator. Plans,     │
                        │  delegates, supervises,       │
                        │  recovers, escalates.         │
                        │  Singular. Always present.    │
                        └───────────────┬───────────────┘
                                        │ delegates standing work to
                        ┌───────────────▼───────────────┐
                        │         SPECIALISTS           │
                        │  Role: deep, narrow-domain    │
                        │  experts that OWN standing    │
                        │  responsibility. Installed.   │
                        │  Persistent, long-lived.      │
                        └───────────────┬───────────────┘
                                        │ drive work through
                        ┌───────────────▼───────────────┐
                        │            AGENTS             │
                        │  Role: general-purpose,       │
                        │  retaskable workers.          │
                        │  First-class, inspectable.    │
                        └───────────────┬───────────────┘
                                        │ spawn per task, then reap
                        ┌───────────────▼───────────────┐
                        │         SUB-AGENTS            │
                        │  Ephemeral. Spawned for one   │
                        │  task. Reaped when it ends.   │
                        │  Inherit a SCOPED subset of   │
                        │  the parent's permissions.    │
                        └───────────────────────────────┘
```

### Brain — the orchestrator [CONFIRMED]
The Brain is **one** entity, always present, and it orchestrates. Its responsibilities:

- **Plan** — turn operator intent into an executable plan (operations → tasks).
- **Delegate** — assign tasks, spawn sub-agents, hand standing work to Specialists.
- **Supervise** — watch execution, detect drift, verify completion.
- **Recover** — on failure, reassign, fall back to another model, or spawn a replacement.
- **Escalate** — raise anything it cannot resolve, and anything in the intervention set.

It has **visible state** — what it is doing, what it is waiting on, what it decided. It is
not a decorative orb.

> **Today:** no Brain entity or page exists. The nav label "Model Brain" means
> Models + Routing, which is unrelated. `BrainRuntime` is a derived aggregate
> (`runtime/mappers.ts:109`), and `brain.state.changed` is declared and consumed but
> **never emitted** (`events.ts:92`). Making the Brain real is a foundational task.

### Specialists — standing expertise [CONFIRMED]
**Role distinction:** a Specialist is a deep, narrow-domain expert that owns standing
responsibility and keeps running. Where an Agent is a general-purpose worker you retask, a
Specialist is installed for a domain and expected to keep that domain healthy.

- Installed from versioned bundles. Persistent across restarts.
- Owns outcomes in its domain, not just individual tasks.
- Delegates the actual execution to Agents.

> **Today:** `type: "SPECIALIST"`, `SpecialistInstall`, 4 bundles and `POST /api/specialists`
> all exist — but there is **no page**, and the install API is **permanently 403** because
> its guard tests `dbUrl.includes("dev.db")` (`specialist-bundles.ts:167`) against a
> Postgres database. The concept is fully modelled and completely unusable.

### Agents — retaskable workers [CONFIRMED]
First-class, inspectable, general-purpose. Real today: `/agents` and `/agents/[id]`.

### Sub-agents — ephemeral [CONFIRMED]
Spawned per task and reaped when it ends. **Policy-bounded**: spawning is limited by a
configured ceiling per mission; exceeding it requires approval; every spawn is recorded
and reported live. [CONFIRMED]

> **Today:** `parentId`/`children` and `spawnAgent()` exist
> (`runtime-state.ts:411`) but nothing ever calls it during execution. The `delegating`
> state is never set, and `delegation.*` / `agent.spawned` are never emitted, though the
> client store consumes them.

---

## 2. The work hierarchy

```
   MISSION              persistent, operator-owned intent
   "Keep the docs current"
        │
        ├── OPERATION     one run of the mission   (a bounded attempt)
        │     ├── TASK    an atom of work, executed by one agent
        │     ├── TASK
        │     └── TASK
        │
        └── OPERATION     next run (on cadence, or on trigger)
              └── TASK
```

### Mission — the persistent unit [CONFIRMED]
What the operator owns and directs. A mission is **standing intent** ("keep X true"),
not a one-off job. It carries the cadence, the spending ceiling, the tool permissions and
the approvals that govern all its work.

- Created and edited by the operator.
- May also be authored by the Brain (from a trigger or an escalation) and is then
  **flagged as system-authored** for the operator to review. [CONFIRMED]
- Owns its own health, which rolls up from its operations.

### Operation — a run [CONFIRMED]
One bounded attempt at advancing a mission. Originally called "Operation" in the code
(only as `BrainRuntime.operationCount`) — here it becomes a real object.

- Created by the Brain when a mission runs (on cadence or on a trigger).
- Has a plan, a set of tasks, a cost, and an outcome.
- A mission may have many operations over its life; a task belongs to exactly one
  operation.

### Task — the atom [CONFIRMED]
The smallest unit of work, executed by exactly one agent. Real today: the scheduler picks
up any `QUEUED` task globally and runs it (`task-engine.ts:50`).

### Health rollup [CONFIRMED]
Health is computed, not stored per level independently:

```
Task health  ──▶  Operation health  ──▶  Mission health
```

A failing task degrades its operation; a failing operation degrades its mission. The
operator's attention surface reads from the top: **missions first.**

### Automations fold in [CONFIRMED]
There is no separate "Automations" product. **An automation is a trigger rule on a
mission** — a cadence, a data condition, or an event that starts a new operation.

> **Today:** `TriggerEngine` and `ActionEngine` are singleton classes with **zero
> callers** (`automation-triggers.ts:213`, `automation-actions.ts:274`). They become the
> real scheduling layer beneath Operations.

---

## 3. Where delegation, spawning and approval sit

| Concept | Owner | Constraint |
|---|---|---|
| Planning an operation | Brain | — |
| Delegating a task | Brain | model policy on the task, not the agent's stale memory scope |
| Spawning a sub-agent | Agent, via Brain | ceiling per mission; approval past the ceiling; inherits scoped permissions |
| Reviewing a system-authored mission | Operator | flagged, reviewable, not silently added |
| Recovering a failure | Brain | bounded retry → reassign / fallback / replacement → escalate |
| Approving a gated action | Operator | **work pauses until decided** |

---

## 4. Naming rules (to end the current vocabulary drift)

- **Brain** never means "models" or "routing". Those are *Models* and *Routing*.
- **Specialist** never means "a kind of agent with a label" — it means standing domain
  responsibility.
- **Operation** never means "a count". It is a run.
- **Colony** (the current top-level container) is not part of the confirmed model and is
  [RECOMMENDED] demoted out of primary navigation — with one workspace, "Colony" adds a
  level the operator never asked for.
