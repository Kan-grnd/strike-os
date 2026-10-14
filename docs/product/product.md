# Strike OS — Product Specification

> Status legend used across `docs/product/`:
> **CONFIRMED** the operator explicitly chose it in discovery.
> **RECOMMENDED** proposed, awaiting the operator's word.
> **ASSUMED** proceeded on to keep moving; not endorsed.
> **OPEN QUESTION** deliberately unresolved.

## Purpose

**Strike OS is an operating system for a persistent, autonomous AI workforce.** One solo
operator directs standing work; a workforce of AI workers carries it out continuously —
including when the operator is not watching — and the operator's second job is knowing
that the work is being done well.

The single reason the product would be missed: **it keeps working when you're not
looking, and it tells you when it isn't.** [CONFIRMED]

This is deliberately *not* a mission-per-job tool, a copilot, or an agent-building
platform. See Non-goals.

## The operator

**A solo operator or founder** — technical, comfortable with agents, models and tools,
time-poor and outcome-focused. They want control over *what* the workforce does and
*whether it's healthy*, but not busywork. They will not maintain an org chart, and they
will not click through ten screens to find out something is blocked. [CONFIRMED]

Design consequence: the product must be operable by one person at a glance. Anything
that demands constant attention has failed.

## What a session is for

The operator's core accomplishment is: **direct persistent work, and know it's healthy.**
[CONFIRMED]

That decomposes into three recurring activities:

1. **Direct** — state or revise what the workforce should be doing (standing objectives,
   cadences, limits).
2. **Verify health** — confirm the workforce is doing it well, and notice drift early.
3. **Intervene** — only when the system escalates something it cannot resolve, or when a
   defined intervention is triggered.

## The operating model

Five rules, all confirmed:

| Rule | Consequence |
|---|---|
| **The Brain orchestrates.** It plans, delegates, supervises and escalates. | The Brain is a first-class, observable part of the system — not a decorative orb. Delegation and supervision become real execution paths. |
| **Specialists own standing work; Agents are general-purpose.** | Two roles, one runtime. Specialists are installed and keep running; Agents can be retasked across domains. |
| **Sub-agents are ephemeral.** Spawned per task, reaped when it ends. | The workforce scales itself; the operator never provisions workers. |
| **A Mission is persistent; an Operation is a run; a Task is an atom.** | The directing surface is the Mission. Health rolls up Task → Operation → Mission. |
| **Automation is a trigger on a mission**, not a separate product. | The orphaned trigger/action engines become the scheduling layer under Operations. |

## The control contract

| Question | Answer | Status |
|---|---|---|
| What can the operator control? | Missions and policy — cadences, spending ceilings, tool permissions, approvals. Not workers, not task assignment. | CONFIRMED |
| What requires intervention? | A defined set: new tool permissions, cost-ceiling breach, model fallback outside policy, mission drift off cadence, spawning past a limit. The Brain may also escalate anything it cannot resolve. | CONFIRMED |
| What happens on failure? | Bounded retry → Brain attempts recovery (reassign, fallback model, spawn replacement) → escalate to the operator with full context. | CONFIRMED |
| What happens on approval? | The affected work **pauses** until the operator decides. Approvals are a real gate, not a notification. | CONFIRMED |
| What happens on spawning? | Policy-bounded, reported live, approval required past the ceiling. Sub-agents inherit a scoped subset of the parent's permissions. | CONFIRMED |

## Trust — the non-negotiable

**Every executed task is visibly marked REAL or SIMULATED, and a simulated result is
never presented as work done.** With no model provider configured, the workforce is
explicitly in *simulation mode*, flagged app-wide. Silent degradation is a product
defect, not a fallback. [CONFIRMED]

This exists because the audit found `RealTaskRunner` catching every provider failure and
returning a fabricated `simulated: true` result that nothing in the UI distinguishes
(`src/lib/task-runner-real.ts:68-72`). For an operating system the operator must trust,
that is the single most dangerous behaviour in the codebase.

## Scope boundaries

**In scope** — directing persistent work, the Brain as orchestrator, Specialists and
Agents, autonomous execution, the intervention contract, honest observability.

**Non-goals** [RECOMMENDED — derived from the confirmed purpose, not separately asked]

- **Not a copilot.** The product is not human-led with machine assistance. The operator
  directs; the workforce executes autonomously within policy.
- **Not an agent-building platform.** The registry, permissions and model fabric exist to
  serve the workforce, not to be the product. The audit found the product currently
  *reads* like an infrastructure console — that is the core mismatch to fix.
- **Not multi-tenant.** Single operator, single workspace. Multi-user permissions are out
  of scope until someone else uses it. [ASSUMED]
- **Not mobile-first.** A desktop operating surface. Responsive behaviour must not break,
  but mobile is not the primary experience. [ASSUMED]

## Honest assessment of where the product is

The audit found the low-level machinery is real and the high-level product is not:

- **Real:** a boot-time task scheduler (`instrumentation.ts` → `task-engine.ts:50`), an
  agent state machine with 15 states, a cursor-polled live runtime store with stale-event
  guards, a genuine topology renderer, a real chat path, and real observability data.
- **Not real:** the flagship loop. `POST /api/missions` stores a plan and creates **zero
  tasks** (`missions/route.ts:29-51`), so describing intent produces no running work. The
  "LLM planner" is a keyword pattern-match (`mission-engine.ts:121-125`). Delegation,
  approvals, automations, tool execution and the Brain state event are all declared and
  consumed but **never emitted**.

This is why **closing the intent→execution loop is the first milestone** [CONFIRMED] —
until it closes, nothing else in the product is real.

See [decisions.md](./decisions.md) for the full register, and
[implementation-plan.md](./implementation-plan.md) for what gets built in what order.
