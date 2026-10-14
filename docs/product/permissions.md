# Strike OS — Permissions & The Control Model

This is the **trust surface** of the product: who may do what, what must be asked, and
what happens when permission is exceeded. It is the contract behind "control = mission +
policy, not workers." [CONFIRMED]

---

## 1. Actors

| Actor | Who | Authority |
|---|---|---|
| **Operator** | The solo operator/founder. The only human. | Full authority over missions, policy, approvals, the workforce. |
| **Brain** | The orchestrator. | Plans, delegates, supervises, recovers, escalates — **within policy**. Cannot approve its own requests. |
| **Specialist** | Installed domain expert. | Standing responsibility in its domain; delegates execution. Permission = its granted tool set. |
| **Agent** | Retaskable worker. | Executes tasks within the permissions attached to the work it is given. |
| **Sub-agent** | Ephemeral. | **Inherits a scoped subset of its parent's permissions** — never the full set, never more than the parent. [CONFIRMED] |

> **Today:** none of this is enforced. The only guard on the specialist API is a
> dev-database string check (`specialist-bundles.ts:167`). There is no runtime permission
> model at all — this document defines it.

---

## 2. What the Operator may do

- Create, edit, launch, pause, resume, complete, archive and delete **missions**. [CONFIRMED]
- Set **policy**: spending ceilings, spawn ceilings, retry bounds, tool permissions,
  routing policy, cadences. [CONFIRMED]
- **Approve / deny / revoke** gates. [CONFIRMED]
- Force-retry, cancel or reassign **any** task or operation, at any time. (This is a
  break-glass control that does not contradict "not workers" — it is exception handling,
  not routine management.)
- Review and accept/discard **system-authored missions**.
- Read everything.

**What the Operator does *not* do as a matter of course** [CONFIRMED]:
- Assign tasks to agents.
- Provision or manage individual workers.
- Approve each operation plan (only mission launch, and gates).

---

## 3. What the Brain may do — within policy, without asking

- Plan and create operations and tasks for a `RUNNING` mission.
- Delegate tasks and spawn sub-agents **up to the mission's spawn ceiling**.
- Retry failed tasks **up to the retry bound**.
- Recover: reassign, fall back to another model **within policy**, spawn a replacement.
- Mark operations and missions complete.
- **Draft** a system-authored mission (but not launch it). [CONFIRMED]

## 4. What the Brain must ask for — the intervention set [CONFIRMED]

| Trigger | Why it gates |
|---|---|
| A **new tool permission** is required | The trust boundary — the workforce touching something new |
| A **spending ceiling** would be breached | Money |
| A **model fallback outside policy** | Quality/cost/trust drift |
| A **mission drifts off cadence** | The work is no longer what was asked |
| **Spawning past the ceiling** | The workforce scaling itself unexpectedly |
| Brain **escalation** — anything it cannot resolve | The catch-all |

**When a gate fires: the affected work PAUSES until the operator decides.** [CONFIRMED]
Not a notification. A hard stop.

---

## 5. Permission scopes (tool access)

Tool access is granted at the **mission** level, and narrows as it flows down:

```
mission permissions
   ├─ operation   (intersection with mission; may narrow, never widen)
   │    ├─ task
   │    │    └─ sub-agent   (SCOPED SUBSET of the parent agent's permissions)
```

Rules:
- **Inheritance narrows, never widens.** A sub-agent can never hold a permission its
  parent agent lacks, nor one its mission lacks. [CONFIRMED]
- **Least privilege by default.** A new mission starts with no permissions until granted.
- **A new permission grant is itself a gate** — so installing a Specialist or extending a
  mission's reach surfaces an approval rather than silently expanding reach. [CONFIRMED]
- Permissions are **auditable**: every grant, denial and use is logged.

> **Today:** tools echo their input and report a hardcoded `successRate: 99`
> (`tool-fabric.ts:61-84`). There is no real permission check. The audit's ~14 dead buttons
> across `/tools`, `/mcp`, `/connectors`, `/decisions` are the missing wiring.

---

## 6. Spending

- Each mission has a **ceiling** (per operation / per period — [OPEN QUESTION] which).
- The Brain may spend freely below the ceiling.
- Approaching the ceiling → warn. Crossing it → **gate** (pause + ask). [CONFIRMED]
- Cost rolls up task → operation → mission and is visible at every level.

---

## 7. Spawning

- **Ceiling per mission**, configured by the operator. [CONFIRMED]
- Within the ceiling: automatic, **reported live** in the live work flow, recorded in audit.
- Beyond the ceiling: **gate** — work pauses and the operator is asked.
- Sub-agents are ephemeral and reaped at task end.

---

## 8. Notifications & audit

- **One persistent signal:** the attention badge. [CONFIRMED]
- Every gate, decision, recovery and permission change is written to an **audit trail**,
  readable in Activity.
- The operator is notified **only** for: gates, escalations, health transitions to
  `FAILING`/`BLOCKED`, and system-authored missions. [RECOMMENDED — derived from the
  intervention set]

---

## 9. Explicit non-goals

- **No multi-user roles.** There is one operator. No RBAC, no teams, no sharing.
  [ASSUMED — single-tenant]
- **No per-agent authority tiers.** Rejected in discovery as config overhead for a solo
  operator. [CONFIRMED — the "per-agent authority tiers" option was not chosen]
- **The Brain never approves itself.** A request it raises can only be resolved by the
  operator.
