# Strike OS — Edge Cases

Only cases where the correct behaviour **materially changes the product** are listed.
Each states the required behaviour and its status. Defaults that are conventional are
marked [ASSUMED] so the operator can veto them cheaply.

---

## Trust & honesty

**E1 — No model provider configured.**
The app is in **simulation mode**, flagged **app-wide**. The operator sees one clear banner
and every result carries a `SIMULATED` marker. Nothing pretends to be real work.
[CONFIRMED]

**E2 — A provider fails mid-run.** ★
The task recovers (W4) or **fails honestly**. It must **never** silently return a
`simulated:true` result presented as real — the current `task-runner-real.ts:68-72`
behaviour is the defect this rule exists to kill. [CONFIRMED]

**E3 — A `RUNNING` task is orphaned by a crash/restart.**
On boot it is **re-queued** with a reattempt cap so it cannot loop forever. Its agent
resets from `executing`. [RECOMMENDED — gap today]

**E4 — The database is unreachable.**
Show an explicit error state. **Do not** substitute sample data
(`NEXT_PUBLIC_DASHBOARD_SAMPLE` must not fire in production). [CONFIRMED]

**E5 — The event stream drops.**
The live view shows "reconnecting" and stops animating — it never freezes on a stale
picture implying liveness. Re-syncs from cursor. [CONFIRMED]

---

## Gates & approvals

**E6 — A gate fires while other work continues.**
Only the **affected** work pauses; the run/paused scope is explicit on the approval
("this operation" vs "this mission"). Unrelated missions keep running. [RECOMMENDED]

**E7 — An approval is resolved twice / raced.**
Resolution is **idempotent**. The first decision wins; a second resolve returns the
existing outcome and does not double-resume. [RECOMMENDED]

**E8 — Two gates fire for the same operation.**
Both are shown; the work stays paused until **all** blocking gates are resolved.

**E9 — An approval is never answered.**
It **stays `PENDING`**, the work stays paused, and it keeps appearing in the queue. It does
not expire into an implicit approval. [RECOMMENDED — money and trust]

**E10 — The operator denies a gate mid-run.**
The work **rolls back or ends cleanly** — never a silent failure. A partial operation is
recorded as such. [CONFIRMED]

---

## The fleet

**E11 — A sub-agent is orphaned (parent dies or task ends first).**
It is **reaped** with its task; its row is retained, marked ephemeral. No orphan keeps
running or spending. [CONFIRMED — ephemeral model]

**E12 — A spawn storm (an agent tries to spawn recursively).**
The **per-mission ceiling** is enforced hard: past it the spawn is a gate and work pauses.
No path spawns without accounting. [CONFIRMED]

**E13 — A Specialist is uninstalled while it owns standing work.**
Its missions are **paused** and surfaced for the operator to reassign — they are not
silently killed or silently orphaned. [RECOMMENDED]

**E14 — Concurrent edits: the operator edits a mission while the Brain is planning it.**
The plan being produced is **invalidated and re-planned** against the new definition, or
the launch is blocked with "the mission changed" — the operator's edit always wins.

---

## Cost & drift

**E15 — The cost ceiling is crossed mid-operation.**
A gate fires, the **operation pauses**, the actual cost to date is shown, and the operator
chooses to raise the ceiling, cancel, or reduce scope. [CONFIRMED — spend gate]

**E16 — A mission never completes (standing work that stalls).**
A **drift signal** fires (off-cadence / no progress / rising cost) and it enters the
attention queue — without waiting for a hard failure. [CONFIRMED — drift gate]

**E17 — Two operations of the same mission overlap.**
[OPEN QUESTION] Default: disallow overlap — a mission's next operation waits for the
previous to settle, unless the cadence explicitly permits concurrency.

---

## Data & scale

**E18 — A very large history (thousands of events/runs).**
Lists are paginated/limited by default; counts are computed server-side, never by loading
everything. The audit already found a dead 24-iteration loop (`toHourSeries`,
`page.tsx:73-78`) — replace with real aggregate queries, not client loops.

**E19 — Duplicate submission (double-click "launch mission").**
Launch is **idempotent**: a second click creates no second mission and no second run.
[RECOMMENDED]

**E20 — The Brain reads a stale model policy.**
The policy comes from the task's/mission's `modelPolicy`, **not** the agent's
`memoryScope` (`task-runner-real.ts:104` is the current bug). Fixing this is part of the
core loop. [CONFIRMED — it breaks routing honesty]

---

## Timing

**E21 — Cadence across DST / timezone changes.**
Cadences are stored in an explicit timezone (default the operator's); DST shifts must not
skip or double a run. [RECOMMENDED]

**E22 — Clock skew between event producers.**
The runtime **cursor** is the ordering authority, not wall-clock timestamps (the store
already does this — keep it).

---

## Explicitly out of scope (so they are not forgotten, just deferred)

- Multi-user / concurrent operators — single operator by design. [ASSUMED]
- Offline-first operation — the product is server-backed; offline shows an error, it does
  not queue local edits. [ASSUMED]
- Partial network partitions between engine and store — treated as a drop (E5).
