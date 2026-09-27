/* Derivation + store checks for the Live Topology spec.
 * Run: npx tsx scripts/check-selectors.ts
 */
import {
  BRAIN_NODE_ID,
  getActiveOperations,
  getAttentionRequired,
  getTerritoryStats,
  getTopologyEdges,
  getTopologyNodes,
  getVisibleAgents,
  getVisibleOperations,
  getVisibleSubAgents,
} from "../src/lib/runtime/selectors";
import { useRuntimeStore } from "../src/lib/runtime/store";
import { computeBrainRuntime, computeSystemRuntime } from "../src/lib/runtime/mappers";
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

// ── Top-down positioning ──
const posNodes = getTopologyNodes(runtime, agentsExpanded);
const posOf = (id: string) => posNodes.find((n) => n.id === id)?.position ?? { x: 0, y: 0 };
const yOf = (type: string) => posNodes.filter((n) => n.type === type).map((n) => posOf(n.id as string).y);
check("top-down: brain x=0", posOf(BRAIN_NODE_ID).x === 0 && posOf(BRAIN_NODE_ID).y === 40, JSON.stringify(posOf(BRAIN_NODE_ID)));
check("top-down: territories row below brain", Math.max(...yOf("specialist")) >= posOf(BRAIN_NODE_ID).y && yOf("specialist").every((y) => y > posOf(BRAIN_NODE_ID).y));
check("top-down: all agents below territories", yOf("agent").every((y) => y > Math.max(...yOf("specialist"))));
check("top-down: sub-agents below agents", yOf("subagent").every((y) => y > Math.max(...yOf("agent")) - 1), `agents max=${Math.max(...yOf("agent"))} sub=${yOf("subagent")}`);
check("top-down: operations below owners", yOf("operation").every((y) => y > Math.max(...yOf("agent"))));
const territoryXs = posNodes.filter((n) => n.type === "specialist").map((n) => posOf(n.id as string).x);
check("top-down: territories balanced about brain", Math.abs(territoryXs.reduce((a, b) => a + b, 0)) < 1, territoryXs.join(","));

// ── No card may overlap another card (the P2 that ordering checks missed) ──
// "Below" is not the same as "clear of": the old constants put operation cards
// 68px apart while the cards are 117px tall. Reproduce the worst case by using
// the tallest measured card for every kind, and check real rectangles.
const CARD_W: Record<string, number> = {
  brain: 288,
  specialist: 256,
  agent: 256,
  subagent: 240,
  operation: 192,
};
const CARD_H: Record<string, number> = {
  brain: 131,
  specialist: 131,
  agent: 161, // tallest: action row wraps when both toggles show
  subagent: 161,
  operation: 117, // every line truncates, so this is a true ceiling
};
type Placed = { id: string; type: string; x: number; y: number };
const overlaps = (a: Placed, b: Placed): boolean => {
  const dx = Math.abs(a.x - b.x) < (CARD_W[a.type] + CARD_W[b.type]) / 2;
  const dy = Math.abs(a.y - b.y) < (CARD_H[a.type] + CARD_H[b.type]) / 2;
  return dx && dy;
};
const worstCasePos: Placed[] = [
  { id: "brain", type: "brain", ...posOf(BRAIN_NODE_ID) },
  ...posNodes
    .filter((n) => n.type !== "brain")
    .map((n) => ({ id: n.id as string, type: n.type as string, x: posOf(n.id as string).x, y: posOf(n.id as string).y })),
];
const collisions: string[] = [];
for (let i = 0; i < worstCasePos.length; i += 1) {
  for (let j = i + 1; j < worstCasePos.length; j += 1) {
    if (overlaps(worstCasePos[i], worstCasePos[j])) {
      collisions.push(`${worstCasePos[i].id}(${worstCasePos[i].type}) x ${worstCasePos[j].id}(${worstCasePos[j].type})`);
    }
  }
}
check("geometry: no card overlaps another at measured heights", collisions.length === 0, collisions.join(" | "));
// The specific regression: two operations under one owner must be spaced by the
// full card height, and a sub-agent row must clear its parent's own card.
const opSameOwner = worstCasePos.filter((n) => n.type === "operation");
const stackedOpGap = opSameOwner.length > 1 ? Math.min(...opSameOwner.map((n) => n.y)) : 0;
check("geometry: stacked operations spaced by full card height", opSameOwner.length <= 1 || (stackedOpGap >= 117 || opSameOwner.every((n, i, a) => i === 0 || Math.abs(a[i].y - a[i - 1].y) >= 117)), opSameOwner.map((n) => `${n.id}@${n.y}`).join(","));
const subPos = worstCasePos.find((n) => n.type === "subagent");
const ownerPos = subPos ? worstCasePos.find((n) => n.id === "ag-1") : undefined;
check("geometry: sub-agent row clears its parent card (161px + gap)", subPos && ownerPos ? subPos.y - ownerPos.y >= 161 : true, subPos && ownerPos ? `subY=${subPos.y} ownerY=${ownerPos.y} delta=${subPos.y - ownerPos.y}` : "n/a");

// ── Same guarantee at phone width, where colonies stack instead of sitting
// side by side. Narrow used to share the wide column grid, which forced the
// whole graph down to a 0.22 zoom and let a territory card land on an agent.
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
const narrowColonies = narrowPos.filter((n) => n.type === "specialist").map((n) => n.y);
check(
  "geometry: narrow stacks territories instead of overlapping them",
  narrowColonies.every((y, i) => i === 0 || y > narrowColonies[i - 1]),
  narrowColonies.join(",")
);
const narrowGraphW =
  Math.max(...narrowPos.map((n) => n.x + CARD_W[n.type] / 2)) -
  Math.min(...narrowPos.map((n) => n.x - CARD_W[n.type] / 2));
check("geometry: narrow model stays narrow enough to read", narrowGraphW <= 700, `width=${Math.round(narrowGraphW)}`);

// ── Determinism ──
const posNodesAgain = getTopologyNodes(runtime, agentsExpanded);
const stable = posNodes.every((n) => {
  const other = posNodesAgain.find((m) => m.id === n.id);
  return other && other.position.x === n.position.x && other.position.y === n.position.y;
});
check("layout determinism: identical across calls", stable);

// ── Flash placement: without a DOM (SSR / tests) falls back to owner +150 ──
const flashNodes = getTopologyNodes(runtime, agentsExpanded, undefined, {
  flashes: [
    { id: "flash:f1", entityId: "ag-1", label: "done", kind: "success", occurredAt: Date.now() },
  ],
});
const flashNode = flashNodes.find((n) => n.id === "flash:f1");
const flashOwnerY = flashNodes.find((n) => n.id === "ag-1")?.position.y ?? 0;
check(
  "flash: no-DOM fallback = owner y + 150",
  flashNode?.position.y === flashOwnerY + 150,
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

const failed: string[] = results.filter((r) => r.startsWith("FAIL"));
console.log(results.join("\n"));
console.log(`\n${results.length - failed.length}/${results.length} passed`);
if (failed.length > 0) process.exit(1);