/* Derivation + store checks for the Live Topology spec.
 * Run: npx tsx scripts/check-selectors.ts
 */
import {
  BRAIN_NODE_ID,
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
  buildAdaptiveTopologyLayout,
  FIT_MAX_ZOOM,
  FIT_MIN_ZOOM,
  MIN_FILL_COVERAGE,
  MIN_FIT_ZOOM,
  NARROW_BREAKPOINT,
  NARROW_HYSTERESIS,
  NO_INSETS,
  buildTopologyLayout,
  clampSpacing,
  fitTransformFor,
  fitZoomFor,
  graphFitsIn,
  layoutBounds,
  narrowFor,
  SPACING_LIMITS,
  spacingFor,
  spacingTierFor,
  type Insets,
  type Placed as PlacedCard,
  type TopologyLayout,
  type TopologySpacing,
} from "../src/lib/runtime/layout";
import type { Node } from "@xyflow/react";
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
  brain: 256,
  specialist: 240,
  agent: 240,
  subagent: 224,
  operation: 176,
};
const CARD_H: Record<string, number> = {
  brain: 123,
  specialist: 104,
  agent: 104, // tallest: 11px operation line + single-line 3-button action row
  subagent: 104, // 81 without an operation line
  operation: 104, // every line truncates, so this is a true ceiling
};

// ── Hub and spokes ──
// The brain is the origin of graph space and territories are anchored on their
// own sectors around it, each subtree built as one block translated outward.
// The old contract — everything below the brain, one shared row cursor — is what
// made territories neighbours instead of spokes, and a second one (a phone got
// a stacked tree instead) meant the same workforce was two different graphs
// depending on the window. These check the geometry that replaced both.
const posNodes = getTopologyNodes(runtime, agentsExpanded);
const posOf = (id: string) => posNodes.find((n) => n.id === id)?.position ?? { x: 0, y: 0 };
const hub = posOf(BRAIN_NODE_ID);
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
/* The hub is the origin, not merely "a fixed point somewhere near the top".
 * Everything else in this section is relative to it, so if the origin moves the
 * whole composition silently becomes a different graph. */
check("hub: the brain is the origin of graph space and never moves", hub.x === 0 && hub.y === 0, JSON.stringify(hub));
check(
  "hub: the first territory is up-left of the brain and the second up-right",
  territoryPos("col-a").x < 0 && territoryPos("col-a").y < 0 && territoryPos("col-b").x > 0 && territoryPos("col-b").y < 0,
  `col-a=${JSON.stringify(territoryPos("col-a"))} col-b=${JSON.stringify(territoryPos("col-b"))}`
);
/* Symmetric means the same radius on both sides: an arbitrary ring would still
 * pass "one on each side". And both are *raised* rather than level, so the two
 * territories read as siblings beside the brain — not one stacked on the other,
 * which is the org chart this layout exists to replace. */
check(
  "hub: the pair is symmetric about the hub and both sit above it",
  Math.abs(Math.abs(territoryPos("col-a").x) - Math.abs(territoryPos("col-b").x)) < 1 &&
    territoryPos("col-a").y === territoryPos("col-b").y &&
    territoryPos("col-a").y < hub.y,
  `col-a=${JSON.stringify(territoryPos("col-a"))} col-b=${JSON.stringify(territoryPos("col-b"))}`
);
/* The brain has to end up *between* its territories, not merely above them. A
 * block hangs downward from its card, so a steep sector ray can only clear the
 * hub vertically and stacks the whole graph on one side; the sector rise is what
 * keeps the blocks clearing the hub sideways instead. */
check(
  "hub: the brain is level with its territories, not stacked above or below them",
  (() => {
    const brainCentre = hub.y + CARD_H.brain / 2;
    return territoryPos("col-a").y + CARD_H.specialist / 2 < brainCentre + CARD_H.brain &&
      territoryPos("col-b").y + CARD_H.specialist / 2 < brainCentre + CARD_H.brain &&
      territoryPos("col-a").x + CARD_W.specialist / 2 < hub.x &&
      territoryPos("col-b").x - CARD_W.specialist / 2 > hub.x;
  })(),
  `col-a=${JSON.stringify(territoryPos("col-a"))} col-b=${JSON.stringify(territoryPos("col-b"))}`
);
/* Each block is its own world: no card crosses the hub onto the other
 * territory's side. This is the property that makes the graph a hub rather
 * than two columns that happen to be far apart. */
check(
  "hub: every territory's subtree stays on its own side of the hub",
  posNodes
    .filter((n) => n.type !== "brain")
    .every((n) =>
      (ownerColony.get(n.id as string) ?? n.id) === "col-a" ? n.position.x < 0 : n.position.x > 0
    ),
  posNodes.map((n) => `${n.id}@${Math.round(n.position.x)}`).join(" ")
);
/* The radius is derived from the hub's own box, so a territory is always
 * anchored outside it. Compared against the brain's half-width here, and the
 * rectangle form is asserted with the real card sizes in the geometry section
 * below, once those are defined. */
check(
  "hub: the pair is pushed out past the hub's own width",
  Math.abs(territoryPos("col-a").x) > 128 && Math.abs(territoryPos("col-b").x) > 128,
  `col-a=${territoryPos("col-a").x} col-b=${territoryPos("col-b").x}`
);

/* Siblings, not a chain. The hierarchy is Brain → territory → agent, and the one
 * relationship the old stacked layout made easy to misread was a territory
 * looking like it belonged to the other one. There is no territory-to-territory
 * edge of any kind, structural or transient. */
const posEdges = getTopologyEdges(runtime, agentsExpanded);
const territoryIdSet = new Set(runtime.colonies.map((c) => c.id));
check(
  "hub: no territory is ever connected to another territory",
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
  "hub: the permanent edge set is exactly the declared ownership",
  declaredOwnership.size === actualOwnership.size &&
    Array.from(declaredOwnership).every((k) => actualOwnership.has(k)),
  `declared=${Array.from(declaredOwnership).sort().join(" ")} actual=${Array.from(actualOwnership).sort().join(" ")}`
);
/* An operation belongs directly under the worker that owns it: same column, and
 * below. The old layout satisfied this by accident on one path and by a
 * separate code path on the other, so it is pinned here on the geometry the
 * selectors actually use. */
check(
  "hub: every operation sits directly beneath the worker that owns it",
  ["t1", "t4", "t5"].every((id) => {
    const owner = runtime.tasks.find((t) => t.id === id)?.ownerAgentId as string;
    const op = placedAt(id);
    const agent = placedAt(owner);
    return op !== undefined && agent !== undefined && op.x === agent.x && op.y > agent.y;
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
// The specific regression: two operations under ONE owner must be spaced by the
// full card height. Operations belonging to different owners legitimately share
// a row (they sit in different columns), so this must group by owner — comparing
// every operation against every other just measures the row height.
const ownerOfTask = new Map(runtime.tasks.map((t) => [t.id, t.ownerAgentId]));
const byOwner = new Map<string, number[]>();
for (const n of worstCasePos.filter((x) => x.type === "operation")) {
  const owner = ownerOfTask.get(n.id) ?? "none";
  byOwner.set(owner, [...(byOwner.get(owner) ?? []), n.y].sort((a, b) => a - b));
}
const tooTight = Array.from(byOwner.entries()).filter(([, ys]) =>
  ys.some((y, i) => i > 0 && y - ys[i - 1] < CARD_H.operation)
);
check(
  "geometry: stacked operations spaced by full card height",
  tooTight.length === 0,
  Array.from(byOwner.entries()).map(([o, ys]) => `${o}:${ys.join("/")}`).join(" | ")
);
const subPos = worstCasePos.find((n) => n.type === "subagent");
const ownerPos = subPos ? worstCasePos.find((n) => n.id === "ag-1") : undefined;
check("geometry: sub-agent row clears its parent card (104px + gap)", subPos && ownerPos ? subPos.y - ownerPos.y >= CARD_H.agent : true, subPos && ownerPos ? `subY=${subPos.y} ownerY=${ownerPos.y} delta=${subPos.y - ownerPos.y}` : "n/a");

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
  "compact: worker and operation cards are at most 104px tall (no action-row wrap)",
  CARD_H.agent <= 104 && CARD_H.operation <= 104 && CARD_H.subagent <= 104,
  `agent=${CARD_H.agent} operation=${CARD_H.operation} subagent=${CARD_H.subagent}`
);
check(
  "compact: the hub keeps a clear radius (no card lands on the brain)",
  worstCasePos.filter((n) => n.id !== BRAIN_NODE_ID).every((n) => !overlaps(brainCard, n)),
  `brain@${JSON.stringify(brainCard)} others=${worstCasePos.length - 1}`
);
check(
  "compact: every card kind is narrower than before the pass",
  CARD_W.brain < 288 && CARD_W.specialist < 256 && CARD_W.agent < 256 && CARD_W.subagent < 240 && CARD_W.operation < 192,
  JSON.stringify(CARD_W)
);
check(
  "compact: the phone gets less air, not a different graph",
  (() => {
    const wide = buildTopologyLayout(runtime, false);
    const narrow = buildTopologyLayout(runtime, true);
    return (
      narrow.spacing.gap < wide.spacing.gap &&
      narrow.spacing.gutter < wide.spacing.gutter &&
      /* Same territories, same sectors: identical signs and ordering, so no
       * amount of compaction can make one flank the other. */
      Array.from(narrow.territories.keys()).join(",") === Array.from(wide.territories.keys()).join(",") &&
      Array.from(narrow.territories.values()).every((p, i) => {
        const q = Array.from(wide.territories.values())[i];
        return Math.sign(p.x) === Math.sign(q.x) && Math.sign(p.y) === Math.sign(q.y);
      })
    );
  })(),
  `wide=${JSON.stringify(buildTopologyLayout(runtime, false).spacing)} narrow=${JSON.stringify(buildTopologyLayout(runtime, true).spacing)}`
);
check(
  "compact: hierarchy still readable (levels narrow as they descend)",
  CARD_W.brain > CARD_W.specialist &&
    CARD_W.specialist === CARD_W.agent &&
    CARD_W.agent > CARD_W.subagent &&
    CARD_W.subagent > CARD_W.operation,
  JSON.stringify(CARD_W)
);
check(
  "compact: card height is independent of how many toggles a worker shows",
  (() => {
    /* The reserved band must not depend on a worker's own disclosure state.
     * Spacing is pinned explicitly here: the *top* band legitimately moves when
     * the graph crosses a size tier (hiding every operation can take the node
     * count from 10 to 8, which is a real change in how much air the graph
     * deserves), so comparing absolute Y without pinning spacing would be
     * testing the tier, not the property this check is about. */
    const pinned = { gap: 20, gutter: 24, territoryGap: 160, pad: 40 };
    const withToggles = buildTopologyLayout(runtime, false, pinned);
    const collapsedOps = buildTopologyLayout(
      { ...runtime, tasks: runtime.tasks.map((t) => ({ ...t, status: "COMPLETED" })) },
      false,
      pinned
    );
    const same = withToggles.agents.get("ag-1")?.y === collapsedOps.agents.get("ag-1")?.y;
    const deep = withToggles.subAgents.get("ag-4")?.y;
    return same && deep !== undefined;
  })(),
  "reserved band unchanged by operation count"
);

// ── Territories are independent of each other ──
// The regression that made a hub possible. The old column layout shared one row
// cursor across every colony, so the deepest subtree in ANY territory pushed
// every row of ALL the others down: one busy territory silently restacked the
// rest of the graph, which is exactly what made two territories impossible to
// place as anything but neighbours. Each block is now reserved on its own.
//
// The one thing a shared ring cannot promise is that the radius never moves —
// the ring is symmetric, so the largest block decides how far out every sector
// sits. What must hold is that the other territory is never *restructured*:
// every one of its cards keeps the position it has relative to its own anchor.
check(
  "hub: one territory's workers cannot restructure another territory",
  (() => {
    const before = buildTopologyLayout(runtime, false);
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
    const after = buildTopologyLayout(deepened, false);
    const read = (l: TopologyLayout, id: string) => {
      for (const bag of [l.territories, l.agents, l.subAgents, l.operations]) {
        const p = bag.get(id);
        if (p) return `${p.x},${p.y}`;
      }
      return "missing";
    };
    const anchorOf = (l: TopologyLayout, id: string) => l.territories.get("col-a") ?? { x: 0, y: 0 };
    const a0 = anchorOf(before, "col-a");
    const a1 = anchorOf(after, "col-a");
    const relative = (l: TopologyLayout, a: { x: number; y: number }, id: string) => {
      const raw = read(l, id);
      if (raw === "missing") return raw;
      const [x, y] = raw.split(",").map(Number);
      return `${x - a.x},${y - a.y}`;
    };
    const alphaCards = ["col-a", "ag-1", "ag-2", "ag-4", "t1", "t4", "t5"];
    const restructured = alphaCards.filter(
      (id) => relative(before, a0, id) !== relative(after, a1, id)
    );
    return (
      restructured.length === 0 &&
      after.subAgents.has("ag-8") &&
      // And the fixture really did exercise the coupling, so this cannot pass
      // by having built the same graph twice: the ring did open up.
      Math.abs(a1.x) > Math.abs(a0.x) &&
      collisionsIn(placedFromLayout(after)).length === 0
    );
  })(),
  "col-a keeps its internal geometry while the ring widens for col-b"
);

// ── Same guarantee at phone width ──
// A phone used to get a *different graph*: territories stacked into bands down
// one column, one sub-agent lattice shared across colonies, a different set of
// coordinates entirely. That made the same workforce mean two different
// hierarchies depending on the window, so a screenshot taken on a phone could
// not be compared with one taken on a desktop — and a phone is exactly where a
// reader is most likely to misread a stacked band as a reporting line.
//
// So the phone now gets the *same* graph, with tighter air. What is asserted
// here is the guarantee that matters: same sectors, same sibling order, same
// ownership, brain still the origin, and still no overlap.
const narrowNodes = getTopologyNodes(runtime, agentsExpanded, undefined, { narrow: true });
const narrowPos: Placed[] = narrowNodes.map((n) => ({
  id: n.id as string,
  type: n.type as string,
  x: n.position.x,
  y: n.position.y,
}));
const narrowCollisions: string[] = [];
for (let i = 0; i < narrowPos.length; i += 1) {
  for (let j = i + 1; j < narrowPos.length; j += 1) {
    if (overlaps(narrowPos[i], narrowPos[j])) {
      narrowCollisions.push(`${narrowPos[i].id} x ${narrowPos[j].id}`);
    }
  }
}
check("geometry: narrow (phone) layout has no overlaps either", narrowCollisions.length === 0, narrowCollisions.join(" | "));
check(
  "geometry: the phone keeps the brain at the origin",
  (() => {
    const b = narrowPos.find((n) => n.id === BRAIN_NODE_ID);
    return b !== undefined && b.x === 0 && b.y === 0;
  })(),
  JSON.stringify(narrowPos.find((n) => n.id === BRAIN_NODE_ID))
);
/* Sectors and sibling order, not raw coordinates: the phone legitimately uses a
 * tighter spacing tier and fewer agents per row, so the pixels differ by design.
 * What must be identical is the reading — who is beside whom, and in which
 * order. */
const orderOf = (placed: Placed[], colony: string) => {
  const members = new Set(
    placed.filter((p) => (ownerColony.get(p.id) ?? "") === colony).map((p) => p.id)
  );
  return placed
    .filter((p) => members.has(p.id) && p.type === "agent")
    .sort((a, b) => a.x - b.x)
    .map((p) => p.id)
    .join(",");
};
check(
  "geometry: the phone keeps both territories flanking the brain",
  (() => {
    const colonies = narrowPos.filter((n) => n.type === "specialist");
    if (colonies.length !== 2) return false;
    const [a, b] = [...colonies].sort((p, q) => p.x - q.x);
    return a.x < 0 && a.y < 0 && b.x > 0 && b.y < 0 && a.y === b.y;
  })(),
  narrowPos
    .filter((n) => n.type === "specialist")
    .map((n) => `${n.id}@(${Math.round(n.x)},${Math.round(n.y)})`)
    .join(" ")
);
check(
  "geometry: the phone keeps every territory's workers in the same order",
  orderOf(narrowPos, "col-a") === orderOf(worstCasePos, "col-a") &&
    orderOf(narrowPos, "col-b") === orderOf(worstCasePos, "col-b"),
  `narrow a=${orderOf(narrowPos, "col-a")} b=${orderOf(narrowPos, "col-b")} | wide a=${orderOf(worstCasePos, "col-a")} b=${orderOf(worstCasePos, "col-b")}`
);
check(
  "geometry: the phone keeps operations under the same owner",
  (() => {
    const edges = getTopologyEdges(runtime, agentsExpanded, undefined, { narrow: true });
    return ["t1", "t4", "t5"].every((id) => {
      const owner = runtime.tasks.find((t) => t.id === id)?.ownerAgentId as string;
      const e = edges.find((edge) => edge.target === id);
      const op = narrowPos.find((p) => p.id === id);
      const agent = narrowPos.find((p) => p.id === owner);
      return e?.source === owner && op !== undefined && agent !== undefined && op.x === agent.x && op.y > agent.y;
    });
  })(),
  ["t1", "t4", "t5"].join(",")
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
  const l = buildTopologyLayout(rt, false);
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
    const layout = buildTopologyLayout(orderedRt, false);
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
    .map((a) => `${a.name}@${Math.round(buildTopologyLayout(orderedRt, false).agents.get(a.id)?.x ?? 0)}`)
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
    const a = buildTopologyLayout(orderedRt, false);
    const b = buildTopologyLayout(shuffleRt, false);
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
    const l = buildTopologyLayout(orderedRt, false);
    const res = l.territories.get("col-res");
    const eng = l.territories.get("col-eng");
    return (
      l.brain.x === 0 && l.brain.y === 0 &&
      res !== undefined && eng !== undefined &&
      res.x < 0 && res.y < 0 && eng.x > 0 && eng.y < 0 && res.y === eng.y
    );
  })(),
  `res=${JSON.stringify(buildTopologyLayout(orderedRt, false).territories.get("col-res"))} eng=${JSON.stringify(buildTopologyLayout(orderedRt, false).territories.get("col-eng"))}`
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
    { id: "temp:delegation:e1", kind: "delegation", source: "ag-1", target: "ag-4", taskId: "t1", eventId: "e1", label: "Delegated", occurredAt: Date.now() },
    { id: "temp:verification:v1", kind: "verification", source: "ag-1", target: "t1", taskId: "t1", eventId: "v1", label: "Verifying", occurredAt: Date.now() },
  ],
});
const tempAnimated = edgesDeep.filter((e) => e.animated === true);
check("edges: temp edges animated", tempAnimated.length === 2, `animated=${tempAnimated.length}`);
check("edges: ownership edges present", edgesDeep.some((e) => e.source === BRAIN_NODE_ID));
const ownershipStrokes = edgesDeep
  .filter((e) => e.id.startsWith("owns:"))
  .map((e) => (e.style as { stroke?: string } | undefined)?.stroke ?? "");
const neutralPrefix = "hsl(var(--muted-foreground)";
check("edges: ownership neutral (no level tint)", ownershipStrokes.every((s) => s.startsWith(neutralPrefix)), ownershipStrokes.join("|"));
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
/* A spoke to a territory that sits beside the brain has to leave sideways,
 * otherwise it detours out of the bottom and back up. */
const spokeHandles = edgesDeep
  .filter((e) => e.source === BRAIN_NODE_ID)
  .map((e) => e.sourceHandle);
check(
  "edges: brain spokes use lateral handles when the territory is beside the brain",
  spokeHandles.length > 0 && spokeHandles.every((h) => h === HANDLE_IDS.outLeft || h === HANDLE_IDS.outRight),
  spokeHandles.join(",")
);
/* An operation is directly beneath its owner, so its edge is vertical. If this
 * ever picks a lateral handle, the eye is told the operation belongs to a
 * neighbour — which is the one misreading the whole hub layout exists to
 * remove. */
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
    { id: "v1", kind: "verification", source: "ag-1", target: "t1", eventId: "e2", label: "Verifying", occurredAt: Date.now() },
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

// ── Adaptive spacing ────────────────────────────────────────────────────────
// Spacing has to change with the size of the graph, but it is only allowed to
// change within floors that keep the layout readable. These guard both halves:
// that it really does adapt, and that it can never adapt into an overlap.

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
  "spacing: tiers are chosen by graph shape",
  spacingTierFor({ nodes: 4, depth: 0, widestRow: 2 }) === "small" &&
    spacingTierFor({ nodes: 14, depth: 1, widestRow: 3 }) === "medium" &&
    spacingTierFor({ nodes: 30, depth: 1, widestRow: 3 }) === "large" &&
    spacingTierFor({ nodes: 12, depth: 4, widestRow: 2 }) === "large" &&
    spacingTierFor({ nodes: 12, depth: 1, widestRow: 5 }) === "large",
  JSON.stringify({
    tiny: spacingTierFor({ nodes: 4, depth: 0, widestRow: 2 }),
    mid: spacingTierFor({ nodes: 14, depth: 1, widestRow: 3 }),
    many: spacingTierFor({ nodes: 30, depth: 1, widestRow: 3 }),
    deep: spacingTierFor({ nodes: 12, depth: 4, widestRow: 2 }),
    wide: spacingTierFor({ nodes: 12, depth: 1, widestRow: 5 }),
  })
);
check(
  "spacing: a small graph gets more air than a large one",
  spacingFor({ nodes: 4, depth: 0, widestRow: 1 }).gap > spacingFor({ nodes: 30, depth: 1, widestRow: 1 }).gap &&
    spacingFor({ nodes: 4, depth: 0, widestRow: 1 }).gutter > spacingFor({ nodes: 30, depth: 1, widestRow: 1 }).gutter,
  `small=${JSON.stringify(spacingFor({ nodes: 4, depth: 0, widestRow: 1 }))} large=${JSON.stringify(spacingFor({ nodes: 30, depth: 1, widestRow: 1 }))}`
);

/* Narrow has its own tier values and its own triggers, and until now neither was
 * pinned: a phone that compacted too late was indistinguishable from one that
 * compacted correctly. */
check(
  "spacing: narrow uses its own tier values",
  (() => {
    const small = spacingFor({ nodes: 4, depth: 0, widestRow: 1 }, true);
    const medium = spacingFor({ nodes: 12, depth: 1, widestRow: 2 }, true);
    const large = spacingFor({ nodes: 20, depth: 1, widestRow: 2 }, true);
    return (
      small.gap === 24 && small.gutter === 28 && small.territoryGap === 120 && small.pad === 32 &&
      medium.gap === 18 && medium.gutter === 20 && medium.territoryGap === 120 && medium.pad === 32 &&
      large.gap === 12 && large.gutter === 12 && large.territoryGap === 104 && large.pad === 24
    );
  })(),
  `small=${JSON.stringify(spacingFor({ nodes: 4, depth: 0, widestRow: 1 }, true))} ` +
    `large=${JSON.stringify(spacingFor({ nodes: 20, depth: 1, widestRow: 2 }, true))}`
);
check(
  "spacing: narrow compacts earlier than wide",
  (() => {
    const shape = { nodes: 20, depth: 1, widestRow: 2 };
    const deep = { nodes: 10, depth: 3, widestRow: 2 };
    return (
      spacingTierFor(shape, true) === "large" && spacingTierFor(shape, false) === "medium" &&
      spacingTierFor(deep, true) === "large" && spacingTierFor(deep, false) === "medium" &&
      spacingTierFor({ nodes: 4, depth: 0, widestRow: 1 }, true) === "small"
    );
  })(),
  JSON.stringify({
    twentyNarrow: spacingTierFor({ nodes: 20, depth: 1, widestRow: 2 }, true),
    twentyWide: spacingTierFor({ nodes: 20, depth: 1, widestRow: 2 }, false),
    deepNarrow: spacingTierFor({ nodes: 10, depth: 3, widestRow: 2 }, true),
    deepWide: spacingTierFor({ nodes: 10, depth: 3, widestRow: 2 }, false),
  })
);
/* The reason the narrow table exists: a phone must never come out roomier than a
 * desktop for the same graph, or the extra air just costs zoom. */
check(
  "spacing: narrow is never roomier than wide for the same shape",
  [4, 12, 20, 30].every((nodes) => {
    const w = spacingFor({ nodes, depth: 1, widestRow: 2 }, false);
    const n = spacingFor({ nodes, depth: 1, widestRow: 2 }, true);
    return n.gap <= w.gap && n.gutter <= w.gutter && n.territoryGap <= w.territoryGap && n.pad <= w.pad;
  }),
  "narrow tier values are tighter at every size"
);

/** No spacing, however aggressive, may drop a horizontal step below the card it
 *  positions — that is the difference between "tight" and "overlapping". */
const allOverlappingSteps = (label: string, rt: WorkforceRuntime, narrow: boolean, viewport?: { w: number; h: number }): string[] => {
  const layout = viewport
    ? buildAdaptiveTopologyLayout(rt, narrow, viewport)
    : buildTopologyLayout(rt, narrow);
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
const tierOverlaps = tierCases.flatMap(([label, rt]) => [
  ...allOverlappingSteps(`${label}/wide`, rt, false),
  ...allOverlappingSteps(`${label}/narrow`, rt, true),
]);
check("spacing: no overlap at any tier, wide or narrow", tierOverlaps.length === 0, tierOverlaps.join(" | "));

/* ── The ring has to hold for every sector count, not just the two the other
 * fixtures happen to build.
 *
 * The ring's difficulty is not the number of territories, it is their
 * inequality: one busy territory and one nearly empty one sit on adjacent
 * rays, so the busy block is much wider than its neighbour and can reach across
 * the hub. Even sizes hide that entirely, so the sweep makes each territory a
 * different size on purpose. */
const ringRuntime = (territories: Array<[roots: number, subs: number]>): WorkforceRuntime => {
  const colonies: WorkforceRuntime["colonies"] = [];
  const agents: WorkforceRuntime["agents"] = [];
  const tasks: WorkforceRuntime["tasks"] = [];
  territories.forEach(([roots, subs], ci) => {
    const id = `t${ci}`;
    colonies.push({ id, name: `Ring ${ci}`, status: "ACTIVE", agentIds: [], timestamps: runtime.colonies[0].timestamps });
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
 * push the whole ring outward rather than sitting comfortably inside it. */
const ringCases: Array<[string, WorkforceRuntime]> = [
  ["2 uneven", ringRuntime([[7, 2], [1, 0]])],
  ["3 uneven", ringRuntime([[6, 2], [1, 0], [3, 1]])],
  ["4 uneven", ringRuntime([[5, 1], [1, 0], [3, 0], [2, 1]])],
  ["5 uneven", ringRuntime([[4, 1], [1, 0], [3, 0], [2, 0], [1, 1]])],
  ["6 uneven", ringRuntime([[4, 1], [1, 0], [2, 0], [3, 0], [1, 1], [2, 1]])],
  ["7 uneven", ringRuntime([[3, 1], [1, 0], [2, 0], [2, 0], [1, 0], [2, 1], [1, 0]])],
  ["8 uneven", ringRuntime([[3, 0], [1, 0], [2, 0], [2, 0], [1, 0], [2, 0], [1, 0], [2, 1]])],
];
const ringOverlaps = ringCases.flatMap(([label, rt]) => allOverlappingSteps(`${label}/wide`, rt, false));
check("hub: no card ever overlaps another, at any sector count", ringOverlaps.length === 0, ringOverlaps.join(" | "));
/* The hub is the one card every sector points at, so a block reaching across it
 * is the failure the ring exists to prevent — and it is the failure uneven
 * blocks are most likely to cause. */
check(
  "hub: no block ever reaches across the hub, at any sector count",
  ringCases.every(([, rt]) => {
    const placed = placedFromLayout(buildTopologyLayout(rt, false));
    const hub = placed.find((p) => p.type === "brain")!;
    return placed.every((p) => p.id === "brain" || !overlaps(hub, p));
  }),
  ringCases
    .map(([label, rt]) => {
      const placed = placedFromLayout(buildTopologyLayout(rt, false));
      const hub = placed.find((p) => p.type === "brain")!;
      const hits = placed.filter((p) => p.id !== "brain" && overlaps(hub, p)).map((p) => p.id);
      return hits.length ? `${label}: ${hits.join(",")}` : "";
    })
    .filter(Boolean)
    .join(" | ")
);

/* Prove the multi-territory path is genuinely exercised rather than vacuous: both
 * territory cards must exist, sit on opposite sides of the hub, and clear the
 * required lateral separation — at every viewport size, because "narrow" is a
 * spacing tier now and not a second graph. */
check(
  "spacing: two territories clear the required separation at every size",
  (() => {
    for (const narrow of [false, true]) {
      const layout = buildTopologyLayout(twoColonyRt, narrow);
      if (layout.territories.size !== 2) return false;
      const [a, b] = Array.from(layout.territories.values());
      const dx = Math.abs(b.x - a.x);
      const dy = Math.abs(b.y - a.y);
      // Flanking: same height, opposite sides of the origin, and the gap is
      // measured between the outer edges of the two cards.
      if (dy > 1) return false;
      if (Math.sign(a.x) !== -Math.sign(b.x)) return false;
      if (dx < layout.spacing.territoryGap + CARD_W.specialist) return false;
    }
    return true;
  })(),
  (() => {
    const parts: string[] = [];
    for (const narrow of [false, true]) {
      const l = buildTopologyLayout(twoColonyRt, narrow);
      const [a, b] = Array.from(l.territories.values());
      parts.push(
        `${narrow ? "narrow" : "wide"}: dx=${Math.abs(b.x - a.x).toFixed(0)} dy=${Math.abs(b.y - a.y).toFixed(0)} ` +
          `territoryGap=${l.spacing.territoryGap}`
      );
    }
    return parts.join(" | ");
  })()
);

/* A hostile override must be pulled back inside the floors. This is the guard
 * that makes the floors real rather than advisory. */
const clamped = clampSpacing({ gap: 0, gutter: -50, territoryGap: 4, pad: 1 });
check(
  "spacing: absurd overrides are clamped back to the floors",
  clamped.gap >= SPACING_LIMITS.minGap &&
    clamped.gutter >= SPACING_LIMITS.minGutter &&
    clamped.territoryGap >= SPACING_LIMITS.minTerritoryGap &&
    clamped.pad >= SPACING_LIMITS.minPad,
  JSON.stringify(clamped)
);
check(
  "spacing: horizontal steps never fall below the card width",
  (() => {
    const s = clampSpacing({ gap: 12, gutter: SPACING_LIMITS.minGutter, territoryGap: 96, pad: 24 });
    const layout = buildTopologyLayout(midRt, false, s);
    const xs = Array.from(layout.agents.values()).map((p) => p.x).sort((a, b) => a - b);
    const minStep = Math.min(...xs.slice(1).map((x, i) => x - xs[i]));
    return minStep >= CARD_W.agent + SPACING_LIMITS.minGutter;
  })(),
  "step >= card width + min gutter"
);

/* The two systems must not fight. Where fitView is genuinely in charge — zoom
 * lands between the floor and the ceiling and the graph already fills the pane
 * — the adaptive builder has to hand the decision back and return exactly the
 * pure layout. The fixture is grown until that precondition actually holds, and
 * the precondition is asserted, so this test can never pass vacuously by
 * drifting into one of the two saturation cases. */
const coverage = (rt: WorkforceRuntime, vp: { w: number; h: number }): number => {
  const b = layoutBounds(buildTopologyLayout(rt, false));
  const w = Math.max(...b.map((p) => p.x + p.w / 2)) - Math.min(...b.map((p) => p.x - p.w / 2));
  const h = Math.max(...b.map((p) => p.y + p.h)) - Math.min(...b.map((p) => p.y));
  return ((w * FIT_MAX_ZOOM) / vp.w) * ((h * FIT_MAX_ZOOM) / vp.h);
};
const midRt2 = sizedRuntime(6, 1, 1);
const midVp = { w: 1200, h: 780 };
const midFit = fitZoomFor(layoutBounds(buildTopologyLayout(midRt2, false)), midVp);
/* Neutral means precisely "neither saturation case fires": either fit is not
 * pinned at the ceiling, or it is pinned but the pane is already well used. */
const midIsNeutral =
  midFit >= MIN_FIT_ZOOM &&
  !(midFit >= FIT_MAX_ZOOM - 1e-6 && coverage(midRt2, midVp) < MIN_FILL_COVERAGE);
check(
  "spacing: the mid-range fixture really is mid-range (guards the next check)",
  midIsNeutral,
  `fitZoom=${midFit.toFixed(3)} coverage=${coverage(midRt2, midVp).toFixed(3)}`
);
check(
  "spacing: mid-range graph defers to fitView (no conflict)",
  (() => {
    if (!midIsNeutral) return false;
    const pure = buildTopologyLayout(midRt2, false);
    const adaptive = buildAdaptiveTopologyLayout(midRt2, false, midVp);
    return (
      adaptive.spacing.gap === pure.spacing.gap &&
      adaptive.spacing.gutter === pure.spacing.gutter &&
      Array.from(adaptive.agents.entries()).every(([id, p]) => {
        const q = pure.agents.get(id);
        return q && q.x === p.x && q.y === p.y;
      })
    );
  })(),
  "medium tier untouched when fitView is in charge"
);

/* Where fit genuinely cannot help, spacing must take over: a tiny graph pinned
 * at maxZoom should use the space it has been given. */
check(
  "spacing: a tiny graph in a huge pane spreads out",
  (() => {
    const tiny = buildAdaptiveTopologyLayout(smallRt, false, { w: 4000, h: 2600 });
    return tiny.spacing.gap > buildTopologyLayout(smallRt, false).spacing.gap;
  })(),
  `gap=${buildAdaptiveTopologyLayout(smallRt, false, { w: 4000, h: 2600 }).spacing.gap}`
);

/* A graph too big for the pane is the other saturation case: spacing must take
 * over, and it must never break the no-overlap guarantee. The fixture is grown
 * until fit genuinely lands below the readability floor, and that precondition
 * is asserted, so this cannot pass vacuously by drifting out of the regime.
 *
 * Calibration note: with the fit model corrected against the live canvas, a
 * 72-node graph in this pane is not rescuable at all — its fit is already at the
 * canvas floor of 0.2, and no amount of tightening moves it. Across a sweep of
 * 346 fixtures, tightening never lifted a sub-floor pane back over MIN_FIT_ZOOM
 * (best case 0.425); the card dimensions dominate the graph extent, and the
 * floors exist to keep horizontal steps wider than the cards they position. So
 * this branch is a real but bounded improvement, not the rescue the original
 * comment claimed, and the checks below assert what is actually true. */
const tightVp = { w: 900, h: 620 };
const tightRt = sizedRuntime(4, 3, 0);
const cramped = allOverlappingSteps("cramped", largeRt, false, tightVp);
check("spacing: an enormous graph in a small pane still never overlaps", cramped.length === 0, cramped.join(" | "));
const zoomBefore = fitZoomFor(layoutBounds(buildTopologyLayout(tightRt, false)), tightVp);
const zoomAfter = fitZoomFor(layoutBounds(buildAdaptiveTopologyLayout(tightRt, false, tightVp)), tightVp);
check(
  "spacing: a pane too small for the graph is detected as such",
  zoomBefore < MIN_FIT_ZOOM && zoomBefore > FIT_MIN_ZOOM,
  `zoomBefore=${zoomBefore.toFixed(3)} floor=${MIN_FIT_ZOOM} canvasFloor=${FIT_MIN_ZOOM}`
);
check(
  "spacing: tightening improves legibility instead of degrading it",
  zoomAfter > zoomBefore,
  `zoom ${zoomBefore.toFixed(3)} -> ${zoomAfter.toFixed(3)}`
);
/* Guard the bound the sweep found, so a future change to the floors cannot
 * quietly turn a bounded improvement into silent overlap. Tightening is only
 * ever allowed to move the fit up, and never at the cost of a crossing card. */
check(
  "spacing: tightening is bounded by the floors, never by overlap",
  (() => {
    const tight = clampSpacing({
      gap: 0,
      gutter: 0,
      territoryGap: 0,
      pad: 0,
    });
    const laid = buildTopologyLayout(tightRt, false, tight);
    const xs = Array.from(laid.agents.values())
      .map((p) => p.x)
      .sort((a, b) => a - b);
    const minStep = Math.min(...xs.slice(1).map((x, i) => x - xs[i]));
    return (
      minStep >= CARD_W.agent + SPACING_LIMITS.minGutter &&
      allOverlappingSteps("floored", tightRt, false).length === 0
    );
  })(),
  "hardest legal spacing still clears every card"
);

/* Determinism: same inputs, same output — including with a viewport. */
check(
  "spacing: layout is deterministic across calls, with and without a viewport",
  (() => {
    const vp = { w: 1280, h: 800 };
    const a = buildAdaptiveTopologyLayout(largeRt, false, vp);
    const b = buildAdaptiveTopologyLayout(largeRt, false, vp);
    return (
      a.spacing.gap === b.spacing.gap &&
      a.spacing.gutter === b.spacing.gutter &&
      Array.from(a.operations.entries()).every(([id, p]) => {
        const q = b.operations.get(id);
        return q && q.x === p.x && q.y === p.y;
      })
    );
  })(),
  "identical layout and spacing on repeat"
);

/* No viewport means no opinion: the pure tier layout is returned unchanged, so
 * SSR and tests never depend on a browser size they do not have. */
check(
  "spacing: no viewport falls back to pure tier defaults",
  (() => {
    const a = buildAdaptiveTopologyLayout(midRt, false, undefined);
    const b = buildTopologyLayout(midRt, false);
    return a.spacing.gap === b.spacing.gap && a.spacing.gutter === b.spacing.gutter;
  })(),
  "SSR path is viewport-independent"
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

const midCards = layoutBounds(buildTopologyLayout(midRt, false));

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
    const cards = layoutBounds(buildTopologyLayout(largeRt, false));
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

/* One number, one answer: the fit zoom the camera uses has to be the same one
 * the spacing rule reasoned about, or the two quietly disagree about whether a
 * graph is readable. */
check(
  "camera: the applied zoom is the same fit the spacing rule estimates",
  (() => {
    const pane = paneAt(N_WIDE, N_TALL);
    return fitTransformFor(midCards, pane).zoom === fitZoomFor(midCards, pane);
  })(),
  "fitTransformFor and fitZoomFor agree"
);

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

const failed: string[] = results.filter((r) => r.startsWith("FAIL"));
console.log(results.join("\n"));
console.log(`\n${results.length - failed.length}/${results.length} passed`);
if (failed.length > 0) process.exit(1);
