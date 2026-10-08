/* Tidy-tree layout gate for Live Topology.
 * Run: npx tsx scripts/check-topology-tidy.ts
 * Wired into `npm run build`, so a layout regression fails the build.
 *
 * The layout under test is hierarchy-only with fixed distances: neighbouring
 * boxes exactly TIDY_SIBLING_GAP apart, one band per depth separated by
 * TIDY_LEVEL_GAP, children wrapping past TIDY_MAX_ROW_WIDTH. Fixtures cover
 * the required shapes; each asserts the five properties, and the file exits
 * non-zero on any violation.
 */
import {
  boxOf,
  buildTidyTopologyLayout,
  FIT_MAX_ZOOM,
  FIT_MIN_ZOOM,
  fitZoomFor,
  TIDY_LEVEL_GAP,
  TIDY_MAX_ROW_WIDTH,
  TIDY_SIBLING_GAP,
  type Placed as PlacedCard,
  type TopologyLayout,
} from "../src/lib/runtime/layout";
import type {
  AgentRuntime,
  ColonyRuntime,
  TaskRuntime,
  WorkforceRuntime,
} from "../src/lib/runtime/types";

const results: string[] = [];
const check = (label: string, ok: boolean, detail?: string) => {
  results.push(`${ok ? "PASS" : "FAIL"} ${label}${detail ? ` — ${detail}` : ""}`);
};

/* ── Fixture builders ──────────────────────────────────────────────────── */
// Rendered card sizes mirrored from CARD_SIZE (no measured overrides here, so
// the engine must use exactly these).
const SIZE: Record<string, { w: number; h: number }> = {
  brain: { w: 200, h: 200 },
  specialist: { w: 260, h: 80 },
  agent: { w: 220, h: 78 },
  subagent: { w: 200, h: 75 },
  operation: { w: 200, h: 75 },
};

let tick = 0;
const ts = () => new Date(Date.UTC(2026, 0, 1, 0, 0, tick++));

const makeColony = (id: string): ColonyRuntime => ({
  id,
  name: id,
  status: "ACTIVE",
  agentIds: [],
  timestamps: { createdAt: ts(), updatedAt: ts() },
});

const makeAgent = (id: string, colonyId: string, parentId?: string): AgentRuntime => ({
  id,
  name: id,
  type: "WORKER",
  colonyId,
  parentId,
  runtimeState: "idle",
  models: [],
  capabilities: [],
  tools: [],
  permissions: [],
  successRate: 90,
  avgDuration: 1,
  totalCost: 1,
  createdAt: ts(),
  updatedAt: ts(),
});

const makeTask = (id: string, ownerAgentId: string): TaskRuntime => ({
  id,
  missionId: "m1",
  description: id,
  status: "RUNNING",
  ownerAgentId,
  dependencies: [],
  retryCount: 0,
  maxRetries: 3,
  cost: 1,
  timestamps: { createdAt: ts(), updatedAt: ts() },
});

const makeRuntime = (
  colonies: ColonyRuntime[],
  agents: AgentRuntime[],
  tasks: TaskRuntime[]
): WorkforceRuntime => ({
  brain: {
    state: "working",
    agentCount: agents.length,
    activeCount: 0,
    waitingCount: 0,
    errorCount: 0,
    colonyCount: colonies.length,
    missionCount: 0,
    operationCount: tasks.length,
  },
  colonies,
  agents,
  tasks,
  relationships: [],
  recentEvents: [],
  system: { providerCount: 0, modelCount: 0, mcpCount: 0, memoryCount: 0 },
  generatedAt: new Date(),
});

/** Every disclosure toggle set: the whole workforce visible. */
const expandAll = (rt: WorkforceRuntime): Set<string> => {
  const s = new Set<string>();
  for (const c of rt.colonies) if (c.status !== "ARCHIVED") s.add(c.id);
  for (const a of rt.agents) {
    s.add(`${a.id}:sub`);
    s.add(`${a.id}:ops`);
  }
  return s;
};

interface Box {
  id: string;
  kind: string;
  x0: number;
  x1: number;
  y0: number;
  y1: number;
}

const boxesOf = (layout: TopologyLayout): Box[] => {
  const out: Box[] = [];
  const put = (id: string, kind: string, x: number, y: number) => {
    const s = SIZE[kind];
    out.push({ id, kind, x0: x - s.w / 2, x1: x + s.w / 2, y0: y, y1: y + s.h });
  };
  put("brain", "brain", layout.brain.x, layout.brain.y);
  for (const [id, p] of Array.from(layout.territories)) put(id, "specialist", p.x, p.y);
  for (const [id, p] of Array.from(layout.agents)) put(id, "agent", p.x, p.y);
  for (const [id, p] of Array.from(layout.subAgents)) put(id, "subagent", p.x, p.y);
  for (const [id, p] of Array.from(layout.operations)) put(id, "operation", p.x, p.y);
  return out;
};

/** Visible parent of each visible node, derived independently from the
 *  runtime + expansion set (mirrors the selectors' visibility rules). */
const parentOf = (rt: WorkforceRuntime, expanded: ReadonlySet<string>): Map<string, string> => {
  const parent = new Map<string, string>();
  const live = new Map<string, AgentRuntime>();
  for (const a of rt.agents) {
    if (["cancelled", "stopped"].includes(a.runtimeState)) continue;
    live.set(a.id, a);
  }
  for (const c of rt.colonies) {
    if (c.status === "ARCHIVED") continue;
    parent.set(c.id, "brain");
    if (!expanded.has(c.id)) continue;
    for (const a of Array.from(live.values())) {
      if (a.parentId || a.colonyId !== c.id) continue;
      parent.set(a.id, c.id);
      const walk = (id: string) => {
        if (expanded.has(`${id}:sub`)) {
          for (const s of Array.from(live.values())) {
            if (s.parentId === id && parent.get(s.id) === undefined) {
              parent.set(s.id, id);
              walk(s.id);
            }
          }
        }
        if (expanded.has(`${id}:ops`)) {
          for (const t of rt.tasks) {
            if (t.status === "COMPLETED" || t.status === "CANCELLED") continue;
            if (t.ownerAgentId === id && t.ownerAgentId && !parent.has(t.id)) parent.set(t.id, id);
          }
        }
      };
      walk(a.id);
    }
  }
  return parent;
};

const layoutKey = (layout: TopologyLayout): string => {
  const part = (m: Map<string, { x: number; y: number }>) =>
    Array.from(m)
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .map(([id, p]) => `${id}@${p.x},${p.y}`)
      .join("|");
  return [
    `brain@${layout.brain.x},${layout.brain.y}`,
    part(layout.territories),
    part(layout.agents),
    part(layout.subAgents),
    part(layout.operations),
  ].join(";");
};

interface Fixture {
  name: string;
  rt: WorkforceRuntime;
  expanded: Set<string>;
}

const oneColony = (): Fixture => {
  const rt = makeRuntime([makeColony("col-a")], [], []);
  return { name: "1 colony", rt, expanded: expandAll(rt) };
};

const twoColonies = (): Fixture => {
  const rt = makeRuntime([makeColony("col-a"), makeColony("col-b")], [], []);
  return { name: "2 colonies", rt, expanded: expandAll(rt) };
};

const twelveColonies = (): Fixture => {
  const colonies = Array.from({ length: 12 }, (_, i) => makeColony(`c${i}`));
  const rt = makeRuntime(colonies, [], []);
  return { name: "12 colonies", rt, expanded: expandAll(rt) };
};

const fiveColonies = (): Fixture => {
  const colonies = Array.from({ length: 5 }, (_, i) => makeColony(`c${i}`));
  const rt = makeRuntime(colonies, [], []);
  return { name: "5 colonies", rt, expanded: expandAll(rt) };
};

const fortyAgents = (): Fixture => {
  const colonies = [makeColony("col-a")];
  const agents = Array.from({ length: 40 }, (_, i) => makeAgent(`ag-${i}`, "col-a"));
  const rt = makeRuntime(colonies, agents, []);
  return { name: "40 agents", rt, expanded: expandAll(rt) };
};

const emptyColony = (): Fixture => {
  const rt = makeRuntime([makeColony("col-empty")], [], []);
  return { name: "empty colony", rt, expanded: new Set(["col-empty"]) };
};

const withSubs = (): Fixture => {
  const colonies = [makeColony("col-a"), makeColony("col-b")];
  const agents = [
    makeAgent("ag-1", "col-a"),
    makeAgent("ag-2", "col-a"),
    makeAgent("ag-1-s1", "col-a", "ag-1"),
    makeAgent("ag-1-s2", "col-a", "ag-1"),
    makeAgent("ag-2-s1", "col-a", "ag-2"),
    makeAgent("ag-3", "col-b"),
    makeAgent("ag-3-s1", "col-b", "ag-3"),
  ];
  const tasks = [makeTask("t1", "ag-1"), makeTask("t2", "ag-1-s1"), makeTask("t3", "ag-3")];
  const rt = makeRuntime(colonies, agents, tasks);
  return { name: "subs+ops", rt, expanded: expandAll(rt) };
};

const deepChain = (): Fixture => {
  const colonies = [makeColony("col-a")];
  const agents = [
    makeAgent("ag-1", "col-a"),
    makeAgent("ag-2", "col-a", "ag-1"),
    makeAgent("ag-3", "col-a", "ag-2"),
    makeAgent("ag-4", "col-a", "ag-3"),
  ];
  const tasks = [makeTask("t1", "ag-4")];
  const rt = makeRuntime(colonies, agents, tasks);
  return { name: "deep chain", rt, expanded: expandAll(rt) };
};

const opsRow = (): Fixture => {
  const colonies = [makeColony("col-a")];
  const agents = [makeAgent("ag-1", "col-a")];
  const tasks = Array.from({ length: 5 }, (_, i) => makeTask(`t${i}`, "ag-1"));
  const rt = makeRuntime(colonies, agents, tasks);
  return { name: "ops row", rt, expanded: expandAll(rt) };
};

const FIXTURES: Fixture[] = [
  oneColony(),
  twoColonies(),
  fiveColonies(),
  twelveColonies(),
  fortyAgents(),
  emptyColony(),
  withSubs(),
  deepChain(),
  opsRow(),
];

/* ── 2. no two node boxes overlap ──────────────────────────────────────── */
for (const f of FIXTURES) {
  const boxes = boxesOf(buildTidyTopologyLayout(f.rt, f.expanded));
  const hits: string[] = [];
  for (let i = 0; i < boxes.length; i += 1) {
    for (let j = i + 1; j < boxes.length; j += 1) {
      const a = boxes[i];
      const b = boxes[j];
      if (a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1) {
        hits.push(`${a.id}x${b.id}`);
      }
    }
  }
  check(`overlap: ${f.name} has no overlapping boxes`, hits.length === 0, hits.join(" ") || `${boxes.length} boxes`);
}

/* ── 1. fixed sibling gaps ─────────────────────────────────────────────── */
// Same row = same top edge. Every neighbouring pair clears at least one
// sibling gap, and a larger gap must be *necessary*: rigidly closing it to
// exactly one gap would overlap something. That is the enforceable form of
// "exactly siblingGap, or more only because subtree widths force it" — a
// correct tidy tree keeps every gap minimal, so no justified gap can shrink.
for (const f of FIXTURES) {
  const layout = buildTidyTopologyLayout(f.rt, f.expanded);
  const boxes = boxesOf(layout);
  const parents = parentOf(f.rt, f.expanded);
  const subtreeOf = (id: string): Set<string> => {
    const out = new Set<string>([id]);
    for (const [child, p] of Array.from(parents)) {
      if (p === id) for (const d of Array.from(subtreeOf(child))) out.add(d);
    }
    return out;
  };
  const byId = new Map(boxes.map((b) => [b.id, b]));
  const byY = new Map<number, Box[]>();
  for (const b of boxes) {
    const row = byY.get(b.y0) ?? [];
    row.push(b);
    byY.set(b.y0, row);
  }
  const bad: string[] = [];
  for (const row of Array.from(byY.values())) {
    const sorted = [...row].sort((a, b) => a.x0 - b.x0);
    for (let i = 1; i < sorted.length; i += 1) {
      const left = sorted[i - 1];
      const right = sorted[i];
      const gap = right.x0 - left.x1;
      if (Math.abs(gap - TIDY_SIBLING_GAP) <= 1e-6) continue;
      if (gap < TIDY_SIBLING_GAP - 1e-6) {
        bad.push(`${left.id}~${right.id}=${gap}`);
        continue;
      }
      // Larger gap: closing it must collide, or the slack is unjustified.
      const moved = subtreeOf(right.id);
      const dx = gap - TIDY_SIBLING_GAP;
      let collides = false;
      for (const m of Array.from(moved)) {
        const mb = byId.get(m)!;
        const shifted = { x0: mb.x0 - dx, x1: mb.x1 - dx, y0: mb.y0, y1: mb.y1 };
        for (const b of boxes) {
          if (moved.has(b.id)) continue;
          if (shifted.x0 < b.x1 && b.x0 < shifted.x1 && shifted.y0 < b.y1 && b.y0 < shifted.y1) {
            collides = true;
            break;
          }
        }
        if (collides) break;
      }
      if (!collides) bad.push(`${left.id}>${right.id}=${gap} unjustified`);
    }
  }
  check(`gaps: ${f.name} keeps fixed sibling gaps`, bad.length === 0, bad.join(" ") || "ok");
}

/* ── 3. parents centred over children ──────────────────────────────────── */
for (const f of FIXTURES) {
  const layout = buildTidyTopologyLayout(f.rt, f.expanded);
  const boxes = boxesOf(layout);
  const byId = new Map(boxes.map((b) => [b.id, b]));
  const parents = parentOf(f.rt, f.expanded);
  const kids = new Map<string, Box[]>();
  for (const [id, p] of Array.from(parents)) {
    const list = kids.get(p) ?? [];
    const box = byId.get(id);
    if (box) list.push(box);
    kids.set(p, list);
  }
  const bad: string[] = [];
  for (const [pid, list] of Array.from(kids)) {
    const parent = byId.get(pid);
    if (!parent || list.length === 0) continue;
    const cx = (Math.min(...list.map((b) => (b.x0 + b.x1) / 2)) + Math.max(...list.map((b) => (b.x0 + b.x1) / 2))) / 2;
    if (Math.abs((parent.x0 + parent.x1) / 2 - cx) > 1) bad.push(`${pid}@${cx.toFixed(1)}`);
  }
  check(`center: ${f.name} parents centred over children`, bad.length === 0, bad.join(" ") || "ok");
}

/* ── 4. adding a node never moves an existing band ─────────────────────── */
// Band tops are pure functions of depth, so growth below the wrap threshold
// moves nothing vertically. (Crossing the wrap threshold is the one designed
// exception — tested below — because a new chunk row has to go somewhere.)
{
  const base = twoColonies();
  const grown: WorkforceRuntime = {
    ...base.rt,
    colonies: [...base.rt.colonies, makeColony("col-c")],
  };
  const grownExpanded = expandAll(grown);
  const before = boxesOf(buildTidyTopologyLayout(base.rt, base.expanded));
  const after = boxesOf(buildTidyTopologyLayout(grown, grownExpanded));
  const afterById = new Map(after.map((b) => [b.id, b]));
  const moved = before
    .filter((b) => {
      const n = afterById.get(b.id);
      return !n || n.y0 !== b.y0;
    })
    .map((b) => b.id);
  check("levels: adding a colony moves no existing band", moved.length === 0, moved.join(" ") || "ok");

  const chain = deepChain();
  const withOp: WorkforceRuntime = {
    ...chain.rt,
    tasks: [...chain.rt.tasks, makeTask("t-new", "ag-2")],
  };
  const withOpExpanded = expandAll(withOp);
  const beforeOps = boxesOf(buildTidyTopologyLayout(chain.rt, chain.expanded));
  const afterOps = boxesOf(buildTidyTopologyLayout(withOp, withOpExpanded));
  const afterOpsById = new Map(afterOps.map((b) => [b.id, b]));
  const movedOps = beforeOps
    .filter((b) => {
      const n = afterOpsById.get(b.id);
      return !n || n.y0 !== b.y0;
    })
    .map((b) => b.id);
  check("levels: adding an operation moves no existing band", movedOps.length === 0, movedOps.join(" ") || "ok");
}

/* ── Wrap is the one designed exception to band stability ─────────────────
 * Only the children of a single parent ever wrap; sibling colonies stay in
 * one row unless there are more than 4 of them. Growing a row past
 * TIDY_MAX_ROW_WIDTH opens a new chunk row below: the retained prefix chunks
 * keep their bands, only the overflow chunk moves down — and the result
 * still has no overlaps and stays deterministic. */
{
  const base = withSubs();
  const grown: WorkforceRuntime = {
    ...base.rt,
    tasks: [
      ...base.rt.tasks,
      makeTask("t-new", "ag-2"),
      makeTask("t-n2", "ag-2"),
      makeTask("t-n3", "ag-2"),
    ],
  };
  const grownExpanded = expandAll(grown);
  const before = boxesOf(buildTidyTopologyLayout(base.rt, base.expanded));
  const after = boxesOf(buildTidyTopologyLayout(grown, grownExpanded));
  const afterById = new Map(after.map((b) => [b.id, b]));
  /* 912px of new tasks stays far under the 2400px cap: nothing at all moves,
   * which is the common growth case now that colonies never split. */
  const kept = before
    .filter((b) => b.id === "brain" || b.id === "col-a" || b.id.startsWith("ag-1") || b.id.startsWith("ag-2") || b.id === "t1")
    .filter((b) => afterById.get(b.id)?.y0 !== b.y0)
    .map((b) => b.id);
  check(
    "wrap: growth under the row cap moves nothing",
    kept.length === 0,
    kept.join(" ") || "ok"
  );
}
{
  /* Five colonies share one row (5 x 232px + 4 x 32px = 1288px). */
  const colonies = Array.from({ length: 5 }, (_, i) => makeColony(`c${i}`));
  const rt = makeRuntime(colonies, [], []);
  const boxes = boxesOf(buildTidyTopologyLayout(rt, expandAll(rt)));
  const colBoxes = boxes.filter((b) => b.kind === "specialist");
  const ys = new Set(colBoxes.map((b) => b.y0));
  check(
    "wrap: five colonies share one row in creation order",
    ys.size === 1 && colBoxes.map((b) => b.id).join(",") === "c0,c1,c2,c3,c4",
    Array.from(ys).join(",") || "ok"
  );
}
{
  /* One colony with ten agents (10 x 244px + 9 x 32px = 2728px) wraps its
   * agent row; creation order survives across the chunk rows. */
  const colonies = [makeColony("col-a")];
  const agents = Array.from({ length: 10 }, (_, i) => makeAgent(`solo-${i}`, "col-a"));
  const rt = makeRuntime(colonies, agents, []);
  const boxes = boxesOf(buildTidyTopologyLayout(rt, expandAll(rt)));
  const agentRows = new Map<number, string[]>();
  for (const b of boxes.filter((b) => b.kind === "agent")) {
    agentRows.set(b.y0, [...(agentRows.get(b.y0) ?? []), b.id]);
  }
  const rows = Array.from(agentRows.entries()).sort((a, b) => a[0] - b[0]);
  const hits: string[] = [];
  for (let i = 0; i < boxes.length; i += 1) {
    for (let j = i + 1; j < boxes.length; j += 1) {
      const a = boxes[i];
      const b = boxes[j];
      if (a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1) hits.push(`${a.id}x${b.id}`);
    }
  }
  check(
    "wrap: ten agents under one parent wrap in creation order, overlap-free",
    rows.length >= 2 &&
      rows.flatMap(([, ids]) => ids).join(",") === agents.map((a) => a.id).join(",") &&
      hits.length === 0,
    rows.map(([y, ids]) => `y=${y}:${ids.join(",")}`).join(" ") || hits.join(" ")
  );
}

/* ── 5. identical across runs ──────────────────────────────────────────── */
for (const f of FIXTURES) {
  const a = layoutKey(buildTidyTopologyLayout(f.rt, f.expanded));
  const b = layoutKey(buildTidyTopologyLayout(f.rt, f.expanded));
  check(`deterministic: ${f.name} identical across runs`, a === b, `${a.length} chars`);
}

/* ── Headline: two colonies sit 32px apart, centred under the brain ───── */
{
  const f = twoColonies();
  const layout = buildTidyTopologyLayout(f.rt, f.expanded);
  const a = layout.territories.get("col-a")!;
  const b = layout.territories.get("col-b")!;
  const gap = Math.min(a.x, b.x) * -1 + Math.max(a.x, b.x) - SIZE.specialist.w;
  check(
    "headline: two colonies 32px apart, centred under the brain",
    a.y === b.y &&
      Math.abs(gap - TIDY_SIBLING_GAP) < 1e-6 &&
      Math.abs(a.x + b.x) < 1e-6 &&
      a.y === SIZE.brain.h + TIDY_LEVEL_GAP,
    `col-a=${JSON.stringify(a)} col-b=${JSON.stringify(b)}`
  );
}

/* ── Band offsets are exactly levelGap ─────────────────────────────────── */
{
  const f = withSubs();
  const layout = buildTidyTopologyLayout(f.rt, f.expanded);
  const colonyY = layout.territories.get("col-a")!.y;
  const agentY = layout.agents.get("ag-1")!.y;
  check(
    "bands: colony and agent bands offset by exactly levelGap",
    colonyY === SIZE.brain.h + TIDY_LEVEL_GAP && agentY === colonyY + SIZE.specialist.h + TIDY_LEVEL_GAP,
    `colony=${colonyY} agent=${agentY}`
  );
}

/* ── Camera fit limits ─────────────────────────────────────────────────── */
{
  const cards: PlacedCard[] = [
    { x: 0, y: 0, w: 180, h: 180 },
    { x: -136, y: 236, w: 240, h: 104 },
    { x: 136, y: 236, w: 240, h: 104 },
  ];
  const z = fitZoomFor(cards, { w: 1440, h: 900 });
  const box = boxOf(cards)!;
  check(
    "camera: fit keeps 24px padding without passing 100%",
    z <= FIT_MAX_ZOOM + 1e-9 && (box.w + 48) * z <= 1440 + 1 && (box.h + 48) * z <= 900 + 1,
    `zoom=${z}`
  );
  const wide: PlacedCard[] = [{ x: 0, y: 0, w: 20000, h: 180 }];
  const zFloor = fitZoomFor(wide, { w: 1440, h: 900 });
  check("camera: auto-fit never drops below 40%", zFloor >= FIT_MIN_ZOOM - 1e-9, `zoom=${zFloor}`);
}

const failed: string[] = results.filter((r) => r.startsWith("FAIL"));
console.log(results.join("\n"));
console.log(`\n${results.length - failed.length}/${results.length} passed`);
if (failed.length > 0) process.exit(1);
