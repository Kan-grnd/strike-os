/* Derivation + store checks for the Live Topology spec.
 * Run: npx tsx scripts/check-selectors.ts
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  BRAIN_NODE_ID,
  STRUCTURAL_EDGE_STROKE,
  VERIFICATION_EDGE_STROKE,
  edgePathD,
  getActiveOperations,
  getAttentionRequired,
  getTerritoryStats,
  getTopologyEdges,
  HANDLE_IDS,
  getTopologyNodes,
  getVisibleAgents,
  getVisibleOperations,
  getVisibleSubAgents,
} from "../src/lib/runtime/selectors";
import { useRuntimeStore } from "../src/lib/runtime/store";
import { computeBrainRuntime, computeSystemRuntime } from "../src/lib/runtime/mappers";
import {
  boxOf,
  buildTidyTopologyLayout,
  FIT_MAX_ZOOM,
  FIT_MIN_ZOOM,
  NARROW_BREAKPOINT,
  NARROW_HYSTERESIS,
  NO_INSETS,
  TIDY_LEVEL_GAP,
  TIDY_MAX_ROW_WIDTH,
  TIDY_SIBLING_GAP,
  fitReadableTransformFor,
  fitTopAlignedTransformFor,
  fitTopAnchoredTransformFor,
  fitAllTransformFor,
  fitTopHeadroom,
  fitTransformFor,
  fitZoomFor,
  formatZoomPct,
  graphFitsIn,
  layoutBounds,
  narrowFor,
  type Insets,
  type Placed as PlacedCard,
  type TidyNodeSize,
  type TopologyLayout,
} from "../src/lib/runtime/layout";
import { getBezierPath, Position, type Edge, type Node } from "@xyflow/react";
import type { WorkforceRuntime } from "../src/lib/runtime/types";

const now = new Date();

const runtime: WorkforceRuntime = {
  brain: {
    state: "working",
    agentCount: 6,
    activeCount: 2,
    waitingCount: 3,
    errorCount: 1,
    colonyCount: 2,
    missionCount: 1,
    operationCount: 3,
  },
  colonies: [
    { id: "col-a", name: "Alpha Colony", status: "ACTIVE", agentIds: ["ag-1", "ag-2", "ag-4"], timestamps: { createdAt: now, updatedAt: now } },
    { id: "col-b", name: "Beta Colony", status: "ACTIVE", agentIds: ["ag-3", "ag-5"], timestamps: { createdAt: now, updatedAt: now } },
  ],
  agents: [
    { id: "ag-1", name: "Researcher", type: "SPECIALIST", colonyId: "col-a", runtimeState: "executing", models: ["gpt-5"], capabilities: [], tools: [], permissions: [], successRate: 95, avgDuration: 1, totalCost: 1, createdAt: now, updatedAt: now },
    { id: "ag-2", name: "Analyst", type: "WORKER", colonyId: "col-a", runtimeState: "blocked", models: [], capabilities: [], tools: [], permissions: [], successRate: 90, avgDuration: 1, totalCost: 1, createdAt: now, updatedAt: now },
    { id: "ag-3", name: "Coder", type: "WORKER", colonyId: "col-b", runtimeState: "idle", models: [], capabilities: [], tools: [], permissions: [], successRate: 88, avgDuration: 1, totalCost: 1, createdAt: now, updatedAt: now },
    { id: "ag-4", name: "Sub-Reviewer", type: "WORKER", colonyId: "col-a", parentId: "ag-1", runtimeState: "waiting_for_approval", models: [], capabilities: [], tools: [], permissions: [], successRate: 92, avgDuration: 1, totalCost: 1, createdAt: now, updatedAt: now },
    { id: "ag-5", name: "Failed Agent", type: "WORKER", colonyId: "col-b", runtimeState: "failed", models: [], capabilities: [], tools: [], permissions: [], successRate: 50, avgDuration: 1, totalCost: 1, createdAt: now, updatedAt: now },
    { id: "ag-6", name: "Cancelled Agent", type: "WORKER", colonyId: "col-a", runtimeState: "cancelled", models: [], capabilities: [], tools: [], permissions: [], successRate: 10, avgDuration: 1, totalCost: 1, createdAt: now, updatedAt: now },
  ],
  tasks: [
    { id: "t1", missionId: "m1", description: "run", status: "RUNNING", ownerAgentId: "ag-1", dependencies: [], retryCount: 0, maxRetries: 3, cost: 1, timestamps: { createdAt: now, updatedAt: now } },
    { id: "t2", missionId: "m1", description: "done", status: "COMPLETED", ownerAgentId: "ag-1", dependencies: [], retryCount: 0, maxRetries: 3, cost: 1, timestamps: { createdAt: now, updatedAt: now, completedAt: now } },
    { id: "t3", missionId: "m1", description: "cancelled", status: "CANCELLED", ownerAgentId: "ag-3", dependencies: [], retryCount: 0, maxRetries: 3, cost: 1, timestamps: { createdAt: now, updatedAt: now } },
    { id: "t4", missionId: "m1", description: "queued", status: "QUEUED", ownerAgentId: "ag-2", dependencies: [], retryCount: 0, maxRetries: 3, cost: 1, timestamps: { createdAt: now, updatedAt: now } },
    { id: "t5", missionId: "m1", description: "sub run", status: "RUNNING", ownerAgentId: "ag-4", dependencies: ["t4"], retryCount: 1, maxRetries: 3, cost: 2, timestamps: { createdAt: now, updatedAt: now } },
  ],
  relationships: [
    { fromId: "ag-1", fromType: "agent", relation: "manages", toId: "ag-4", toType: "agent" },
  ],
  recentEvents: [],
  system: { providerCount: 3, modelCount: 4, mcpCount: 1, memoryCount: 2 },
  generatedAt: now,
};

const results: string[] = [];
const check = (label: string, ok: boolean, detail?: string) => {
  results.push(`${ok ? "PASS" : "FAIL"} ${label}${detail ? ` — ${detail}` : ""}`);
};
const levelOf = (s: unknown) => {
  if (s && typeof s === "object") {
    return (s as Record<string, unknown>).level as string;
  }
  return undefined;
};

// Expansion-state helpers. Collapsed = 3 nodes (brain + territories). Expanding
// a node reveals its direct children: a territory reveals agents, a worker
// reveals sub-agents via "<id>:sub" and operations via "<id>:ops".
const collapsed = new Set<string>();
const territoriesOnly = new Set(["col-a", "col-b"]);
const agentsExpanded = new Set([
  "col-a",
  "col-b",
  "ag-1:sub",
  "ag-1:ops",
  "ag-2:ops",
  "ag-4:ops",
]);

/* The tidy-tree layout is expansion-aware, so tests that used to build one
 * layout for every visibility state now expand everything: every colony open
 * and every worker toggle set. Narrow/viewport arguments are gone — the same
 * inputs always build the same graph. */
const expandEverything = (rt: WorkforceRuntime): Set<string> => {
  const s = new Set<string>();
  for (const c of rt.colonies) if (c.status !== "ARCHIVED") s.add(c.id);
  for (const a of rt.agents) {
    s.add(`${a.id}:sub`);
    s.add(`${a.id}:ops`);
  }
  return s;
};
const tidyFull = (rt: WorkforceRuntime): TopologyLayout =>
  buildTidyTopologyLayout(rt, expandEverything(rt));

// ── Collapsed: Brain + Specialist territories only ──
const overviewNodes = getTopologyNodes(runtime, collapsed);
const overviewTypes = overviewNodes.map((n) => n.type as string);
check("collapsed: brain present", overviewNodes.some((n) => n.id === BRAIN_NODE_ID));
check("collapsed: only brain+specialist", overviewTypes.every((t) => t === "brain" || t === "specialist"), overviewTypes.join(","));
check("collapsed: both territories", overviewTypes.filter((t) => t === "specialist").length === 2);
check("collapsed: agents hidden", getVisibleAgents(runtime, collapsed).length === 0);
check("collapsed: sub-agents hidden", getVisibleSubAgents(runtime, collapsed).length === 0);
check("collapsed: operations hidden", getVisibleOperations(runtime, collapsed).length === 0);
check("collapsed: cancelled agent excluded", getVisibleAgents(runtime, territoriesOnly).every((a) => a.id !== "ag-6"));

// ── Territories expanded: root agents appear, sub-agents/ops stay hidden ──
const agentTypes = getTopologyNodes(runtime, territoriesOnly).map((n) => n.type as string);
check("territories expanded: root agents visible", agentTypes.filter((t) => t === "agent").length === 4, agentTypes.join(","));
check("territories expanded: sub-agents hidden", agentTypes.filter((t) => t === "subagent").length === 0);
check("territories expanded: ops hidden", agentTypes.filter((t) => t === "operation").length === 0);

// ── Agents expanded: sub-agents + operations appear ──
const deepNodes = getTopologyNodes(runtime, agentsExpanded);
const deepTypes = deepNodes.map((n) => n.type as string);
check("agents expanded: sub-agent visible", deepNodes.some((n) => n.id === "ag-4"));
check("agents expanded: ops visible", ["t1", "t4", "t5"].every((id) => deepNodes.some((n) => n.id === id)));
check("agents expanded: completed excluded", !deepNodes.some((n) => n.id === "t2"));
check("agents expanded: cancelled excluded", !deepNodes.some((n) => n.id === "t3"));

// ── Level data attached to each node ──
const agentNodeData = deepNodes.find((n) => n.id === "ag-1");
check("level: brain carries core", levelOf(deepNodes.find((n) => n.id === BRAIN_NODE_ID)?.data) === "core", String(levelOf(deepNodes.find((n) => n.id === BRAIN_NODE_ID)?.data)));
check("level: agent carries level + expand counts", levelOf(agentNodeData?.data) === "agent" && (agentNodeData?.data as Record<string, unknown>).subCount === 1 && (agentNodeData?.data as Record<string, unknown>).opCount === 1, JSON.stringify(levelOf(agentNodeData?.data)));
check("level: worker carries per-kind expand flags", (agentNodeData?.data as Record<string, unknown>).expandedSub === true && (agentNodeData?.data as Record<string, unknown>).expandedOps === true, JSON.stringify(agentNodeData?.data));
check("level: op carries op level", levelOf(deepNodes.find((n) => n.id === "t1")?.data) === "op", String(levelOf(deepNodes.find((n) => n.id === "t1")?.data)));

// ── Active operations / attention ──
const active = getActiveOperations(runtime);
check("active ops = 3", active.length === 3, active.map((t) => t.id).join(","));
const attention = getAttentionRequired(runtime);
check("attention = analyst+sub+failed", attention.map((a) => a.id).sort().join(",") === "ag-2,ag-4,ag-5", attention.map((a) => a.id).join(","));

// ── Territory stats (specialist identity) ──
const alpha = getTerritoryStats(runtime, "col-a");
const beta = getTerritoryStats(runtime, "col-b");
check("territory alpha total excludes cancelled", alpha.total === 3, String(alpha.total));
check("territory alpha active=1", alpha.active === 1, String(alpha.active));
check("territory alpha waiting=2", alpha.waiting === 2, String(alpha.waiting));
check("territory beta errors=1", beta.errors === 1, String(beta.errors));

// ── Rendered card sizes ──
// One table, shared by every geometry check below, and deliberately the same
// numbers the layout reserves against (see CARD_SIZE in layout.ts). Heights are
// the tallest measured variant of each card, so a check that passes here holds
// for whatever disclosure state a card happens to be in.
const CARD_W: Record<string, number> = {
  brain: 200,
  specialist: 260,
  agent: 220,
  subagent: 200,
  operation: 200,
};
const CARD_H: Record<string, number> = {
  brain: 200,
  specialist: 80,
  agent: 78,
  subagent: 75,
  operation: 75,
};

// ── Top-down tree ──
// The brain is the origin of graph space *and* the topmost card in it: every
// territory hangs in a centred row below it, with its own subtree built as one
// block and translated into that row. The layout this replaced put the brain
// *between* its territories, which is the right shape for a network and the
// wrong one for a hierarchy — and a second thing it did (a phone got a stacked
// tree instead) meant the same workforce was two different graphs depending on
// the window. These check the geometry that replaced both.
const posNodes = getTopologyNodes(runtime, agentsExpanded);
const posOf = (id: string) => posNodes.find((n) => n.id === id)?.position ?? { x: 0, y: 0 };
const brainPos = posOf(BRAIN_NODE_ID);
const territoryPos = (id: string) => posOf(id);
/** A visible card's placed centre-x/top-y, with the type the collision checks
 *  need. One lookup, so a check about a card's position and a check about
 *  whether two cards overlap can never be reading different positions. */
const placedAt = (id: string): Placed | undefined => {
  const n = posNodes.find((m) => m.id === id);
  return n ? { id, type: n.type as string, ...posOf(id) } : undefined;
};
const ownerColony = new Map<string, string>([
  ["ag-1", "col-a"],
  ["ag-2", "col-a"],
  ["ag-4", "col-a"],
  ["t1", "col-a"],
  ["t4", "col-a"],
  ["t5", "col-a"],
  ["ag-3", "col-b"],
  ["ag-5", "col-b"],
]);
/* The brain is the origin, not merely "a fixed point somewhere near the top".
 * Everything else in this section is relative to it, so if the origin moves the
 * whole composition silently becomes a different graph. */
check("tree: the brain is the origin of graph space and never moves", brainPos.x === 0 && brainPos.y === 0, JSON.stringify(brainPos));

/* The property the whole layout exists for: the brain is the top of the
 * hierarchy, so nothing in the graph is above it — not a territory, not a
 * worker, not an operation. Two halves, because either one alone is a weaker
 * claim than it looks. "Every card is below the brain's top edge" would pass
 * with a card beside the brain; "the brain's top edge is the graph's topmost
 * pixel" is the same statement read from the other side, and both are asserted
 * because the graph is a tree and the eye reads rank off the topmost card. */
const brainBottom = brainPos.y + CARD_H.brain;
check(
  "tree: the brain is the topmost card — nothing in the graph is above it",
  Math.min(...posNodes.map((n) => n.position.y)) === brainPos.y &&
    posNodes.filter((n) => n.type !== "brain").every((n) => n.position.y >= brainBottom),
  `brain@${JSON.stringify(brainPos)} lowestOther=${Math.min(
    ...posNodes.filter((n) => n.type !== "brain").map((n) => n.position.y)
  )} brainBottom=${brainBottom}`
);

/* Siblings, not a chain, and below rather than beside. The two territories
 * share one row (same y, one on each side of the brain's column) and that row
 * starts a gap under the brain's bottom edge, so a reader sees the org chart
 * they already know: up is the boss, side by side is the same level. */
check(
  "tree: the territories share one row beneath the brain, one on each side",
  territoryPos("col-a").y === territoryPos("col-b").y &&
    territoryPos("col-a").y >= brainBottom &&
    territoryPos("col-a").x < 0 &&
    territoryPos("col-b").x > 0,
  `col-a=${JSON.stringify(territoryPos("col-a"))} col-b=${JSON.stringify(territoryPos("col-b"))}`
);

/* Centred, not left-aligned. The colonies row is centred on the brain's
 * column, so the brain heads the composition instead of sitting off to one
 * side of it. Deeper rows centre on their own parents — an asymmetric tree
 * cannot also centre its whole box on the root, and the engine correctly
 * prefers exact parent centering. */
const colonyCentres = posNodes
  .filter((n) => n.type === "specialist")
  .map((n) => n.position.x)
  .sort((a, b) => a - b);
check(
  "tree: the colonies row is centred on the brain's column",
  colonyCentres.length > 0 &&
    Math.abs((colonyCentres[0] + colonyCentres[colonyCentres.length - 1]) / 2) < 1,
  `centres=${colonyCentres.join(",")}`
);

/* Each block is its own world: no card crosses into the neighbouring
 * territory's band. This is the property that keeps a territory's subtree
 * visually its own — the guarantee a shared row cursor used to break. */
const bandOf = (colony: string) => {
  const members = posNodes.filter((n) => (ownerColony.get(n.id as string) ?? n.id) === colony);
  return {
    min: Math.min(...members.map((n) => n.position.x - CARD_W[n.type as string] / 2)),
    max: Math.max(...members.map((n) => n.position.x + CARD_W[n.type as string] / 2)),
  };
};
const [bandA, bandB] = [bandOf("col-a"), bandOf("col-b")].sort((p, q) => p.min - q.min);
check(
  "tree: every territory's subtree stays inside its own band",
  bandA.max < bandB.min,
  `col-a=[${bandA.min},${bandA.max}] col-b=[${bandB.min},${bandB.max}]`
);

/* Siblings, not a chain. The hierarchy is Brain → territory → agent, and the one
 * relationship the old stacked layout made easy to misread was a territory
 * looking like it belonged to the other one. There is no territory-to-territory
 * edge of any kind, structural or transient. */
const posEdges = getTopologyEdges(runtime, agentsExpanded);
const territoryIdSet = new Set(runtime.colonies.map((c) => c.id));
check(
  "tree: no territory is ever connected to another territory",
  posEdges.every((e) => !(territoryIdSet.has(e.source) && territoryIdSet.has(e.target))),
  posEdges.map((e) => `${e.source}->${e.target}`).join(" ")
);
/* The permanent edge set has to be *exactly* the ownership the runtime
 * declares: no invented relationship, none missing, and — the failure this is
 * really about — no agent or operation attached to anything but the parent it
 * belongs to. Compared as sets rather than one pair at a time, so a duplicate
 * or a stray edge cannot hide behind a correct one. */
const NOT_LIVE = new Set(["cancelled", "stopped"]);
const declaredOwnership = new Set<string>(
  Array.from(territoryIdSet).map((id) => `${BRAIN_NODE_ID}>${id}`)
);
for (const a of runtime.agents) {
  if (NOT_LIVE.has(a.runtimeState)) continue;
  if (a.parentId) declaredOwnership.add(`${a.parentId}>${a.id}`);
  else if (a.colonyId) declaredOwnership.add(`${a.colonyId}>${a.id}`);
}
for (const t of runtime.tasks) {
  if (t.status === "COMPLETED" || t.status === "CANCELLED") continue;
  if (t.ownerAgentId) declaredOwnership.add(`${t.ownerAgentId}>${t.id}`);
}
const actualOwnership = new Set(posEdges.map((e) => `${e.source}>${e.target}`));
check(
  "tree: the permanent edge set is exactly the declared ownership",
  declaredOwnership.size === actualOwnership.size &&
    Array.from(declaredOwnership).every((k) => actualOwnership.has(k)),
  `declared=${Array.from(declaredOwnership).sort().join(" ")} actual=${Array.from(actualOwnership).sort().join(" ")}`
);
/* An operation belongs to its owner's child row: below the owner, side by
 * side with the owner's sub-agents rather than stacked beneath it. The child
 * row is one band below the owner, so rank still reads top-down while every
 * gap in the row stays exactly one sibling gap. */
check(
  "tree: every operation sits in its owner's child row, below the owner",
  ["t1", "t4", "t5"].every((id) => {
    const owner = runtime.tasks.find((t) => t.id === id)?.ownerAgentId as string;
    const op = placedAt(id);
    const agent = placedAt(owner);
    const siblingRows = posEdges
      .filter((e) => e.source === owner)
      .map((e) => placedAt(e.target)?.y);
    return (
      op !== undefined &&
      agent !== undefined &&
      op.y > agent.y &&
      siblingRows.length > 0 &&
      siblingRows.every((y) => y === op.y)
    );
  }),
  ["t1", "t4", "t5"].map((id) => {
    const owner = runtime.tasks.find((t) => t.id === id)?.ownerAgentId as string;
    return `${id}@${JSON.stringify(placedAt(id))} under ${owner}@${JSON.stringify(placedAt(owner))}`;
  }).join(" | ")
);

// ── No card may overlap another card (the P2 that ordering checks missed) ──
// "Below" is not the same as "clear of": the old constants put operation cards
// 68px apart while the cards are 117px tall. Reproduce the worst case by using
// the tallest measured card for every kind, and check real rectangles.
type Placed = { id: string; type: string; x: number; y: number };
const overlaps = (a: Placed, b: Placed): boolean => {
  const dx = Math.abs(a.x - b.x) < (CARD_W[a.type] + CARD_W[b.type]) / 2;
  const dy = Math.abs(a.y - b.y) < (CARD_H[a.type] + CARD_H[b.type]) / 2;
  return dx && dy;
};
/** Every overlapping pair in a set of placed cards. One implementation, so a
 *  geometry check and a spacing check can never disagree about what "overlap"
 *  means. */
const collisionsIn = (placed: Placed[]): string[] => {
  const hits: string[] = [];
  for (let i = 0; i < placed.length; i += 1) {
    for (let j = i + 1; j < placed.length; j += 1) {
      if (overlaps(placed[i], placed[j])) {
        hits.push(`${placed[i].id}(${placed[i].type}) x ${placed[j].id}(${placed[j].type})`);
      }
    }
  }
  return hits;
};
/** The cards a layout actually places, ready for collisionsIn(). */
const placedFromLayout = (layout: TopologyLayout): Placed[] => [
  { id: "brain", type: "brain", ...layout.brain },
  ...Array.from(layout.territories.entries()).map(([id, p]) => ({ id, type: "specialist", ...p })),
  ...Array.from(layout.agents.entries()).map(([id, p]) => ({ id, type: "agent", ...p })),
  ...Array.from(layout.subAgents.entries()).map(([id, p]) => ({ id, type: "subagent", ...p })),
  ...Array.from(layout.operations.entries()).map(([id, p]) => ({ id, type: "operation", ...p })),
];
const worstCasePos: Placed[] = [
  { id: "brain", type: "brain", ...posOf(BRAIN_NODE_ID) },
  ...posNodes
    .filter((n) => n.type !== "brain")
    .map((n) => ({ id: n.id as string, type: n.type as string, x: posOf(n.id as string).x, y: posOf(n.id as string).y })),
];
const collisions = collisionsIn(worstCasePos);
check("geometry: no card overlaps another at measured heights", collisions.length === 0, collisions.join(" | "));
// Operations under ONE owner share one child row: same y, and neighbours at
// least a full card plus one sibling gap apart centre-to-centre (exactly that
// when adjacent). Operations under different owners live in different columns,
// so grouping by owner is what makes this a real check.
const ownerOfTask = new Map(runtime.tasks.map((t) => [t.id, t.ownerAgentId]));
const byOwner = new Map<string, Array<{ x: number; y: number }>>();
for (const n of worstCasePos.filter((x) => x.type === "operation")) {
  const owner = ownerOfTask.get(n.id) ?? "none";
  byOwner.set(owner, [...(byOwner.get(owner) ?? []), { x: n.x, y: n.y }]);
}
const badOwnerRows = Array.from(byOwner.entries()).filter(([, ns]) => {
  if (new Set(ns.map((n) => n.y)).size !== 1) return true;
  const xs = ns.map((n) => n.x).sort((a, b) => a - b);
  return xs.some((x, i) => i > 0 && x - xs[i - 1] < CARD_W.operation + TIDY_SIBLING_GAP - 1e-6);
});
check(
  "geometry: one owner's operations share one row with exact gaps",
  badOwnerRows.length === 0,
  Array.from(byOwner.entries()).map(([o, ns]) => `${o}:${ns.map((n) => `${n.x},${n.y}`).join("/")}`).join(" | ")
);
const subPos = worstCasePos.find((n) => n.type === "subagent");
const ownerPos = subPos ? worstCasePos.find((n) => n.id === "ag-1") : undefined;
check("geometry: sub-agent row clears its parent card (card height + gap)", subPos && ownerPos ? subPos.y - ownerPos.y >= CARD_H.agent : true, subPos && ownerPos ? `subY=${subPos.y} ownerY=${ownerPos.y} delta=${subPos.y - ownerPos.y}` : "n/a");

// ── Compactness contract ──
// The compact pass is only a win if the cards actually got smaller, and the
// win came from making the action row unable to wrap. These guard both, so a
// later tweak cannot quietly reintroduce a 161px card or a widening grid.
const graphSpan = (placed: Placed[]): number =>
  Math.max(...placed.map((n) => n.x + CARD_W[n.type] / 2)) -
  Math.min(...placed.map((n) => n.x - CARD_W[n.type] / 2));
const placedOf = (nodes: Node[]): Placed[] =>
  nodes.map((n) => ({ id: n.id as string, type: n.type as string, x: n.position.x, y: n.position.y }));
const brainCard = worstCasePos.find((n) => n.type === "brain")!;
check(
  "compact: node heights match the measured custom family ceilings",
  CARD_H.specialist <= 80 && CARD_H.agent <= 78 && CARD_H.subagent <= 75 && CARD_H.operation <= 75,
  `specialist=${CARD_H.specialist} agent=${CARD_H.agent} subagent=${CARD_H.subagent} operation=${CARD_H.operation}`
);
check(
  "compact: no card lands on the brain (the tree keeps clear of its own root)",
  worstCasePos.filter((n) => n.id !== BRAIN_NODE_ID).every((n) => !overlaps(brainCard, n)),
  `brain@${JSON.stringify(brainCard)} others=${worstCasePos.length - 1}`
);
check(
  "compact: node widths match the custom family spec",
  CARD_W.brain === 200 &&
    CARD_W.specialist === 260 &&
    CARD_W.agent === 220 &&
    CARD_W.subagent === 200 &&
    CARD_W.operation === 200,
  JSON.stringify(CARD_W)
);
check(
  "compact: colony and agent bands sit at exactly the fixed offsets",
  (() => {
    const colonyY = territoryPos("col-a").y;
    const agentY = posOf("ag-1").y;
    return (
      colonyY === CARD_H.brain + TIDY_LEVEL_GAP &&
      agentY === colonyY + CARD_H.specialist + TIDY_LEVEL_GAP
    );
  })(),
  `colony=${territoryPos("col-a").y} agent=${posOf("ag-1").y}`
);
check(
  "compact: hierarchy still readable (colony/agent lead, compact cards below)",
  CARD_W.specialist === 260 &&
    CARD_W.agent === 220 &&
    CARD_W.agent > CARD_W.subagent &&
    CARD_W.subagent === CARD_W.operation &&
    CARD_W.operation === 200,
  JSON.stringify(CARD_W)
);
check(
  "compact: collapsing workers moves no band",
  (() => {
    /* Toggling sub-agents and operations off removes their cards, but bands
     * are pure functions of depth — the colony and agent rows sit exactly
     * where they sat with everything expanded. */
    const open = buildTidyTopologyLayout(runtime, agentsExpanded);
    const shut = buildTidyTopologyLayout(runtime, territoriesOnly);
    const sameBand = (a?: { x: number; y: number }, b?: { x: number; y: number }) =>
      a !== undefined && b !== undefined && a.y === b.y;
    return (
      sameBand(open.territories.get("col-a"), shut.territories.get("col-a")) &&
      sameBand(open.territories.get("col-b"), shut.territories.get("col-b")) &&
      sameBand(open.agents.get("ag-1"), shut.agents.get("ag-1")) &&
      sameBand(open.agents.get("ag-3"), shut.agents.get("ag-3"))
    );
  })(),
  "bands are depth functions, not disclosure functions"
);

// ── Growth in one territory moves no band anywhere ──
// Deepening col-b widens the brain's row, so col-a may shift sideways —
// that is growth, not restructuring. What must never move is vertical: bands
// are pure functions of depth, and the repaired graph must still be overlap-free.
check(
  "tree: one territory's growth moves no band anywhere",
  (() => {
    const before = tidyFull(runtime);
    /* Give col-b two more levels of worker, deeper than anything col-a has. */
    const deepened: WorkforceRuntime = {
      ...runtime,
      agents: [
        ...runtime.agents,
        { ...runtime.agents[3], id: "ag-7", name: "Coder Sub", parentId: "ag-3", colonyId: "col-b", runtimeState: "idle" },
        { ...runtime.agents[3], id: "ag-8", name: "Grandchild", parentId: "ag-7", colonyId: "col-b", runtimeState: "idle" },
      ],
      tasks: [
        ...runtime.tasks,
        { ...runtime.tasks[0], id: "t7", description: "deep", ownerAgentId: "ag-8", status: "RUNNING" },
      ],
    };
    const after = tidyFull(deepened);
    const readY = (l: TopologyLayout, id: string): number | undefined => {
      for (const bag of [l.territories, l.agents, l.subAgents, l.operations]) {
        const p = bag.get(id);
        if (p) return p.y;
      }
      return undefined;
    };
    const ids = ["col-a", "col-b", "ag-1", "ag-2", "ag-3", "ag-4", "ag-5", "t1", "t4", "t5"];
    const moved = ids.filter((id) => readY(before, id) !== readY(after, id));
    return (
      moved.length === 0 &&
      after.subAgents.has("ag-8") &&
      collisionsIn(placedFromLayout(after)).length === 0
    );
  })(),
  "col-b grows deeper while every existing band stays put"
);

/* ── Row width discipline ──
 *
 * Sibling colonies are never split across rows unless there are more than 4:
 * the wrap repair applies to the children of a single parent only. Two
 * colonies with three agents each need 2 x 796px + 32px = 1624px, side by
 * side under the 2400px cap. */
const fiveRt: WorkforceRuntime = {
  ...runtime,
  colonies: Array.from({ length: 5 }, (_, i) => ({
    id: `c${i}`,
    name: `Colony ${i}`,
    status: "ACTIVE" as const,
    agentIds: [],
    timestamps: { createdAt: new Date(now.getTime() + i * 1000), updatedAt: now },
  })),
  agents: [],
  tasks: [],
};
const fiveExpanded = new Set(fiveRt.colonies.map((c) => c.id));
const fiveLayout = tidyFull(fiveRt);
const fivePlaced = placedFromLayout(fiveLayout);
const fiveRows = new Map<number, string[]>();
for (const card of fivePlaced.filter((p) => p.type === "specialist")) {
  fiveRows.set(card.y, [...(fiveRows.get(card.y) ?? []), card.id]);
}
const fiveRowList = Array.from(fiveRows.entries()).sort((a, b) => a[0] - b[0]);
check(
  "tree: five colonies sit in one row, in creation order",
  fiveRowList.length === 1 &&
    fiveRowList[0][1].join(",") === "c0,c1,c2,c3,c4" &&
    new Set(fiveRowList[0][1]).size === 5,
  fiveRowList.map(([y, ids]) => `y=${y}:${ids.join(",")}`).join(" ")
);
check(
  "tree: the five-colony row is centred and overlap-free",
  (() => {
    if (fiveRowList.length !== 1) return false;
    const box = boxOf(layoutBounds(fiveLayout))!;
    return Math.abs(box.minX + box.maxX) < 1 && collisionsIn(fivePlaced).length === 0;
  })(),
  `box=${JSON.stringify(boxOf(layoutBounds(fiveLayout)))} hits=${collisionsIn(fivePlaced).join(" | ")}`
);
/* Wrap belongs to a single parent with many children: one colony with ten
 * agents (10 x 244px + 9 x 32px = 2728px) wraps its agent row, in creation
 * order across the rows, with nothing overlapping and the brain on top. */
const tenAgentsRt: WorkforceRuntime = {
  ...runtime,
  colonies: [
    { id: "col-solo", name: "Solo", status: "ACTIVE", agentIds: [], timestamps: { createdAt: now, updatedAt: now } },
  ],
  agents: Array.from({ length: 10 }, (_, i) => ({
    ...runtime.agents[0],
    id: `solo-${i}`,
    name: `Solo ${i}`,
    colonyId: "col-solo",
    parentId: undefined,
    runtimeState: "idle" as const,
    createdAt: new Date(now.getTime() + i * 1000),
    updatedAt: now,
  })),
  tasks: [],
};
const tenExpanded = new Set([
  "col-solo",
  ...tenAgentsRt.agents.flatMap((a) => [`${a.id}:sub`, `${a.id}:ops`]),
]);
const tenLayout = tidyFull(tenAgentsRt);
const tenPlaced = placedFromLayout(tenLayout);
const tenRows = new Map<number, string[]>();
for (const card of tenPlaced.filter((p) => p.type === "agent")) {
  tenRows.set(card.y, [...(tenRows.get(card.y) ?? []), card.id]);
}
const tenRowList = Array.from(tenRows.entries()).sort((a, b) => a[0] - b[0]);
check(
  "tree: ten agents under one parent wrap into rows, in creation order",
  tenRowList.length >= 2 &&
    tenRowList.flatMap(([, ids]) => ids).join(",") ===
      Array.from({ length: 10 }, (_, i) => `solo-${i}`).join(","),
  tenRowList.map(([y, ids]) => `y=${y}:${ids.join(",")}`).join(" ")
);
check(
  "tree: wrapped agent rows are overlap-free with the brain on top",
  (() => {
    if (tenRowList.length < 2) return false;
    const brainBottom = tenLayout.brain.y + CARD_H.brain;
    return (
      collisionsIn(tenPlaced).length === 0 &&
      Math.min(...tenPlaced.map((p) => p.y)) === tenLayout.brain.y &&
      tenPlaced.filter((p) => p.type !== "brain").every((p) => p.y >= brainBottom)
    );
  })(),
  `rows=${tenRowList.map(([y, ids]) => `${y}:${ids.join(",")}`).join(" ")} hits=${collisionsIn(tenPlaced).join(" | ")}`
);


// ── One graph at every width ──
// The layout takes no viewport input at all — narrow mode changes legend
// density and camera behaviour, never coordinates. So the phone gets the
// *same* graph by construction: brain at the origin, territories in one row
// below it, workers in creation order, operations with their owners, and no
// overlaps. The narrow-mode UI contract (narrowFor) is still pinned in the
// camera section below.
check(
  "geometry: the same inputs build the same graph regardless of pane",
  (() => {
    const a = getTopologyNodes(runtime, agentsExpanded);
    const b = getTopologyNodes(runtime, agentsExpanded);
    return a.every((n) => {
      const m = b.find((k) => k.id === n.id);
      return m !== undefined && m.position.x === n.position.x && m.position.y === n.position.y;
    });
  })(),
  "no viewport input, no viewport variance"
);

// ── Determinism ──
const posNodesAgain = getTopologyNodes(runtime, agentsExpanded);
const stable = posNodes.every((n) => {
  const other = posNodesAgain.find((m) => m.id === n.id);
  return other && other.position.x === n.position.x && other.position.y === n.position.y;
});
check("layout determinism: identical across calls", stable);

/* ── Deterministic *order*, not just deterministic pixels ──
 * Re-running the same build is trivially stable; the failure this guards is
 * feeding the same graph in a different order and getting a different
 * picture. That is not hypothetical here: the snapshot route reads colonies,
 * agents and tasks with a bare `findMany`, so the order the layout sees is the
 * order Postgres happened to use, and a worker's children could change places
 * between two renders of an unchanged graph.
 *
 * The layout therefore orders by creation time with the id as tie-break. The
 * fixture below is the real shape of the problem — two territories, three
 * workers each, deliberately *shuffled* input — and the assertion is the order a
 * reader is promised: left to right by creation, with the last worker
 * easternmost. */
const at = (base: Date, minutes: number) => new Date(base.getTime() + minutes * 60_000);
const orderBase = new Date("2026-01-01T00:00:00.000Z");
const orderedRt: WorkforceRuntime = {
  ...runtime,
  colonies: [
    { id: "col-res", name: "Research Colony", status: "ACTIVE", agentIds: ["a-res", "a-web", "a-src"], timestamps: { createdAt: at(orderBase, 0), updatedAt: at(orderBase, 0) } },
    { id: "col-eng", name: "Engineering Colony", status: "ACTIVE", agentIds: ["a-arch", "a-coder", "a-qa"], timestamps: { createdAt: at(orderBase, 10), updatedAt: at(orderBase, 10) } },
  ],
  agents: [
    // Deliberately not in creation order, and not grouped by territory.
    { ...runtime.agents[0], id: "a-qa", name: "QA", colonyId: "col-eng", runtimeState: "idle", createdAt: at(orderBase, 103), updatedAt: at(orderBase, 103) },
    { ...runtime.agents[0], id: "a-web", name: "Web Analyst", colonyId: "col-res", runtimeState: "idle", createdAt: at(orderBase, 21), updatedAt: at(orderBase, 21) },
    { ...runtime.agents[0], id: "a-arch", name: "Architect", colonyId: "col-eng", runtimeState: "idle", createdAt: at(orderBase, 101), updatedAt: at(orderBase, 101) },
    { ...runtime.agents[0], id: "a-res", name: "Researcher", colonyId: "col-res", runtimeState: "idle", createdAt: at(orderBase, 20), updatedAt: at(orderBase, 20) },
    { ...runtime.agents[0], id: "a-coder", name: "Coder", colonyId: "col-eng", runtimeState: "idle", createdAt: at(orderBase, 102), updatedAt: at(orderBase, 102) },
    { ...runtime.agents[0], id: "a-src", name: "Source Reviewer", colonyId: "col-res", runtimeState: "idle", createdAt: at(orderBase, 22), updatedAt: at(orderBase, 22) },
  ],
  tasks: [],
};
const orderedExpanded = new Set(["col-res", "col-eng"]);
const readingOrder = (rt: WorkforceRuntime): string => {
  const l = buildTidyTopologyLayout(rt, orderedExpanded);
  const rootsOf = (colony: string) => {
    const roots = rt.agents.filter((a) => a.colonyId === colony && !a.parentId);
    const sorted = l.agents;
    return roots
      .map((a) => ({ id: a.id, x: sorted.get(a.id)?.x ?? 0 }))
      .sort((p, q) => p.x - q.x)
      .map((p) => p.id)
      .join(" ");
  };
  return `territories=${Array.from(l.territories.keys()).join(" ")} | research=${rootsOf("col-res")} | engineering=${rootsOf("col-eng")}`;
};
const orderedRead = readingOrder(orderedRt);
check(
  "order: siblings read left to right in creation order, whatever order they arrive in",
  orderedRead === "territories=col-res col-eng | research=a-res a-web a-src | engineering=a-arch a-coder a-qa",
  orderedRead
);
/* QA is the last worker engineering created, so when the territory's roots share
 * a row it has to end up easternmost — the specific promise the previous layout
 * broke, where a territory with six workers pushed the last one to the far side
 * of the brain's own column. Measured on the wide tier, where three roots fit on
 * one row; the phone tier wraps to two per row, and there the invariant is the
 * reading order asserted above rather than raw x. */
check(
  "order: the last-created worker in a territory is the easternmost one",
  (() => {
    const layout = buildTidyTopologyLayout(orderedRt, orderedExpanded);
    const byColony = new Map<string, typeof orderedRt.agents>();
    for (const a of orderedRt.agents) {
      byColony.set(a.colonyId as string, [...(byColony.get(a.colonyId as string) ?? []), a]);
    }
    return Array.from(byColony.values()).every((members) => {
      const newest = [...members].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime()).pop();
      if (!newest) return false;
      const mine = layout.agents.get(newest.id)?.x ?? 0;
      return members.every((b) => (layout.agents.get(b.id)?.x ?? -Infinity) <= mine);
    });
  })(),
  orderedRt.agents
    .map((a) => `${a.name}@${Math.round(buildTidyTopologyLayout(orderedRt, orderedExpanded).agents.get(a.id)?.x ?? 0)}`)
    .join(" ")
);
/* Reordering the input must not move a single card. This is the property that
 * makes the order a decision instead of an accident. */
const shuffleRt: WorkforceRuntime = {
  ...orderedRt,
  colonies: [...orderedRt.colonies].reverse(),
  agents: [...orderedRt.agents].reverse(),
};
check(
  "order: shuffling the input leaves every coordinate unchanged",
  (() => {
    const a = buildTidyTopologyLayout(orderedRt, orderedExpanded);
    const b = buildTidyTopologyLayout(shuffleRt, orderedExpanded);
    const same = (x?: { x: number; y: number }, y?: { x: number; y: number }) =>
      x !== undefined && y !== undefined && x.x === y.x && x.y === y.y;
    return (
      same(a.brain, b.brain) &&
      Array.from(orderedRt.agents).every((agent) => same(a.agents.get(agent.id), b.agents.get(agent.id)))
    );
  })(),
  `ordered=${readingOrder(orderedRt)} shuffled=${readingOrder(shuffleRt)}`
);
check(
  "order: the brain is the origin for the real two-territory shape too",
  (() => {
    const l = buildTidyTopologyLayout(orderedRt, orderedExpanded);
    const res = l.territories.get("col-res");
    const eng = l.territories.get("col-eng");
    return (
      l.brain.x === 0 && l.brain.y === 0 &&
      res !== undefined && eng !== undefined &&
      /* One row beneath the origin, in creation order left to right. */
      res.x < 0 && res.y > l.brain.y && eng.x > 0 && res.y === eng.y
    );
  })(),
  `res=${JSON.stringify(buildTidyTopologyLayout(orderedRt, orderedExpanded).territories.get("col-res"))} eng=${JSON.stringify(buildTidyTopologyLayout(orderedRt, orderedExpanded).territories.get("col-eng"))}`
);

/* ── Edge clarity: no edge may pass through a node it does not connect ──
 *
 * 40 samples along each ownership cubic (the same getBezierPath math with
 * the same 0.5 curvature the component paints); a sample strictly inside the
 * box of a foreign node fails. This is what caught the sphere→Engineering
 * edge running behind Research's cards after the colonies stacked. */
interface GBox {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}
/* Handles sit at the horizontal center — except ticket (task/sub-agent)
 * cards, whose top/bottom pair sits at 60% of the card width. */
const HANDLE_X: Record<string, number> = {
  brain: 0.5,
  specialist: 0.5,
  agent: 0.5,
  subagent: 0.6,
  operation: 0.6,
};
const HANDLE_PT: Record<string, (b: GBox, t: string) => [number, number]> = {
  [HANDLE_IDS.in]: (b, t) => [b.x0 + (b.x1 - b.x0) * (HANDLE_X[t] ?? 0.5), b.y0],
  [HANDLE_IDS.out]: (b, t) => [b.x0 + (b.x1 - b.x0) * (HANDLE_X[t] ?? 0.5), b.y1],
  [HANDLE_IDS.inLeft]: (b) => [b.x0, (b.y0 + b.y1) / 2],
  [HANDLE_IDS.outLeft]: (b) => [b.x0, (b.y0 + b.y1) / 2],
  [HANDLE_IDS.inRight]: (b) => [b.x1, (b.y0 + b.y1) / 2],
  [HANDLE_IDS.outRight]: (b) => [b.x1, (b.y0 + b.y1) / 2],
};
const HANDLE_POS: Record<string, Position> = {
  [HANDLE_IDS.in]: Position.Top,
  [HANDLE_IDS.out]: Position.Bottom,
  [HANDLE_IDS.inLeft]: Position.Left,
  [HANDLE_IDS.outLeft]: Position.Left,
  [HANDLE_IDS.inRight]: Position.Right,
  [HANDLE_IDS.outRight]: Position.Right,
};
const cubicAt = (
  p0: [number, number],
  p1: [number, number],
  p2: [number, number],
  p3: [number, number],
  t: number
): [number, number] => {
  const u = 1 - t;
  return [
    u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0],
    u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1],
  ];
};
function edgeClarityViolations(
  placed: Placed[],
  edges: Edge[]
): { hits: string[]; notes: string[] } {
  const boxes = new Map<string, GBox>();
  const kinds = new Map<string, string>();
  const topY = new Map<string, number>();
  for (const p of placed) {
    const w = CARD_W[p.type] ?? 0;
    const h = CARD_H[p.type] ?? 0;
    boxes.set(p.id, { x0: p.x - w / 2, y0: p.y, x1: p.x + w / 2, y1: p.y + h });
    kinds.set(p.id, p.type);
    topY.set(p.id, p.y);
  }
  /* A source whose children wrap into more than one chunk row cannot route to
   * the overflow rows without crossing the first row — geometrically forced
   * by any top-down routing, and only possible past 2400px of children. Only
   * edges from such a parent to its own non-first-row children are reported
   * instead of failed; everything else must be clean. */
  const childRows = new Map<string, Set<number>>();
  for (const e of edges) {
    const y = topY.get(e.target);
    if (y === undefined) continue;
    const set = childRows.get(e.source) ?? new Set<number>();
    set.add(y);
    childRows.set(e.source, set);
  }
  const firstRow = new Map<string, number>();
  for (const [id, rows] of Array.from(childRows)) {
    if (rows.size > 1) firstRow.set(id, Math.min(...Array.from(rows)));
  }
  const isOverflowEdge = (source: string, target: string): boolean => {
    const first = firstRow.get(source);
    if (first === undefined) return false;
    return (topY.get(target) ?? first) > first;
  };
  const hits: string[] = [];
  const notes: string[] = [];
  for (const e of edges) {
    const sh = e.sourceHandle ?? "";
    const th = e.targetHandle ?? "";
    const sb = boxes.get(e.source);
    const tb = boxes.get(e.target);
    if (!HANDLE_PT[sh] || !HANDLE_PT[th] || !sb || !tb) continue;
    const [sx, sy] = HANDLE_PT[sh](sb, kinds.get(e.source) ?? "");
    const [tx, ty] = HANDLE_PT[th](tb, kinds.get(e.target) ?? "");
    const fanDx = (e.data as { fanDx?: number } | undefined)?.fanDx ?? 0;
    const [d] =
      fanDx !== 0
        ? [edgePathD(sx, sy, tx, ty, fanDx)]
        : getBezierPath({
            sourceX: sx,
            sourceY: sy,
            sourcePosition: HANDLE_POS[sh],
            targetX: tx,
            targetY: ty,
            targetPosition: HANDLE_POS[th],
            curvature: 0.5,
          });
    const nums = (d.match(/-?\d*\.?\d+/g) ?? []).map(Number);
    if (nums.length < 8) {
      hits.push(`${e.id}: unparseable path`);
      continue;
    }
    const p0: [number, number] = [nums[0], nums[1]];
    const p1: [number, number] = [nums[2], nums[3]];
    const p2: [number, number] = [nums[4], nums[5]];
    const p3: [number, number] = [nums[6], nums[7]];
    for (let i = 0; i < 40; i += 1) {
      const [px, py] = cubicAt(p0, p1, p2, p3, i / 39);
      for (const [id, b] of Array.from(boxes)) {
        if (id === e.source || id === e.target) continue;
        if (px > b.x0 && px < b.x1 && py > b.y0 && py < b.y1) {
          (isOverflowEdge(e.source, e.target) ? notes : hits).push(`${e.id} sample ${i}/40 inside ${id}`);
          break;
        }
      }
      const bucket = isOverflowEdge(e.source, e.target) ? notes : hits;
      if (bucket.length > 0 && bucket[bucket.length - 1].startsWith(e.id)) break;
    }
  }
  return { hits, notes };
}
const clarityCases: Array<[string, WorkforceRuntime, ReadonlySet<string>]> = [
  ["main", runtime, agentsExpanded],
  ["ordered", orderedRt, orderedExpanded],
  ["five-colonies", fiveRt, fiveExpanded],
  ["ten-agents", tenAgentsRt, tenExpanded],
];
/** Solo-colony wraparounds: 12 agents segment the bar, 13 go continuous, 40
 *  stress the chunks — all three wrap past 2400px, so overflow-row edges are
 *  reported under the tightened exception while first-row edges stay strict. */
const soloWrapRt = (n: number, tag: string): WorkforceRuntime => ({
  ...runtime,
  colonies: [
    { id: "col-solo", name: "Solo", status: "ACTIVE", agentIds: [], timestamps: { createdAt: now, updatedAt: now } },
  ],
  agents: Array.from({ length: n }, (_, i) => ({
    ...runtime.agents[0],
    id: `${tag}-${i}`,
    name: `Solo ${i}`,
    colonyId: "col-solo",
    parentId: undefined,
    runtimeState: "idle" as const,
    createdAt: new Date(now.getTime() + i * 1000),
    updatedAt: now,
  })),
  tasks: [],
});
clarityCases.push(
  ["twelve-agents", soloWrapRt(12, "solo12"), new Set(["col-solo"])],
  ["thirteen-agents", soloWrapRt(13, "solo13"), new Set(["col-solo"])],
  ["forty-agents", soloWrapRt(40, "solo40"), new Set(["col-solo"])],
);
for (const [label, rt, expanded] of clarityCases) {
  const layout = tidyFull(rt);
  const edges = getTopologyEdges(rt, expanded);
  const { hits, notes } = edgeClarityViolations(placedFromLayout(layout), edges);
  check(`edges: no line passes through a foreign node (${label})`, hits.length === 0, hits.join(" | ") || `${edges.length} edges clear`);
  if (notes.length > 0) {
    console.log(`note: wrapped-source crossings (${label}): ${notes.join(" | ")}`);
  }
}

/* ── Fan-out: sibling colony curves share one handle but never share pixels.
 * Sample the first 30px of each fanned brain→colony curve and require every
 * pair to stay more than 2px apart (1px strokes + antialiasing). */
check(
  "edges: fanned colony curves separate at the shared handle",
  (() => {
    const rt = orderedRt;
    const expanded = orderedExpanded;
    const layout = tidyFull(rt);
    const placed = placedFromLayout(layout);
    const boxes = new Map<string, GBox>();
    for (const p of placed) {
      const w = CARD_W[p.type] ?? 0;
      const h = CARD_H[p.type] ?? 0;
      boxes.set(p.id, { x0: p.x - w / 2, y0: p.y, x1: p.x + w / 2, y1: p.y + h });
    }
    const edges = getTopologyEdges(rt, expanded).filter((e) => e.id.startsWith("owns:brain-spec-"));
    if (edges.length < 2) return false;
    const runs: Array<Array<[number, number]>> = edges.map((e) => {
      const sb = boxes.get(e.source)!;
      const tb = boxes.get(e.target)!;
      const sx = (sb.x0 + sb.x1) / 2;
      const sy = sb.y1;
      const tx = (tb.x0 + tb.x1) / 2;
      const ty = tb.y0;
      const fanDx = (e.data as { fanDx?: number } | undefined)?.fanDx ?? 0;
      const nums = (edgePathD(sx, sy, tx, ty, fanDx).match(/-?\d*\.?\d+/g) ?? []).map(Number);
      const pts: Array<[number, number]> = [];
      for (let i = 0; i < 40; i += 1) {
        const [px, py] = cubicAt(
          [nums[0], nums[1]],
          [nums[2], nums[3]],
          [nums[4], nums[5]],
          [nums[6], nums[7]],
          i / 39
        );
        if (Math.hypot(px - sx, py - sy) <= 30) pts.push([px, py]);
      }
      return pts;
    });
    let minGap = Infinity;
    for (let a = 0; a < runs.length; a += 1) {
      for (let b = a + 1; b < runs.length; b += 1) {
        for (const pa of runs[a]) {
          for (const pb of runs[b]) {
            /* The shared handle point itself always coincides; separation is
             * measured past it. */
            if (Math.hypot(pa[0] - pb[0], pa[1] - pb[1]) < 0.01) continue;
            minGap = Math.min(minGap, Math.hypot(pa[0] - pb[0], pa[1] - pb[1]));
          }
        }
      }
    }
    return minGap > 2;
  })(),
  "sibling curves stay >2px apart for the first 30px"
);

// ── Flash placement: without a DOM (SSR / tests) falls back to owner +116 ──
const flashNodes = getTopologyNodes(runtime, agentsExpanded, undefined, {
  flashes: [
    { id: "flash:f1", entityId: "ag-1", label: "done", kind: "success", occurredAt: Date.now() },
  ],
});
const flashNode = flashNodes.find((n) => n.id === "flash:f1");
const flashOwnerY = flashNodes.find((n) => n.id === "ag-1")?.position.y ?? 0;
check(
  "flash: no-DOM fallback = owner y + 116",
  flashNode?.position.y === flashOwnerY + 116,
  `flashY=${flashNode?.position.y} ownerY=${flashOwnerY}`
);

// ── Brain expand-all contract: label and click must share ONE definition ──
// The P1 bug: the card label used "all territories expanded" while the click
// used "territories AND every live worker's :sub/:ops". With territories open
// but some worker dims closed, the label said "Collapse all" but the click
// expanded. The page now passes its single strict `allExpanded` down, so the
// node must honour that value instead of recomputing a looser one.
const brainAllExpandedOf = (nodes: typeof deepNodes) =>
  (nodes.find((n) => n.id === BRAIN_NODE_ID)?.data as Record<string, unknown> | undefined)?.allExpanded;

// Fallback (opt omitted) keeps the territories-only reading.
check(
  "expand-all: fallback = all territories expanded",
  brainAllExpandedOf(getTopologyNodes(runtime, territoriesOnly)) === true
);
check(
  "expand-all: fallback false when a territory is closed",
  brainAllExpandedOf(getTopologyNodes(runtime, collapsed)) === false
);
// The decisive case: territories all open, worker dims NOT all open. The
// fallback would say true here; the page's strict value (false) must win.
const strictBrain = getTopologyNodes(runtime, territoriesOnly, undefined, { allExpanded: false });
check(
  "expand-all: page value overrides looser fallback (P1)",
  brainAllExpandedOf(strictBrain) === false,
  `got=${brainAllExpandedOf(strictBrain)} want=false`
);
check(
  "expand-all: page value true is honoured",
  brainAllExpandedOf(getTopologyNodes(runtime, agentsExpanded, undefined, { allExpanded: true })) === true
);

// ── Focus: dim unrelated, keep the tree ──
const focusNodes = getTopologyNodes(runtime, agentsExpanded, "ag-1");
const focusedAgent = focusNodes.find((n) => n.id === "ag-1");
const subAgent = focusNodes.find((n) => n.id === "ag-4");
const dimmedAnalyst = focusNodes.find((n) => n.id === "ag-2");
const dimmedBetaColony = focusNodes.find((n) => n.id === "col-b");
const alphaColony = focusNodes.find((n) => n.id === "col-a");
const focusedOp = focusNodes.find((n) => n.id === "t5");
const dimmedOp = focusNodes.find((n) => n.id === "t4");
check("focus: focused agent not dimmed", focusedAgent?.style === undefined, JSON.stringify(focusedAgent?.style));
check("focus: sub-agent kept", subAgent?.style === undefined, JSON.stringify(subAgent?.style));
check("focus: unrelated analyst dimmed", dimmedAnalyst?.style !== undefined && (dimmedAnalyst.style as { opacity?: number }).opacity !== undefined && (dimmedAnalyst.style as { opacity?: number }).opacity === 0.2, JSON.stringify(dimmedAnalyst?.style));
check("focus: other territory dimmed", dimmedBetaColony?.style !== undefined, JSON.stringify(dimmedBetaColony?.style));
check("focus: own territory not dimmed", alphaColony?.style === undefined, JSON.stringify(alphaColony?.style));
check("focus: sub's op not dimmed", focusedOp?.style === undefined, JSON.stringify(focusedOp?.style));
check("focus: analyst's op dimmed", dimmedOp?.style !== undefined, JSON.stringify(dimmedOp?.style));

// ── Edges: temp edges animated, ownership thin, tinted by child level ──
const edgesDeep = getTopologyEdges(runtime, agentsExpanded, undefined, {
  tempEdges: [
    { id: "temp:delegation:e1", kind: "delegation", source: "ag-1", target: "ag-3", taskId: "t1", eventId: "e1", label: "Delegated", occurredAt: Date.now() },
    { id: "temp:verification:v1", kind: "verification", source: "ag-1", target: "t4", taskId: "t4", eventId: "v1", label: "Verifying", occurredAt: Date.now() },
    { id: "temp:delegation:dup", kind: "delegation", source: "ag-1", target: "t1", taskId: "t1", eventId: "dup", label: "Dup", occurredAt: Date.now() },
  ],
});
const tempAnimated = edgesDeep.filter((e) => e.animated === true);
check("edges: temp edges animated", tempAnimated.length === 2, `animated=${tempAnimated.length}`);
check(
  "edges: a live link duplicating an ownership pair is suppressed",
  !edgesDeep.some((e) => e.id === "temp:delegation:dup"),
  "structural line already draws ag-1→t1"
);
const tempStyleOf = (kind: string) => {
  const e = edgesDeep.find((x) => (x.data as { kind?: string } | undefined)?.kind === kind);
  return (e?.style ?? {}) as { stroke?: string; strokeWidth?: number; strokeDasharray?: string };
};
check(
  "edges: delegation keeps its color with a dash flow",
  tempStyleOf("delegation").stroke === "hsl(var(--info))" &&
    tempStyleOf("delegation").strokeDasharray === "6 4",
  JSON.stringify(tempStyleOf("delegation"))
);
check(
  "edges: verification goes neutral with its own dotted pattern",
  tempStyleOf("verification").stroke === VERIFICATION_EDGE_STROKE &&
    typeof tempStyleOf("verification").strokeDasharray === "string",
  JSON.stringify(tempStyleOf("verification"))
);
check("edges: ownership edges present", edgesDeep.some((e) => e.source === BRAIN_NODE_ID));
const ownershipStrokes = edgesDeep
  .filter((e) => e.id.startsWith("owns:"))
  .map((e) => (e.style as { stroke?: string } | undefined)?.stroke ?? "");
const neutralPrefix = "color-mix(in oklab, hsl(var(--card))";
check("edges: ownership neutral (no level tint)", ownershipStrokes.every((s) => s.startsWith(neutralPrefix)), ownershipStrokes.join("|"));
check(
  "edges: ownership strokes use the shared structural constant",
  ownershipStrokes.every((s) => s === STRUCTURAL_EDGE_STROKE),
  Array.from(new Set(ownershipStrokes)).join("|")
);
const ownershipEdges = edgesDeep.filter((e) => e.id.startsWith("owns:"));
check(
  "edges: ownership edges use the flow edge type",
  ownershipEdges.length > 0 && ownershipEdges.every((e) => e.type === "topology-flow"),
  Array.from(new Set(ownershipEdges.map((e) => e.type))).join(",")
);
const ownershipWidths = ownershipEdges.map(
  (e) => (e.style as { strokeWidth?: number } | undefined)?.strokeWidth
);
check(
  "edges: ownership strokes are 1px",
  ownershipWidths.every((w) => w === 1),
  ownershipWidths.join(",")
);
check(
  "edges: ownership edges carry a dimmed flag to fade the stroke",
  ownershipEdges.every((e) => typeof (e.data as { dimmed?: boolean } | undefined)?.dimmed === "boolean"),
  ownershipEdges.map((e) => String((e.data as { dimmed?: boolean } | undefined)?.dimmed)).join(",")
);
check(
  "edges: ownership edges carry no source-level tint key",
  ownershipEdges.every((e) => (e.data as { sourceKind?: string } | undefined)?.sourceKind === undefined),
  `${ownershipEdges.length} ownership edges`
);
check(
  "edges: structural track plus one short accent traffic dot, no source tint",
  (() => {
    const src = readFileSync(join(process.cwd(), "src", "components", "topology", "topology-edge.tsx"), "utf8");
    const paths = (src.match(/<path\b/g) ?? []).length;
    return (
      /* exactly two paths: the neutral track and the traffic dot */
      paths === 2 &&
      !src.includes("SOURCE_STROKE") &&
      !src.includes("topology-edge-flow") &&
      src.includes("STRUCTURAL_EDGE_STROKE") &&
      /* the dot is the reference's flow-dot: a 3-unit dash out of 223 marching
         once per 2.6s, in the theme accent */
      src.includes('strokeDasharray="3 220"') &&
      src.includes("t-traffic 2.6s linear infinite") &&
      /* and it never paints a dimmed edge, so focus still reads as one line */
      src.includes("{!dimmed && (")
    );
  })(),
  "topology-edge.tsx"
);
const focusedOwnership = getTopologyEdges(runtime, agentsExpanded, "ag-1").filter((e) =>
  e.id.startsWith("owns:")
);
check(
  "edges: focus dims unrelated ownership links in data, never in style",
  focusedOwnership.some((e) => (e.data as { dimmed?: boolean }).dimmed === true) &&
    focusedOwnership.some((e) => (e.data as { dimmed?: boolean }).dimmed === false) &&
    focusedOwnership.every((e) => (e.style as { opacity?: number } | undefined)?.opacity === undefined),
  `dimmed=${focusedOwnership.filter((e) => (e.data as { dimmed?: boolean }).dimmed).length} of ${focusedOwnership.length}`
);
const edgesOverview = getTopologyEdges(runtime, collapsed, undefined, {
  tempEdges: [{ id: "temp:delegation:e1", kind: "delegation", source: "ag-1", target: "ag-4", eventId: "e1", occurredAt: Date.now() }],
});
check("edges: temp edges withheld while endpoints collapsed", !edgesOverview.some((e) => e.animated));

/* ── Edge handles: an edge may only name a handle its endpoint actually has.
 *
 * Naming a missing handle does not throw here — React Flow logs it in the
 * browser and anchors the edge at the node centre instead, so the bug shows up
 * as console noise in dev and a slightly wrong curve in production, and every
 * other check in this file still passes. The inventory below is the contract
 * the node components render; `flash` deliberately has none, which is what
 * keeps it out of the graph's edge set. */
const HANDLE_INVENTORY: Record<string, { source: Set<string>; target: Set<string> }> = {
  brain: { source: new Set([HANDLE_IDS.out, HANDLE_IDS.outLeft, HANDLE_IDS.outRight]), target: new Set() },
  specialist: {
    source: new Set([HANDLE_IDS.out, HANDLE_IDS.outLeft, HANDLE_IDS.outRight]),
    target: new Set([HANDLE_IDS.in, HANDLE_IDS.inLeft, HANDLE_IDS.inRight]),
  },
  agent: {
    source: new Set([HANDLE_IDS.out, HANDLE_IDS.outLeft, HANDLE_IDS.outRight]),
    target: new Set([HANDLE_IDS.in, HANDLE_IDS.inLeft, HANDLE_IDS.inRight]),
  },
  /* subagent renders AgentShell, so it has the same handles as an agent */
  subagent: {
    source: new Set([HANDLE_IDS.out, HANDLE_IDS.outLeft, HANDLE_IDS.outRight]),
    target: new Set([HANDLE_IDS.in, HANDLE_IDS.inLeft, HANDLE_IDS.inRight]),
  },
  operation: { source: new Set(), target: new Set([HANDLE_IDS.in, HANDLE_IDS.inLeft, HANDLE_IDS.inRight]) },
  flash: { source: new Set(), target: new Set() },
};
check(
  "edges: every edge names handles both of its endpoints actually render",
  (() => {
    const nodeType = new Map<string, string>(
      getTopologyNodes(runtime, agentsExpanded).map((n) => [n.id as string, n.type as string])
    );
    return [...edgesDeep, ...edgesOverview].every((e) => {
      const src = HANDLE_INVENTORY[nodeType.get(e.source) ?? ""];
      const tgt = HANDLE_INVENTORY[nodeType.get(e.target) ?? ""];
      if (!src || !tgt) return false;
      return (
        (e.sourceHandle == null || src.source.has(e.sourceHandle)) &&
        (e.targetHandle == null || tgt.target.has(e.targetHandle))
      );
    });
  })(),
  [...edgesDeep, ...edgesOverview]
    .map((e) => `${e.id}:${e.source ?? "?"}->${e.target ?? "?"} ${e.sourceHandle ?? "-"}/${e.targetHandle ?? "-"}`)
    .join(" ")
);
/* A territory is *below* the brain, so its edge has to leave the bottom and
 * arrive at the top. It is a wide step — hundreds of pixels across and only a
 * gap down — so this is the one edge where "which way is it pointing" and
 * "which way is it mostly offset" disagree, and the downward reading is the one
 * that matches the hierarchy. */
const spokeHandles = edgesDeep
  .filter((e) => e.source === BRAIN_NODE_ID)
  .map((e) => e.sourceHandle);
check(
  "edges: brain spokes leave the bottom and enter the territory's top",
  spokeHandles.length > 0 &&
    spokeHandles.every((h) => h === HANDLE_IDS.out) &&
    edgesDeep
      .filter((e) => e.source === BRAIN_NODE_ID)
      .every((e) => e.targetHandle === HANDLE_IDS.in),
  spokeHandles.join(",")
);
/* An operation is directly beneath its owner, so its edge is vertical. If this
 * ever picks a lateral handle, the eye is told the operation belongs to a
 * neighbour — which is the one misreading the whole layout exists to remove. */
const opHandles = edgesDeep
  .filter((e) => e.target === "t1" || e.target === "t4" || e.target === "t5")
  .map((e) => `${e.sourceHandle}/${e.targetHandle}`);
check(
  "edges: an operation under its owner uses the vertical handle pair",
  opHandles.length > 0 && opHandles.every((h) => h === `${HANDLE_IDS.out}/${HANDLE_IDS.in}`),
  opHandles.join(" ")
);
/* Transient edges pick handles the same way ownership edges do. They used to
 * name no handles at all, which meant a delegation that crossed the graph left
 * the *top* of its sender, looped over the top of the receiver and came down —
 * a shape that reads as a parent→child relationship the event never claimed. */
const tempDeep = getTopologyEdges(runtime, agentsExpanded, undefined, {
  tempEdges: [
    { id: "d1", kind: "delegation", source: "ag-1", target: "ag-3", eventId: "e1", label: "Delegated", occurredAt: Date.now() },
    { id: "v1", kind: "verification", source: "ag-1", target: "t4", eventId: "e2", label: "Verifying", occurredAt: Date.now() },
  ],
});
const cross = tempDeep.find((e) => e.id === "temp:d1");
const verifying = tempDeep.find((e) => e.id === "temp:v1");
check(
  "edges: a transient edge crossing to the far side leaves sideways",
  cross !== undefined &&
    cross.sourceHandle === HANDLE_IDS.outRight &&
    cross.targetHandle === HANDLE_IDS.inLeft,
  `${cross?.sourceHandle ?? "-"}/${cross?.targetHandle ?? "-"}`
);
check(
  "edges: a transient edge onto its own operation enters from the top",
  verifying !== undefined &&
    verifying.sourceHandle === HANDLE_IDS.out &&
    verifying.targetHandle === HANDLE_IDS.in,
  `${verifying?.sourceHandle ?? "-"}/${verifying?.targetHandle ?? "-"}`
);
check(
  "edges: a transient edge never changes what the graph claims to be",
  tempDeep.filter((e) => e.id.startsWith("temp:")).every((e) => e.animated === true && e.data?.kind !== undefined),
  tempDeep.map((e) => `${e.id}:${e.animated}:${String(e.data?.kind)}`).join(" ")
);

// ── Brain health derivation (§14: aggregate, not node-propagation) ──
const states = (list: string[]): InstanceType<typeof Array> => list;
const withStates = (...runtimeState: string[]) =>
  runtimeState.map((state, i) => ({
    id: `a${i}`,
    name: `A${i}`,
    type: "WORKER" as const,
    colonyId: "col-a",
    runtimeState: state as string,
    models: [],
    capabilities: [],
    tools: [],
    permissions: [],
    successRate: 90,
    avgDuration: 1,
    totalCost: 1,
    createdAt: now,
    updatedAt: now,
  }));
const mind = (agents: ReturnType<typeof withStates>) =>
  computeBrainRuntime(agents as never, runtime.colonies as never, [] as never, [] as never).state;
check("brain: single failed agent does not degrade (§14)", mind(withStates("executing", "executing", "failed", "idle")) === "working", String(mind(withStates("executing", "executing", "failed", "idle"))));
check("brain: one third attention → degraded", mind(withStates("executing", "blocked", "idle")) === "degraded", String(mind(withStates("executing", "blocked", "idle"))));
check("brain: nothing active but blocked → critical", mind(withStates("waiting", "blocked")) === "critical", String(mind(withStates("waiting", "blocked"))));
check("brain: quiet and healthy → operational", mind(withStates("idle", "idle")) === "operational", String(mind(withStates("idle", "idle"))));
check("brain: no agents → offline", mind([]) === "offline", String(mind([])));
check("system: counts pass through", (() => {
  const s = computeSystemRuntime({ providers: 3, models: 4, mcps: 1, memories: 2 } as never);
  return (s as { providerCount: number }).providerCount === 3 && (s as { modelCount: number }).modelCount === 4 && (s as { mcpCount: number }).mcpCount === 1 && (s as { memoryCount: number }).memoryCount === 2;
})());

void states;

// ── Store: transient events ──
const s = useRuntimeStore;
const madeEvents: Array<{ types: string }> = [];
void madeEvents;

let fresh = true;
function freshRuntime(): WorkforceRuntime {
  void fresh;
  return JSON.parse(JSON.stringify(runtime, (k, v) => (k === "generatedAt" ? new Date() : v))) as WorkforceRuntime;
}

s.getState().initializeWithSnapshot(freshRuntime());
const storeBefore = s.getState();

// delegation start → temp edge; duplicate idempotent
const t0 = new Date();
const t1 = new Date(t0.getTime() + 1000);
s.getState().applyEvents([
  { id: "ev-delegation", type: "delegation.started", timestamp: t1, source: "topology", agentId: "ag-1", taskId: "t1", payload: { from: "ag-1", to: "ag-4", label: "Scoped review" } },
]);
check("store: delegation adds temp edge", s.getState().tempEdges.length === 1 && s.getState().tempEdges[0].kind === "delegation", JSON.stringify(s.getState().tempEdges));
s.getState().applyEvents([
  { id: "ev-delegation", type: "delegation.started", timestamp: t1, source: "topology", agentId: "ag-1", taskId: "t1", payload: { from: "ag-1", to: "ag-4", label: "Scoped review" } },
]);
check("store: duplicate event idempotent (still 1 edge)", s.getState().tempEdges.length === 1, String(s.getState().tempEdges.length));

// delegation complete removes it
s.getState().applyEvents([
  { id: "ev-delegation-done", type: "delegation.completed", timestamp: t1, source: "topology", agentId: "ag-1", taskId: "t1", payload: { from: "ag-1", to: "ag-4" } },
]);
check("store: delegation completion removes edge", s.getState().tempEdges.length === 0, String(s.getState().tempEdges.length));

// verification start/pass round trip
s.getState().applyEvents([
  { id: "ev-verif", type: "verification.started", timestamp: t1, source: "topology", agentId: "ag-1", taskId: "t1", payload: { from: "ag-1" } },
]);
check("store: verification adds temp edge", s.getState().tempEdges.some((e) => e.kind === "verification"), JSON.stringify(s.getState().tempEdges));
s.getState().applyEvents([
  { id: "ev-verif-pass", type: "verification.passed", timestamp: t1, source: "topology", agentId: "ag-1", taskId: "t1", payload: {} },
]);
check("store: verification pass removes edge", !s.getState().tempEdges.some((e) => e.kind === "verification"), String(s.getState().tempEdges.length));

// operation completion → flash + task completed
const taskState = s.getState().runtime?.tasks.find((x) => x.id === "t1");
check("store: t1 running before completion", taskState?.status === "RUNNING", String(taskState?.status));
s.getState().applyEvents([
  { id: "ev-complete", type: "task.completed", timestamp: t1, source: "workflow", taskId: "t1", missionId: "m1", agentId: "ag-1", payload: { output: "ok" } },
]);
const completedTask = s.getState().runtime?.tasks.find((x) => x.id === "t1");
check("store: completed task flips status", completedTask?.status === "COMPLETED", String(completedTask?.status));
check("store: completion flash registered at owner", s.getState().flashes.some((f) => f.entityId === "ag-1" && f.kind === "success"), JSON.stringify(s.getState().flashes));

// stale guard: an old agent event must not overwrite newer state
s.getState().applyEvents([
  { id: "ev-state-new", type: "agent.thinking", timestamp: t1, source: "runtime", agentId: "ag-2", payload: { to: "thinking" } },
]);
const ag2AfterNew = s.getState().runtime?.agents.find((a) => a.id === "ag-2");
check("store: agent updated to thinking", ag2AfterNew?.runtimeState === "thinking", String(ag2AfterNew?.runtimeState));
s.getState().applyEvents([
  { id: "ev-state-stale", type: "agent.executing", timestamp: t0, source: "runtime", agentId: "ag-2", payload: { to: "executing" } },
]);
const ag2AfterStale = s.getState().runtime?.agents.find((a) => a.id === "ag-2");
check("store: stale event skipped (keeps thinking)", ag2AfterStale?.runtimeState === "thinking", String(ag2AfterStale?.runtimeState));

// brain.state.changed override
s.getState().applyEvents([
  { id: "ev-brain", type: "brain.state.changed", timestamp: t1, source: "runtime", payload: { to: "degraded" } },
]);
check("store: brain.state.changed applies", s.getState().runtime?.brain.state === "degraded", String(s.getState().runtime?.brain.state));

void storeBefore;
void freshRuntime;

// ── Fixed distances ─────────────────────────────────────────────────────────
// Distances never adapt to the size of the graph: neighbours sit exactly one
// sibling gap apart and bands exactly one level gap apart, from two nodes to
// two hundred. What grows is the tree's extent, never its air. These guard
// the constants and the sized fixtures below that the sweep checks use.

/** A runtime of a given size, grown from the fixture so the shape is real
 *  (agents actually parented into sub-agents, tasks actually owned).
 *
 *  `colonyCount` > 1 spreads the roots round-robin across real territory
 *  columns, which is the only way to exercise the multi-colony path: the
 *  territoryGap between columns, and the widest-row width that decides it. */
const sizedRuntime = (
  rootAgents: number,
  subPerRoot: number,
  opsPerAgent: number,
  colonyCount = 1
): WorkforceRuntime => {
  const colonies = runtime.colonies
    .slice(0, colonyCount)
    .map((c) => ({ ...c, agentIds: [] as string[] }));
  const agents: WorkforceRuntime["agents"] = [];
  const tasks: WorkforceRuntime["tasks"] = [];
  for (let i = 0; i < rootAgents; i += 1) {
    const rootId = `r${i}`;
    const colony = colonies[i % colonies.length];
    agents.push({
      ...runtime.agents[0],
      id: rootId,
      name: `Root ${i}`,
      parentId: undefined,
      colonyId: colony.id,
      runtimeState: "idle",
    });
    colony.agentIds.push(rootId);
    for (let s = 0; s < subPerRoot; s += 1) {
      agents.push({
        ...runtime.agents[3],
        id: `${rootId}-s${s}`,
        name: `Sub ${i}.${s}`,
        parentId: rootId,
        colonyId: colony.id,
        runtimeState: "idle",
      });
    }
    for (let o = 0; o < opsPerAgent; o += 1) {
      tasks.push({
        ...runtime.tasks[0],
        id: `${rootId}-t${o}`,
        description: `task ${i}.${o}`,
        status: "RUNNING",
        ownerAgentId: rootId,
      });
    }
  }
  return { ...runtime, colonies, agents, tasks };
};

check(
  "spacing: distances are fixed constants, never adaptive tiers",
  TIDY_SIBLING_GAP === 32 && TIDY_LEVEL_GAP === 72 && TIDY_MAX_ROW_WIDTH === 2400,
  `sibling=${TIDY_SIBLING_GAP} level=${TIDY_LEVEL_GAP} maxRow=${TIDY_MAX_ROW_WIDTH}`
);

/** No graph, however large, may overlap — fixed distances leave nothing to
 *  tune into a failure. One layout per fixture: there are no tiers or modes. */
const allOverlappingSteps = (label: string, rt: WorkforceRuntime): string[] => {
  const layout = tidyFull(rt);
  return collisionsIn(placedFromLayout(layout)).map((hit) => `${label}: ${hit}`);
};

const smallRt = sizedRuntime(2, 1, 1);
const midRt = sizedRuntime(5, 1, 1);
const largeRt = sizedRuntime(14, 2, 2);
const deepRt = sizedRuntime(3, 1, 6);
/* Two territory columns is a different layout problem, not a bigger version of
 * the same one: columns are balanced by width and then separated by
 * territoryGap, and neither the widest-row trigger nor that separation is
 * reached by a single-colony fixture. */
const twoColonyRt = sizedRuntime(12, 2, 2, 2);
const tierCases: Array<[string, WorkforceRuntime]> = [
  ["small", smallRt],
  ["medium", midRt],
  ["large", largeRt],
  ["deep", deepRt],
  ["two-colony", twoColonyRt],
];
const tierOverlaps = tierCases.flatMap(([label, rt]) => allOverlappingSteps(label, rt));
check("spacing: no overlap at any size", tierOverlaps.length === 0, tierOverlaps.join(" | "));

/* ── The tree has to hold for every territory count, not just the two the other
 *  fixtures happen to build.
 *
 *  What makes a multi-territory graph hard is not the count, it is the
 *  inequality: one busy territory and one nearly empty one share a row, so the
 *  busy block is much wider than its neighbour and the row has to grow to hold
 *  it. Even sizes hide that entirely, so the sweep makes each territory a
 *  different size on purpose, and goes past four so the wrap is in the sweep
 *  too. */
const treeRuntime = (territories: Array<[roots: number, subs: number]>): WorkforceRuntime => {
  const colonies: WorkforceRuntime["colonies"] = [];
  const agents: WorkforceRuntime["agents"] = [];
  const tasks: WorkforceRuntime["tasks"] = [];
  territories.forEach(([roots, subs], ci) => {
    const id = `t${ci}`;
    colonies.push({ id, name: `Tree ${ci}`, status: "ACTIVE", agentIds: [], timestamps: runtime.colonies[0].timestamps });
    for (let i = 0; i < roots; i += 1) {
      const rootId = `t${ci}-r${i}`;
      agents.push({ ...runtime.agents[0], id: rootId, name: rootId, parentId: undefined, colonyId: id, runtimeState: "idle" });
      colonies[ci].agentIds.push(rootId);
      for (let s = 0; s < subs; s += 1) {
        agents.push({ ...runtime.agents[3], id: `${rootId}s${s}`, name: `${rootId}s${s}`, parentId: rootId, colonyId: id, runtimeState: "idle" });
      }
      tasks.push({ ...runtime.tasks[0], id: `${rootId}-t`, description: "op", ownerAgentId: rootId, status: "RUNNING" });
    }
  });
  return { ...runtime, colonies, agents, tasks };
};
/* Uneven on purpose: the widest block is first, so it is the one that has to
 * widen the row rather than sitting comfortably inside it. */
const treeCases: Array<[string, WorkforceRuntime]> = [
  ["2 uneven", treeRuntime([[7, 2], [1, 0]])],
  ["3 uneven", treeRuntime([[6, 2], [1, 0], [3, 1]])],
  ["4 uneven", treeRuntime([[5, 1], [1, 0], [3, 0], [2, 1]])],
  ["5 uneven", treeRuntime([[4, 1], [1, 0], [3, 0], [2, 0], [1, 1]])],
  ["6 uneven", treeRuntime([[4, 1], [1, 0], [2, 0], [3, 0], [1, 1], [2, 1]])],
  ["7 uneven", treeRuntime([[3, 1], [1, 0], [2, 0], [2, 0], [1, 0], [2, 1], [1, 0]])],
  ["8 uneven", treeRuntime([[3, 0], [1, 0], [2, 0], [2, 0], [1, 0], [2, 0], [1, 0], [2, 1]])],
];
const treeOverlaps = treeCases.flatMap(([label, rt]) => allOverlappingSteps(label, rt));
check("tree: no card ever overlaps another, at any territory count", treeOverlaps.length === 0, treeOverlaps.join(" | "));
/* The brain is the top of the hierarchy, so a block reaching above it — or onto
 * it — is the failure the layout exists to prevent, and uneven blocks are the
 * ones most likely to cause it. Asserted as the topmost-card property rather
 * than only as a collision, because a card placed *above* the brain without
 * touching it is the same mistake wearing a different hat. */
check(
  "tree: the brain stays the top of the graph at every territory count",
  treeCases.every(([, rt]) => {
    const placed = placedFromLayout(tidyFull(rt));
    const brain = placed.find((p) => p.type === "brain")!;
    return (
      placed.every((p) => p.id === "brain" || !overlaps(brain, p)) &&
      /* The brain is not below itself, so it is excluded from its own
       * "everything else hangs beneath me" clause. */
      placed.every((p) => p.id === "brain" || p.y >= brain.y + CARD_H.brain) &&
      Math.min(...placed.map((p) => p.y)) === brain.y
    );
  }),
  treeCases
    .map(([label, rt]) => {
      const placed = placedFromLayout(tidyFull(rt));
      const brain = placed.find((p) => p.type === "brain")!;
      const hits = placed
        .filter((p) => p.id !== "brain" && (overlaps(brain, p) || p.y < brain.y + CARD_H.brain))
        .map((p) => p.id);
      return hits.length ? `${label}: ${hits.join(",")}` : "";
    })
    .filter(Boolean)
    .join(" | ")
);

/* Two territories share one row with exactly one sibling gap between their
 * cards — at every size, because there are no sizes anymore. Uneven subtrees
 * widen the row, never the gap. */
check(
  "spacing: two territories share one row exactly one gap apart",
  (() => {
    const layout = tidyFull(sizedRuntime(0, 0, 0, 2));
    if (layout.territories.size !== 2) return false;
    const [a, b] = Array.from(layout.territories.values());
    const dx = Math.abs(b.x - a.x);
    const dy = Math.abs(b.y - a.y);
    // Same row, opposite sides of the origin, cards exactly one gap apart.
    if (dy > 1e-6) return false;
    if (Math.sign(a.x) !== -Math.sign(b.x)) return false;
    return Math.abs(dx - (CARD_W.specialist + TIDY_SIBLING_GAP)) < 1e-6;
  })(),
  (() => {
    const l = tidyFull(sizedRuntime(0, 0, 0, 2));
    const [a, b] = Array.from(l.territories.values());
    return `dx=${Math.abs(b.x - a.x).toFixed(0)} dy=${Math.abs(b.y - a.y).toFixed(0)}`;
  })()
);

/* Fixed distances need no clamping: there is nothing hostile to pull back,
// because no input — viewport, override, or tier — can change a gap. */

/* Fixed distances end the fit-versus-spacing negotiation: there is no second
 * system to fight with. The camera fits what the tree measures; the tree never
 * measures the pane. What remains pinned here is the honest contract — a tiny
 * graph frames small, a huge graph frames at the floor and pans. */

/* A graph too big for the pane is the honest limit: the camera frames at the
 * floor and the user pans. Fixed distances mean the tree cannot tighten to
 * help, so what is pinned is that the floor holds and nothing overlaps. */
const tightVp = { w: 900, h: 620 };
const cramped = allOverlappingSteps("cramped", largeRt);
check("spacing: an enormous graph in a small pane still never overlaps", cramped.length === 0, cramped.join(" | "));
const tightZoom = fitZoomFor(layoutBounds(tidyFull(largeRt)), tightVp);
check(
  "camera: a pane too small for the graph clamps exactly at the floor",
  tightZoom === FIT_MIN_ZOOM,
  `zoom=${tightZoom.toFixed(3)} floor=${FIT_MIN_ZOOM}`
);

/* ── Camera ────────────────────────────────────────────────────────────────
 * The bug these guard: the pane changes size, the graph is re-laid out, and the
 * camera keeps the transform that framed the *old* pane. The graph then hangs
 * off the top of the screen while its middle still looks fine. Every check is
 * written as the question the canvas asks on a resize — "is the whole graph
 * still on screen?" — plus the narrow-mode flip that changes the graph most. */

const N_WIDE = 1440;
const N_TALL = 900;
const paneAt = (w: number, h: number) => ({ w, h });

/* Narrow mode: hysteresis means the two directions cross the breakpoint at
 * different widths. Without it, dragging a window edge sitting on 800px
 * re-stacks every colony on every other pixel. */
check(
  "camera: narrow mode does not flip back and forth on the breakpoint",
  (() => {
    const enterBelow = NARROW_BREAKPOINT - NARROW_HYSTERESIS;
    const leaveAt = NARROW_BREAKPOINT + NARROW_HYSTERESIS;
    return (
      narrowFor(NARROW_BREAKPOINT, false) === false &&
      narrowFor(enterBelow - 1, false) === true &&
      narrowFor(enterBelow, false) === false &&
      narrowFor(leaveAt, true) === false &&
      narrowFor(leaveAt - 1, true) === true
    );
  })(),
  `enters narrow below ${NARROW_BREAKPOINT - NARROW_HYSTERESIS}px, leaves at ${NARROW_BREAKPOINT + NARROW_HYSTERESIS}px`
);
check(
  "camera: a zero or unmeasured pane never changes the layout mode",
  narrowFor(0, false) === false && narrowFor(0, true) === true && narrowFor(NaN, true) === true,
  "SSR and pre-measure states keep the current mode"
);

/** Frame `cards` in `pane` and report whether the result actually contains the
 *  whole graph — the property the canvas depends on. */
const framed = (cards: PlacedCard[], pane: { w: number; h: number }, insets: Insets = NO_INSETS) => {
  const usable = {
    w: Math.max(1, pane.w - insets.left - insets.right),
    h: Math.max(1, pane.h - insets.top - insets.bottom),
  };
  const t = fitTransformFor(cards, usable);
  const viewport = { x: t.x + insets.left, y: t.y + insets.top, zoom: t.zoom };
  const box = boxOf(cards)!;
  const onScreen = {
    left: box.minX * t.zoom + viewport.x,
    right: box.maxX * t.zoom + viewport.x,
    top: box.minY * t.zoom + viewport.y,
    bottom: box.maxY * t.zoom + viewport.y,
  };
  return {
    fits: graphFitsIn(cards, viewport, usable, insets),
    onScreen,
    usable,
    insideFreeArea:
      onScreen.left >= insets.left - 1 &&
      onScreen.right <= insets.left + usable.w + 1 &&
      onScreen.top >= insets.top - 1 &&
      onScreen.bottom <= insets.top + usable.h + 1,
    centred:
      Math.abs((onScreen.left + onScreen.right) / 2 - (insets.left + usable.w / 2)) < 1.5 &&
      Math.abs((onScreen.top + onScreen.bottom) / 2 - (insets.top + usable.h / 2)) < 1.5,
  };
};

const midCards = layoutBounds(tidyFull(midRt));

check(
  "camera: framing a graph puts the whole graph on screen",
  (() => {
    const r = framed(midCards, paneAt(N_WIDE, N_TALL));
    return r.fits && r.insideFreeArea;
  })(),
  JSON.stringify(framed(midCards, paneAt(N_WIDE, N_TALL)).onScreen)
);

check(
  "camera: framing centres the graph in the pane",
  framed(midCards, paneAt(N_WIDE, N_TALL)).centred,
  JSON.stringify(framed(midCards, paneAt(N_WIDE, N_TALL)).onScreen)
);

/* The regression, stated as a before/after: the transform that framed the wide
 * pane is not valid for the narrower one, which is exactly why the camera is
 * recomputed rather than left alone. */
check(
  "camera: a transform from a wider pane is rejected on a narrower one",
  (() => {
    const widePane = paneAt(N_WIDE, N_TALL);
    const narrowPane = paneAt(1100, N_TALL);
    const stale = fitTransformFor(midCards, widePane);
    const stillValid = graphFitsIn(midCards, stale, narrowPane, NO_INSETS);
    const afterRefit = framed(midCards, narrowPane);
    return stillValid === false && afterRefit.fits && afterRefit.insideFreeArea;
  })(),
  "a stale transform is detected, and refitting restores the whole graph"
);

check(
  "camera: every pane in the test range frames the whole graph",
  [1280, 1440, 1920].every((w) => {
    for (const h of [700, 900]) {
      const r = framed(midCards, paneAt(w, h));
      if (!r.fits || !r.insideFreeArea) return false;
    }
    return true;
  }),
  "1280/1440/1920 x 700/900"
);

/* Past the zoom floor the graph is simply bigger than the pane — that is a
 * navigation limit, not something the camera can solve, and the honest promise
 * is weaker than "everything is visible": the graph stays centred, so the
 * overflow is shared by both edges instead of one side being pushed off
 * screen, and the zoom never drops below what the canvas can render. */
check(
  "camera: a graph larger than the pane stays centred at the zoom floor",
  (() => {
    const cards = layoutBounds(tidyFull(largeRt));
    return [1280, 1440, 1920].every((w) => {
      const pane = paneAt(w, 800);
      const r = framed(cards, pane);
      const zoom = fitTransformFor(cards, pane).zoom;
      if (!r.centred) return false;
      if (zoom < FIT_MIN_ZOOM - 1e-9) return false;
      return r.fits || zoom === FIT_MIN_ZOOM;
    });
  })(),
  "a graph past the floor frames its centre and holds the floor"
);

check(
  "camera: framing respects a measured overlay instead of the whole pane",
  (() => {
    const pane = paneAt(N_WIDE, N_TALL);
    const insets: Insets = { top: 0, right: 288, bottom: 0, left: 0 };
    const r = framed(midCards, pane, insets);
    if (!r.fits || !r.insideFreeArea) return false;
    /* The graph must be centred in what is left, so the covered edge is never
     * the one that clips. */
    return r.centred && r.onScreen.right <= pane.w - insets.right + 1;
  })(),
  JSON.stringify(framed(midCards, paneAt(N_WIDE, N_TALL), { top: 0, right: 288, bottom: 0, left: 0 }).onScreen)
);

check(
  "camera: a user's own zoom survives a change that does not clip the graph",
  (() => {
    const pane = paneAt(N_WIDE, N_TALL);
    const usable = { w: pane.w, h: pane.h };
    const t = fitTransformFor(midCards, usable);
    /* Zoomed out to half the fit zoom, the whole graph is still on screen, so a
     * pane that grew has no reason to take the camera away from the user. */
    const usersChoice = { x: t.x, y: t.y, zoom: t.zoom * 0.5 };
    const stillFits = graphFitsIn(midCards, usersChoice, usable, NO_INSETS);
    return stillFits === true;
  })(),
  "zoomed-out view is left alone"
);

check(
  "camera: a transform that leaves the graph off screen is rejected",
  (() => {
    const pane = paneAt(N_WIDE, N_TALL);
    const usable = { w: pane.w, h: pane.h };
    const box = boxOf(midCards)!;
    // The pre-fix failure mode: the graph's centre sits above the top edge.
    const pushedUp = { x: pane.w / 2 - ((box.minX + box.maxX) / 2) * 0.6, y: -box.maxY * 0.6 - 40, zoom: 0.6 };
    return graphFitsIn(midCards, pushedUp, usable, NO_INSETS) === false;
  })(),
  "an off-screen graph is detected as needing a refit"
);

/* The fit zoom the camera uses is computed from the same fixed graph the tree
 * lays out — one number, one answer, no spacing rule to agree with. */

check(
  "camera: the graph box is the union of the measured cards",
  (() => {
    const box = boxOf(midCards)!;
    const manual = {
      minX: Math.min(...midCards.map((c) => c.x - c.w / 2)),
      maxX: Math.max(...midCards.map((c) => c.x + c.w / 2)),
      minY: Math.min(...midCards.map((c) => c.y)),
      maxY: Math.max(...midCards.map((c) => c.y + c.h)),
    };
    return (
      box.minX === manual.minX &&
      box.maxX === manual.maxX &&
      box.minY === manual.minY &&
      box.maxY === manual.maxY &&
      box.w === manual.maxX - manual.minX &&
      box.h === manual.maxY - manual.minY
    );
  })(),
  `cards=${midCards.length}`
);

check(
  "camera: an empty graph is framed nowhere rather than at a bogus zoom",
  fitTransformFor([], paneAt(N_WIDE, N_TALL)).zoom === FIT_MAX_ZOOM &&
    graphFitsIn([], { x: 0, y: 0, zoom: 1 }, paneAt(N_WIDE, N_TALL), NO_INSETS) === false,
  "no cards, no claim of being framed"
);

/** Frame `cards` with the top-aligned camera and report where the graph lands. */
const topAligned = (cards: PlacedCard[], pane: { w: number; h: number }) => {
  const usable = { w: pane.w, h: pane.h };
  const t = fitTopAlignedTransformFor(cards, usable);
  const box = boxOf(cards)!;
  return {
    usable,
    headroom: fitTopHeadroom(usable),
    zoom: t.zoom,
    top: box.minY * t.zoom + t.y,
    bottom: box.maxY * t.zoom + t.y,
    left: box.minX * t.zoom + t.x,
    right: box.maxX * t.zoom + t.x,
  };
};

const topAlignedPanes = [paneAt(1280, 700), paneAt(1440, 900), paneAt(1920, 900)];

check(
  "camera: top-aligned framing never zooms further out than the centred fit needs",
  topAlignedPanes.every(
    (pane) => fitTopAlignedTransformFor(midCards, pane).zoom <= fitZoomFor(midCards, pane) + 1e-9
  ),
  "headroom is reserved inside the fit, so the pin cannot push the bottom off"
);

check(
  "camera: top-aligned framing pins the graph top one headroom below the free-area top",
  topAlignedPanes.every((pane) => {
    const r = topAligned(midCards, pane);
    return Math.abs(r.top - r.headroom) < 1e-6;
  }),
  "brain, as the graph's topmost card, lands high on screen"
);

check(
  "camera: top-aligned framing keeps the whole graph on screen",
  topAlignedPanes.every((pane) => {
    const r = topAligned(midCards, pane);
    return r.top >= -1 && r.bottom <= r.usable.h + 1 && r.left >= -1 && r.right <= r.usable.w + 1;
  }),
  "the pin does not push the bottom edge off the pane"
);

check(
  "camera: top-aligned framing is horizontally centred like the centred fit",
  topAlignedPanes.every((pane) => {
    const r = topAligned(midCards, pane);
    return Math.abs((r.left + r.right) / 2 - r.usable.w / 2) < 1.5;
  }),
  "same x centring"
);

check(
  "camera: headroom is clamped and stays under the fit padding reserve",
  topAlignedPanes.every((pane) => {
    const h = fitTopHeadroom(pane);
    return h >= 24 - 1e-6 && h <= pane.h * 0.15 + 1e-6;
  }),
  "a graph that fitted before cannot be pushed off the bottom"
);

check(
  "camera: an empty graph is top-aligned nowhere rather than at a bogus zoom",
  fitTopAlignedTransformFor([], paneAt(N_WIDE, N_TALL)).zoom === FIT_MAX_ZOOM,
  "no cards, no claim of being framed"
);

/* ── Readable fit + readout ──────────────────────────────────────────────
 * The sphere is never centred vertically: load, Reset and the untouched
 * auto-fit put its 190px box top 56px below the pane top and its centre x on
 * the pane centre x, at zoom 1.0 (Reset: min(1.0, whole-tree fit)). Fit-all
 * frames the whole tree with 56px top / 24px side padding. The corner readout
 * is the zoom as a whole percent. */
const BRAIN_CENTRE = { x: 0, y: 95 };
const BRAIN_TOP = 0;
check(
  "camera: readable fit top-anchors the sphere at the requested zoom",
  topAlignedPanes.every((pane) => {
    const t = fitTopAnchoredTransformFor(BRAIN_CENTRE.x, BRAIN_TOP, pane, 1.0);
    return (
      t.zoom === 1.0 &&
      Math.abs(pane.w / 2 - (BRAIN_CENTRE.x * t.zoom + t.x)) < 1e-6 &&
      Math.abs(56 - (BRAIN_TOP * t.zoom + t.y)) < 1e-6
    );
  }),
  "box top 56px down, centre x on pane centre, zoom 1.0"
);
check(
  "camera: reset zoom is 1.0 or the whole-tree fit, whichever is smaller",
  topAlignedPanes.every((pane) => {
    const whole = fitZoomFor(midCards, pane);
    const reset = Math.min(1.0, whole);
    const t = fitTopAnchoredTransformFor(BRAIN_CENTRE.x, BRAIN_TOP, pane, reset);
    return t.zoom === reset && t.zoom <= 1.0 + 1e-9;
  }),
  "readable, never zoomed in past 1.0"
);
check(
  "camera: fit-all frames the whole tree with 56/24 padding",
  topAlignedPanes.every((pane) => {
    const t = fitAllTransformFor(midCards, pane);
    const box = boxOf(midCards)!;
    return (
      t.zoom >= FIT_MIN_ZOOM - 1e-9 &&
      t.zoom <= 1.0 + 1e-9 &&
      Math.abs(56 - (box.minY * t.zoom + t.y)) < 1e-6 &&
      Math.abs(box.minX * t.zoom + t.x - 24) < 2 &&
      Math.abs(pane.w - (box.maxX * t.zoom + t.x) - 24) < 2 &&
      Math.abs((box.minX + box.maxX) / 2 * t.zoom + t.x - pane.w / 2) < 1.5
    );
  }),
  "56 top, 24 sides, centred, 0.4 floor"
);
check(
  "camera: zoom readout is the whole percent",
  formatZoomPct(1) === "100%" && formatZoomPct(0.4) === "40%" && formatZoomPct(0.713) === "71%",
  "100% / 40% / 71%"
);

const failed: string[] = results.filter((r) => r.startsWith("FAIL"));
console.log(results.join("\n"));
console.log(`\n${results.length - failed.length}/${results.length} passed`);
if (failed.length > 0) process.exit(1);
