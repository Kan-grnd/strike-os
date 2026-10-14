# Strike OS — Information Architecture

## The problem with the current IA

Navigation today (`src/lib/navigation.ts`) defines **8 top-level domains and 23 items**
that describe *how the machine is built*, not *what it is doing*:

> Model Brain · Agents · Specialists(?) · Topology · Observability · Memory · Tools ·
> Marketplace · Chat · Settings …

The operator's jobs are **direct → verify → intervene**. The current structure serves
none of them: health is scattered, the flagship "Missions" surface redirects to `/work`
across four aliases (`next.config.js`), and the Brain — the orchestrator the whole model
depends on — has no home at all.

## Design principles

1. **Attention-first.** The default landing surface leads with *what needs the operator*,
   not with a dashboard of vanity metrics. [CONFIRMED — primary surface]
2. **Four questions, five domains.** What needs me? · What is it doing? · Who is doing it?
   · What happened? · How is the machine configured?
3. **Nothing appears twice.** The existing invariant (every route appears exactly once in
   nav, enforced by `scripts/check-navigation.ts`) is kept.
4. **The work hierarchy is visible.** Mission → Operation → Task reads top-down in the
   interface, matching the model.
5. **Infrastructure is not the product.** Models, routing, memory, tools are configuration
   — reachable, never primary.

## The proposed IA [RECOMMENDED]

```
CONTROL CENTER           ← default landing. Attention-first.
                           • Needs you (approvals, escalations, gated work)
                           • Mission health at a glance
                           • Live summary (what is executing right now)

MISSIONS                 ← the directing surface. The operator's home for intent.
   ├─ All missions            standing intent, health, cadence, cost
   ├─ Mission detail          operations, goals, cadence/triggers, limits, history
   └─ New mission             state intent → Brain plans → approve → launch

WORKFORCE                ← who is doing the work.
   ├─ Brain                   orchestrator state: planning / delegating / recovering
   ├─ Specialists             installed domain experts (fixes the 403, gives them a page)
   ├─ Agents                  retaskable workers (+ detail: state, task, permissions)
   ├─ Live                    live work flow — executing missions/ops/tasks/sub-agents
   └─ Marketplace             install Specialists/Agents from bundles

ACTIVITY                 ← what happened. History, not live.
   ├─ Runs                    operation history (cost, outcome, duration)
   ├─ Events                  the event log / stream
   └─ Traces                  per-operation execution traces

SETTINGS                 ← configure the machine.
   ├─ Models & Providers      providers, keys, model catalogue
   ├─ Routing                 model selection policy (rebuilt — today it is mock)
   ├─ Tools & Permissions     the trust surface: what the workforce may touch
   ├─ Memory                  the knowledge the workforce accumulates
   ├─ Policies & Limits       spending ceilings, spawn ceilings, retry bounds
   └─ Appearance              accent / density / **radius profile**
```

### Why five domains

| Domain | The operator question it answers | Confirmed basis |
|---|---|---|
| Control Center | *What needs me?* | attention-first primary surface [CONFIRMED] |
| Missions | *What should it be doing?* | Mission = operator-owned persistent unit [CONFIRMED] |
| Workforce | *Who is doing it?* | Brain/Specialist/Agent/Sub-agent hierarchy [CONFIRMED] |
| Activity | *What happened?* | state+history persists [CONFIRMED] |
| Settings | *How is it configured?* | control = mission + policy [CONFIRMED] |

## Where everything moves

| Today | New home | Action |
|---|---|---|
| `/` (Command Center, hardcoded KPIs) | Control Center | **Rebuild** attention-first; remove hardcoded `planning: 0`/`blocked: 0`, `lastEventAgo:"recent"`, sample-data escape hatch |
| `/mission` redirects, `/work` merged surface | Missions | **Retire the redirects** (`next.config.js`) and the merged `/work`; one real Missions domain |
| `/workflows/*` (automation detail on a workflow URL) | Missions (triggers) | Fold in as mission triggers; fix the `/cancel` mismatch |
| `/automations` → `/work?type=automations` | Missions (triggers) | Fold in |
| *(none)* — Brain has no page | Workforce → Brain | **Create** |
| Specialists (403, no page) | Workforce → Specialists | **Repair guard, add page** |
| `/agents`, `/agents/[id]` | Workforce → Agents | Keep; fix error handling + stale policy read |
| `/topology` | Workforce → Live | Keep, reframe as live work flow, feed real edges |
| Chat bolt-on | Control Center + Missions | Fold in as the *directing* input, not a separate silo |
| `/observability/*`, nav "Observatory" | Activity | Rename Consistency: one word, "Activity" |
| `/routing` (100% mock, POSTs to a 404) | Settings → Routing | **Rebuild** or clearly mark as preview |
| `/memory`, `/tools`, `/mcp`, `/connectors`, `/decisions` | Settings (+ Activity for decisions) | Keep, demote; wire the ~14 dead buttons |
| Colony container | — | [RECOMMENDED] Demote from primary nav (single workspace) |
| Marketplace | Workforce → Marketplace | Keep, reframe around installing Specialists |

## Route plan [RECOMMENDED]

```
/                         → Control Center (attention-first)
/missions                 → list
/missions/new             → intent → plan → approve → launch
/missions/[id]            → detail (operations, triggers, limits, history)

/workforce                → overview (Brain + roster + live summary)
/workforce/brain          → Brain state
/workforce/specialists    → installed specialists
/workforce/agents         → roster
/workforce/agents/[id]    → agent detail
/workforce/live           → live work flow  (was /topology)
/workforce/marketplace    → install bundles

/activity                 → runs list
/activity/runs/[id]       → run detail (tasks, cost, outcome, trace)
/activity/events          → event log
/activity/traces          → traces

/settings                 → general
/settings/models          → providers + catalogue
/settings/routing         → model policy
/settings/tools           → tools + permissions (trust surface)
/settings/memory          → memory
/settings/policies        → ceilings, retry bounds, spawn limits
/settings/appearance      → accent / density / radius profile
```

**Redirects to remove:** `/missions`→`/work`, `/workflows`→`/work`,
`/automations`→`/work`, `/automations/:path*`→`/workflows/:path*`. These are the
half-finished merge and are the root cause of the "automation detail page at a workflow
URL that POSTs to `/cancel`" bug.

**Never-again rule:** no nav label may name infrastructure (Brain-as-models, Observatory,
Colony) unless the operator's mental model uses it. Names in `navigation.ts` must match
the vocabulary in [system-hierarchy.md](./system-hierarchy.md) §4.

## Header, cross-links and the command bar

- **Global command bar** (persistent): state intent, ask the Brain a question, jump
  anywhere. This is the *directing* input [CONFIRMED — directing via the Brain]. Chat is
  the conversation view of the same surface.
- **Attention badge** on Control Center — a count of items needing the operator. This is
  the one number that earns persistent chrome.
- Every Mission links down (operations to tasks); every Task links up (its mission). The
  work hierarchy is always traversable in both directions.
