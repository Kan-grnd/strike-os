/**
 * Live Topology model + deterministic layout engine.
 *
 * The graph is READ from /api/topology (DB-backed). This module only
 * arranges and styles it — it never holds a competing state system.
 *
 * Shape language (spec: FEW SHAPES, STRONG HIERARCHY):
 *  - HIVE_CORE ... unique Brain/CEO silhouette (hex), largest node.
 *  - COLONY ..... structural container panel.
 *  - AGENT ...... ONE unified base shape regardless of role; role is a small
 *                 glyph, rank shows in size only. State NEVER changes the shape.
 *  - MISSION .... distinct structural node.
 *  - TOOL/MCP/AUTOMATION/MEMORY ... compact resource chips.
 */

export type LayoutMode = "HIERARCHY" | "EXECUTION" | "DEPENDENCY" | "COMMUNICATION" | "RESOURCE";

export interface TNode {
  id: string;
  type: string;
  label: string;
  status: string;
  runtimeState?: string;
  previousRuntimeState?: string;
  blockedBy?: string | null;
  stateReason?: string | null;
  currentTaskId?: string | null;
  parent?: string;
  data: Record<string, unknown>;
}

export interface TEdge {
  id: string;
  source: string;
  target: string;
  type: string;
  data?: Record<string, unknown>;
}

export interface TGraph {
  nodes: TNode[];
  edges: TEdge[];
}

/**
 * Stable, non-persistent id for the synthetic STRIKE CORE orchestration node.
 * Derived in the topology projection between BRAIN/CEO and the colonies —
 * never written to the database.
 */
export const CORE_ID = "strike-core";

/** Node types that are structural/containers, never agents. DECISION/APPROVAL
 *  gates are control-plane nodes, so they are excluded from agent counting. */
export const STRUCTURAL_NODE_TYPES = [
  "HIVE_CORE",
  "CORE",
  "COLONY",
  "MISSION",
  "DECISION",
  "TOOL",
  "MCP",
  "AUTOMATION",
  "MEMORY",
] as const;

/* ─── State palette ──────────────────────────────────────────── */

export const ACTIVE_STATES = ["initializing", "thinking", "planning", "executing", "delegating", "retrying"];

export const STATE_META: Record<
  string,
  { label: string; text: string; bar: string; dot: string; border: string; chip: string; active?: boolean; terminal?: boolean }
> = {
  idle:              { label: "Idle",               text: "text-zinc-400",  bar: "bg-zinc-600", dot: "bg-zinc-500", border: "border-zinc-700/60", chip: "text-zinc-400" },
  initializing:      { label: "Initializing",       text: "text-sky-300",   bar: "bg-sky-500",   dot: "bg-sky-400",   border: "border-sky-500/40", chip: "text-sky-300", active: true },
  thinking:          { label: "Thinking",           text: "text-sky-300",   bar: "bg-sky-500",   dot: "bg-sky-400",   border: "border-sky-500/40", chip: "text-sky-300", active: true },
  planning:          { label: "Planning",           text: "text-teal-300",  bar: "bg-teal-500",  dot: "bg-teal-400",  border: "border-teal-500/40", chip: "text-teal-300", active: true },
  executing:         { label: "Executing",          text: "text-cyan-300",  bar: "bg-cyan-400",  dot: "bg-cyan-300",  border: "border-cyan-400/50", chip: "text-cyan-300", active: true },
  delegating:        { label: "Delegating",         text: "text-teal-300",  bar: "bg-teal-500",  dot: "bg-teal-400",  border: "border-teal-500/40", chip: "text-teal-300", active: true },
  waiting:           { label: "Waiting",            text: "text-sky-300",   bar: "bg-sky-600",   dot: "bg-sky-500",   border: "border-sky-600/40", chip: "text-sky-300" },
  waiting_for_approval: { label: "Needs Approval",  text: "text-violet-300",bar: "bg-violet-500",dot: "bg-violet-400", border: "border-violet-500/40", chip: "text-violet-300" },
  retrying:          { label: "Retrying",           text: "text-orange-300",bar: "bg-orange-500",dot: "bg-orange-400", border: "border-orange-500/40", chip: "text-orange-300", active: true },
  blocked:           { label: "Blocked",            text: "text-amber-300", bar: "bg-amber-400", dot: "bg-amber-300", border: "border-amber-400/50", chip: "text-amber-300" },
  paused:            { label: "Paused",             text: "text-orange-300",bar: "bg-orange-500",dot: "bg-orange-400", border: "border-orange-500/40", chip: "text-orange-300" },
  stopped:           { label: "Stopped",            text: "text-zinc-500",  bar: "bg-zinc-700",  dot: "bg-zinc-600",  border: "border-zinc-700/50", chip: "text-zinc-500", terminal: true },
  completed:         { label: "Completed",          text: "text-emerald-300",bar: "bg-emerald-500",dot: "bg-emerald-400", border: "border-emerald-500/40", chip: "text-emerald-300", terminal: true },
  failed:            { label: "Failed",             text: "text-red-300",   bar: "bg-red-500",   dot: "bg-red-400",   border: "border-red-500/50", chip: "text-red-300", terminal: true },
  cancelled:         { label: "Cancelled",          text: "text-zinc-500",  bar: "bg-zinc-700",  dot: "bg-zinc-600",  border: "border-zinc-700/50", chip: "text-zinc-500", terminal: true },
  // non-agent statuses
  active:            { label: "Active",             text: "text-cyan-300",  bar: "bg-cyan-500",  dot: "bg-cyan-400",  border: "border-cyan-500/40", chip: "text-cyan-300", active: true },
  running:           { label: "Running",            text: "text-cyan-300",  bar: "bg-cyan-400",  dot: "bg-cyan-300",  border: "border-cyan-400/50", chip: "text-cyan-300", active: true },
  planning_mission:  { label: "Planning",           text: "text-teal-300",  bar: "bg-teal-500",  dot: "bg-teal-400",  border: "border-teal-500/40", chip: "text-teal-300", active: true },
  ready:             { label: "Ready",              text: "text-zinc-300",  bar: "bg-zinc-500",  dot: "bg-zinc-400",  border: "border-zinc-600/60", chip: "text-zinc-300" },
  healthy:           { label: "Healthy",            text: "text-emerald-300",bar: "bg-emerald-500",dot: "bg-emerald-400", border: "border-emerald-500/40", chip: "text-emerald-300" },
  unknown:           { label: "Unknown",            text: "text-zinc-400",  bar: "bg-zinc-600",  dot: "bg-zinc-500",  border: "border-zinc-700/60", chip: "text-zinc-400" },
};

export function stateMeta(status: string | undefined, type?: string): (typeof STATE_META)["idle"] {
  if (!status) return STATE_META.idle;
  if (STATE_META[status]) return STATE_META[status];
  // Uppercase legacy statuses → lowercase match
  const lower = status.toLowerCase();
  if (STATE_META[lower]) return STATE_META[lower];
  // Colony-level fallbacks
  if (type === "COLONY") return STATE_META.active;
  if (status.startsWith("running") || status.startsWith("quest")) return STATE_META.running;
  return STATE_META.unknown;
}

/** Solid hex per runtime state — used by the MiniMap (borderRadius view) so node
 *  colors stay on-dark without relying on Tailwind class fragments. */
export function stateHex(status: string | undefined): string {
  const T: Record<string, string> = {
    idle: "#a1a1aa",
    initializing: "#38bdf8",
    thinking: "#38bdf8",
    planning: "#2dd4bf",
    executing: "#22d3ee",
    delegating: "#2dd4bf",
    waiting: "#38bdf8",
    waiting_for_approval: "#a78bfa",
    retrying: "#fb923c",
    blocked: "#fbbf24",
    paused: "#fb923c",
    stopped: "#3f3f46",
    completed: "#34d399",
    failed: "#f87171",
    cancelled: "#3f3f46",
    active: "#22d3ee",
    running: "#22d3ee",
    planning_mission: "#2dd4bf",
    ready: "#71717a",
    healthy: "#34d399",
    connected: "#34d399",
    degraded: "#fbbf24",
    unknown: "#52525b",
  };
  if (!status) return T.idle;
  if (T[status]) return T[status];
  const lower = status.toLowerCase();
  return T[lower] ?? T.unknown;
}

export const ROLE_GLYPH: Record<string, string> = {
  WORKER: "W", SPECIALIST: "S", ARCHITECT: "A", PLANNER: "P", OBSERVER: "O", EVALUATOR: "E", SUB_AGENT: "s",
  CORE: "C", RESEARCHER: "R", ENGINEER: "Eng", COORDINATOR: "Co",
};

export function agentRoleLabel(type: string): string {
  return ROLE_GLYPH[type] ?? "A";
}

export function isAgent(type: string): boolean {
  return !STRUCTURAL_NODE_TYPES.includes(type as (typeof STRUCTURAL_NODE_TYPES)[number]);
}

/* ─── Sizes ──────────────────────────────────────────────────── */

export const NODE_W = {
  HIVE_CORE: 300,
  CORE: 320,
  COLONY: 320,
  AGENT: 200,
  MISSION: 210,
  DECISION: 160,
  RESOURCE: 180,
};

export const AGENT_H = 58;
export const MISSION_H = 60;
export const RESOURCE_H = 46;

/** BRAIN / CEO — unique high line-height so it carries the most visual weight. */
export const SPINE_H = 60;
export const CORE_H = 56;
export const DECISION_H = 44;

/** Colony panel metrics. COLONY_H is the render-height of the header + stats
 *  block; COL_HEAD is where member layout begins so members never collide
 *  with the collapsed-info chrome. */
export const COLONY_H = 116;
export const COL_HEAD = 124;

export const CHIP_GAP = 14;
export const COL_PAD = 22;

/* ─── Edge styling ───────────────────────────────────────────── */

export const EDGE_META: Record<string, { label: string; color: string; dash?: string }> = {
  reports_to:  { label: "Reports to",   color: "#71717a" },
  assigned:    { label: "Assigned",     color: "#22d3ee", dash: "2 4" },
  depends_on:  { label: "Depends on",   color: "#f59e0b", dash: "5 5" },
  blocked_by:  { label: "Blocked by",   color: "#f43f5e", dash: "2 3" },
  uses:        { label: "Uses",         color: "#71717a", dash: "3 4" },
  produces:    { label: "Produces",     color: "#10b981" },
  consumes:    { label: "Consumes",     color: "#71717a" },
  manages:     { label: "Manages",      color: "#71717a" },
  delegates_to:{ label: "Delegates",    color: "#38bdf8", dash: "4 4" },
  belongs_to:  { label: "Belongs to",   color: "#52525b" },
  contains:    { label: "Contains",     color: "#52525b" },
  calls:       { label: "Calls",        color: "#71717a" },
  returns_to:  { label: "Returns to",   color: "#71717a" },
  fallback:    { label: "Fallback",     color: "#f97316", dash: "5 5" },
  retry:       { label: "Retry",        color: "#f59e0b", dash: "2 3" },
  approval:    { label: "Approval",     color: "#a78bfa", dash: "4 4" },
};

export function edgeMeta(type: string) {
  return EDGE_META[type] ?? { label: type, color: "#71717a" };
}

/* ─── Graph building + layout ────────────────────────────────── */

export interface LayoutResult {
  nodes: TNode[];
  edges: TEdge[];
  dims: Record<string, { x: number; y: number; w: number; h: number }>;
  /** nodeId → RF parentId (colony containment) for contained layouts */
  parentOf?: Record<string, string>;
  colonyBuckets: Record<string, Record<string, number>>;
  stats: Record<string, number>;
}

const vGap = 16;
const hGap = 28;

export function buildGraph(projection: any): { nodes: TNode[]; edges: TEdge[] } {
  const raw = projection?.nodes ?? [];
  const nodes: TNode[] = raw.map((n: any) => ({
    id: n.id,
    type: n.type,
    label: n.label,
    status: n.status ?? n.runtimeState ?? "unknown",
    runtimeState: n.runtimeState ?? n.status,
    previousRuntimeState: n.previousRuntimeState,
    blockedBy: n.blockedBy ?? null,
    stateReason: n.stateReason ?? null,
    currentTaskId: n.currentTaskId ?? null,
    parent: n.parent,
    data: n.data ?? {},
  }));
  const edges: TEdge[] = (projection?.edges ?? [])
    .map((e: any) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      type: e.type ?? "belongs_to",
      data: e.data ?? {},
    }))
    .filter((e: TEdge) => nodes.some((n) => n.id === e.source) && nodes.some((n) => n.id === e.target));
  return { nodes, edges };
}

function nodeW(n: TNode): number {
  if (n.type === "HIVE_CORE") return NODE_W.HIVE_CORE;
  if (n.type === "CORE") return NODE_W.CORE;
  if (n.type === "COLONY") return NODE_W.COLONY;
  if (n.type === "MISSION") return NODE_W.MISSION;
  if (n.type === "DECISION") return NODE_W.DECISION;
  if (isAgent(n.type)) return NODE_W.AGENT;
  return NODE_W.RESOURCE;
}
function nodeH(n: TNode): number {
  if (n.type === "HIVE_CORE") return SPINE_H;
  if (n.type === "CORE") return CORE_H;
  if (n.type === "COLONY") return COLONY_H;
  if (n.type === "MISSION") return MISSION_H;
  if (n.type === "DECISION") return DECISION_H;
  if (isAgent(n.type)) return AGENT_H;
  return RESOURCE_H;
}

function colonyBucketsFor(nodes: TNode[], colonies: TNode[]): Record<string, Record<string, number>> {
  const buckets: Record<string, Record<string, number>> = {};
  for (const c of colonies) buckets[c.id] = {};
  const byId = new Map(nodes.map((n) => [n.id, n]));

  // An agent belongs to a colony if it is a direct member (parent = colony) or
  // a sub-agent whose lead chain (agent → lead → colony) lands in one. Root
  // agents (parent chain ends at HIVE_CORE) count for nothing.
  const colonyOf = (n: TNode): string | null => {
    let cur: TNode | undefined = n;
    const seen = new Set<string>();
    while (cur && !seen.has(cur.id)) {
      seen.add(cur.id);
      if (cur.type === "COLONY") return cur.id;
      cur = cur.parent ? byId.get(cur.parent) : undefined;
    }
    return null;
  };

  for (const m of nodes) {
    if (!isAgent(m.type)) continue;
    const cid = colonyOf(m);
    if (!cid || !buckets[cid]) continue; // collapsed/missing colony — never bucket it
    buckets[cid][m.status] = (buckets[cid][m.status] || 0) + 1;
  }
  return buckets;
}

/** Deterministic hierarchy mode:
 *   BRAIN → STRIKE CORE → COLONIES → AGENTS/SUB AGENTS
 *   └── unassigned agents strip (under CORE) + missions/decisions column + resources.
 *  Colonies are containers (members use relative coords + parentOf), everything
 *  else is absolute so no node can silently fall back to the origin. */
function layoutHierarchy(nodes: TNode[]): { dims: Record<string, { x: number; y: number; w: number; h: number }>; parentOf: Record<string, string> } {
  const dims: Record<string, { x: number; y: number; w: number; h: number }> = {};
  for (const n of nodes) dims[n.id] = { x: 0, y: 0, w: nodeW(n), h: nodeH(n) };

  const colonies = nodes.filter((n) => n.type === "COLONY");
  const parentOf: Record<string, string> = {};
  const agents = nodes.filter((n) => isAgent(n.type));

  // Sub-agents were parented to lead agents in the API (agent:<leadId>). Recover hierarchy.
  const subByLead = new Map<string, TNode[]>();
  for (const a of agents) {
    const p = a.parent ?? "";
    if (p.startsWith("agent:")) {
      const leadNodeId = p; // keep the full `agent:<id>` form → matches lead.id lookups
      if (!subByLead.has(leadNodeId)) subByLead.set(leadNodeId, []);
      subByLead.get(leadNodeId)!.push(a);
    }
  }

  const hive = nodes.find((n) => n.type === "HIVE_CORE");
  const core = nodes.find((n) => n.type === "CORE");
  const missions = nodes.filter((n) => n.type === "MISSION");
  const decisions = nodes.filter((n) => n.type === "DECISION");
  const panels = new Set<string>(["HIVE_CORE", "CORE", "COLONY", "MISSION", "DECISION"]);
  const resources = nodes.filter((n) => !isAgent(n.type) && !panels.has(n.type));

  if (hive) dims[hive.id] = { x: 0, y: 0, w: NODE_W.HIVE_CORE, h: SPINE_H };

  // Measure each colony first (member coords are relative to the panel).
  const colonySize: Record<string, { w: number; h: number }> = {};
  colonies.forEach((c) => {
    const members = agents.filter((a) => a.parent === c.id);
    const leads = members.filter((m) => !m.parent!.startsWith("agent:"));
    let innerW = 0;
    // Member area begins BELOW the header + metrics block (COL_HEAD).
    let innerH = COL_HEAD;
    leads.forEach((lead) => {
      const subs = subByLead.get(lead.id) ?? [];
      const leadY = innerH;
      // Member coordinates are RELATIVE to the colony. The page attaches them
      // with parentId = colony so React Flow offsets them by the panel origin.
      dims[lead.id] = { x: COL_PAD, y: leadY, w: NODE_W.AGENT, h: AGENT_H };
      parentOf[lead.id] = c.id;
      let rowH = AGENT_H;
      const subX = COL_PAD + NODE_W.AGENT + hGap;
      subs.forEach((s, i) => {
        const sy = leadY + i * (AGENT_H + vGap);
        dims[s.id] = { x: subX, y: sy, w: NODE_W.AGENT - 14, h: AGENT_H };
        parentOf[s.id] = c.id;
        rowH = Math.max(rowH, AGENT_H + i * (AGENT_H + vGap));
        innerW = Math.max(innerW, subX + NODE_W.AGENT);
      });
      innerW = Math.max(innerW, COL_PAD + NODE_W.AGENT);
      innerH = innerH + rowH + vGap;
    });
    const w = Math.max(NODE_W.COLONY, innerW + COL_PAD * 2);
    const h = Math.max(COLONY_H, (leads.length ? innerH : COLONY_H) + COL_PAD);
    colonySize[c.id] = { w, h };
  });

  // STRIKE CORE bar: beneath BRAIN, spanning the colony row width.
  const coloniesTotalW =
    colonies.reduce((sum, c) => sum + colonySize[c.id].w, 0) + Math.max(0, colonies.length - 1) * 40;
  const coreW = Math.max(NODE_W.CORE, hive ? NODE_W.HIVE_CORE : 0, coloniesTotalW || 0);
  const coreY = hive ? SPINE_H + 24 : 0;
  if (core) dims[core.id] = { x: 0, y: coreY, w: coreW, h: CORE_H };
  let belowCore = core ? coreY + CORE_H : (hive ? dims[hive.id].y + dims[hive.id].h : 0);

  // Unassigned agents — parented to the brain but with no colony and no parent
  // agent. They never render at the origin: placed in a wrapped strip directly
  // under CORE.
  const unassigned = agents.filter((a) => {
    const p = a.parent ?? "";
    return !p.startsWith("agent:") && !colonies.some((c) => c.id === p);
  });
  if (unassigned.length) {
    const perRow = Math.max(1, Math.floor(coreW / (NODE_W.AGENT + hGap)));
    const stripY = belowCore + 28;
    unassigned.forEach((a, i) => {
      const row = Math.floor(i / perRow);
      const col = i % perRow;
      dims[a.id] = { x: col * (NODE_W.AGENT + hGap), y: stripY + row * (AGENT_H + vGap), w: NODE_W.AGENT, h: AGENT_H };
    });
    belowCore = stripY + Math.ceil(unassigned.length / perRow) * (AGENT_H + vGap);
  }

  const colonyTop = belowCore + 46;
  let colonyX = 0;
  colonies.forEach((c) => {
    const size = colonySize[c.id];
    dims[c.id] = { x: colonyX, y: colonyTop, w: size.w, h: size.h };
    colonyX = colonyX + size.w + 40;
  });

  // Decisions + missions column to the right of the colonies, from the top.
  const rightX = Math.max(colonyX, hive ? NODE_W.HIVE_CORE + 40 : 0);
  let railY = colonyTop;
  decisions.forEach((d) => {
    dims[d.id] = { x: rightX, y: railY, w: NODE_W.DECISION, h: DECISION_H };
    railY = railY + DECISION_H + vGap;
  });
  missions.forEach((m) => {
    dims[m.id] = { x: rightX, y: railY, w: NODE_W.MISSION, h: MISSION_H };
    railY = railY + MISSION_H + vGap;
  });

  // Resources stacked to the right of the mission rail.
  const resourcesX = rightX + Math.max(NODE_W.MISSION, NODE_W.DECISION) + 40;
  resources.forEach((r, i) => {
    dims[r.id] = { x: resourcesX, y: colonyTop + i * (RESOURCE_H + vGap), w: nodeW(r), h: RESOURCE_H };
  });

  return { dims, parentOf };
}
/** Execution mode: columns are lifecycle phases, rows are colonies.
 *  BRAIN + CORE sit above the phase grid in a trunk strip; missions and
 *  resources get right-side rails so no node falls back to the origin. */
function layoutExecution(nodes: TNode[]): Record<string, { x: number; y: number; w: number; h: number }> {
  const dims: Record<string, { x: number; y: number; w: number; h: number }> = {};
  for (const n of nodes) dims[n.id] = { x: 0, y: 0, w: nodeW(n), h: nodeH(n) };
  const agents = nodes.filter((n) => isAgent(n.type));
  const colonies = nodes.filter((n) => n.type === "COLONY");
  const inColony = (a: TNode) => !!a.parent && colonies.some((c) => c.id === a.parent);
  const phaseOf = (a: TNode) => phaseIndex(a.status);

  // Trunk strip: BRAIN → CORE stacked at the top-left, clear of agents.
  let trunkTop = 0;
  for (const n of nodes) {
    if (n.type === "HIVE_CORE") {
      dims[n.id] = { x: 0, y: trunkTop, w: NODE_W.HIVE_CORE, h: SPINE_H };
      trunkTop += SPINE_H + vGap;
    } else if (n.type === "CORE") {
      dims[n.id] = { x: 0, y: trunkTop, w: nodeW(n), h: CORE_H };
      trunkTop += CORE_H + vGap;
    }
  }

  const phaseIndex = (s: string) => {
    if (ACTIVE_STATES.includes(s)) return 0;
    if (s === "waiting" || s === "waiting_for_approval") return 1;
    if (s === "blocked") return 2;
    if (s === "paused") return 3;
    if (s === "stopped" || s === "cancelled") return 4;
    if (s === "completed") return 5;
    if (s === "failed") return 2;
    return 6;
  };
  const phaseX = [0, 240, 440, 660, 860, 1060, 1300];

  // Sub-agents (parent = `agent:<lead>`): grouped by lead; their cells snap to
  // the lead's phase column in the lead's colony band.
  const subByLead = new Map<string, TNode[]>();
  for (const a of agents) {
    const p = a.parent ?? "";
    if (p.startsWith("agent:")) {
      if (!subByLead.has(p)) subByLead.set(p, []);
      subByLead.get(p)!.push(a);
    }
  }
  const leadColony = new Map<string, string>();
  for (const a of agents) if (inColony(a)) leadColony.set(a.id, a.parent as string);

  // Each colony gets its own horizontal band; agents from different colonies
  // can therefore never collide in the same phase column. Sub-agents count
  // into the lead's phase column so the band fits entourage + members.
  const colPhaseCounts: Record<string, Record<number, number>> = {};
  for (const a of agents) {
    if (!inColony(a)) continue;
    const p = a.parent as string;
    colPhaseCounts[p] ??= {};
    colPhaseCounts[p][phaseOf(a)] = (colPhaseCounts[p][phaseOf(a)] ?? 0) + 1;
  }
  subByLead.forEach((subs, lead) => {
    const c = leadColony.get(lead);
    const ln = c ? nodes.find((n) => n.id === lead) : undefined;
    if (!c || !ln) return;
    const ph = phaseOf(ln);
    colPhaseCounts[c] ??= {};
    colPhaseCounts[c][ph] = (colPhaseCounts[c][ph] ?? 0) + subs.length;
  });
  // The colony panel IS its band row (x:0, y:row.y) — sized to fit the busiest
  // phase column incl. sub-agents, with vGap breathing room top and bottom and
  // a vGap gutter between bands so no panel pokes into the next band.
  const colonyRows: Record<string, { y: number; h: number }> = {};
  let bandY = trunkTop;
  for (const c of colonies) {
    const busiest = Math.max(1, ...Object.values(colPhaseCounts[c.id] ?? {}));
    const contentBottom = (busiest - 1) * (AGENT_H + vGap) + AGENT_H;
    const h = Math.max(COLONY_H, contentBottom + vGap + vGap);
    colonyRows[c.id] = { y: bandY, h };
    bandY += h + vGap;
  }

  const colCursor: Record<string, number> = {};
  const rootCursor: Record<number, number> = {};
  // Pass 1: colony-bound leads → their band, phase column, next free row.
  agents.forEach((a) => {
    if (!inColony(a)) return;
    const ph = phaseOf(a);
    const row = colonyRows[a.parent as string];
    const key = `${a.parent}:${ph}`;
    dims[a.id] = { x: phaseX[ph], y: row.y + (colCursor[key] ?? 0), w: NODE_W.AGENT, h: AGENT_H };
    colCursor[key] = (colCursor[key] ?? 0) + AGENT_H + vGap;
  });
  // Pass 2: sub-agents → lead's colony band, lead's phase column, next row.
  subByLead.forEach((subs, lead) => {
    const c = leadColony.get(lead);
    const ln = c ? nodes.find((n) => n.id === lead) : undefined;
    if (!c || !ln) return;
    const ph = phaseOf(ln);
    const row = colonyRows[c];
    const key = `${c}:${ph}`;
    for (const s of subs) {
      dims[s.id] = { x: phaseX[ph], y: row.y + (colCursor[key] ?? 0), w: NODE_W.AGENT, h: AGENT_H };
      colCursor[key] = (colCursor[key] ?? 0) + AGENT_H + vGap;
    }
  });
  // Pass 3: colony-less roots (and subs of colony-less leads) → below-grid strip.
  agents.forEach((a) => {
    if (inColony(a)) return;
    const p = a.parent ?? "";
    if (p.startsWith("agent:")) return; // handled in pass 3b after roots
    const ph = phaseOf(a);
    dims[a.id] = { x: phaseX[ph], y: bandY + (rootCursor[ph] ?? 0), w: NODE_W.AGENT, h: AGENT_H };
    rootCursor[ph] = (rootCursor[ph] ?? 0) + AGENT_H + vGap;
  });
  agents.forEach((a) => {
    if (inColony(a)) return;
    const p = a.parent ?? "";
    if (!p.startsWith("agent:")) return;
    const ln = nodes.find((n) => n.id === p);
    if (ln && inColony(ln)) return; // colony-bound lead — placed in pass 2
    const ph = phaseOf(ln ?? a);
    dims[a.id] = { x: phaseX[ph], y: bandY + (rootCursor[ph] ?? 0), w: NODE_W.AGENT, h: AGENT_H };
    rootCursor[ph] = (rootCursor[ph] ?? 0) + AGENT_H + vGap;
  });
  colonies.forEach((c) => {
    const row = colonyRows[c.id];
    const w = Math.max(NODE_W.COLONY, phaseX[6] + NODE_W.AGENT + 20);
    dims[c.id] = { x: 0, y: row.y, w, h: row.h };
  });

  // Missions + resources to the right of the phase grid.
  const gridW = phaseX[6] + NODE_W.AGENT;
  const missionsX = gridW + 60;
  let railY = 0;
  for (const n of nodes) {
    if (n.type === "MISSION") {
      dims[n.id] = { x: missionsX, y: railY, w: NODE_W.MISSION, h: MISSION_H };
      railY += MISSION_H + vGap;
    }
  }
  const resourcesX = missionsX + NODE_W.MISSION + 40;
  let resY = 0;
  for (const n of nodes) {
    if (["TOOL", "MCP", "AUTOMATION", "MEMORY", "DECISION"].includes(n.type)) {
      dims[n.id] = { x: resourcesX, y: resY, w: nodeW(n), h: nodeH(n) };
      resY += nodeH(n) + vGap;
    }
  }
  return dims;
}

/** Dependency mode: topological layers from dependency edges. BRAIN → CORE stay
 *  pinned in a top-left trunk strip; every layer + rail starts below it. Layer
 *  pitch is measured from the widest node in each layer + a fixed gap, so wide
 *  panels (320px colonies) can never bleed into the next layer. MISSION and
 *  resource chips ride right-side rails instead of inside layer columns. */
function layoutDependency(nodes: TNode[], edges: TEdge[]): Record<string, { x: number; y: number; w: number; h: number }> {
  const dims: Record<string, { x: number; y: number; w: number; h: number }> = {};
  const ids = nodes.map((n) => n.id);
  const layer: Record<string, number> = {};
  const adj = new Map<string, string[]>();
  edges.forEach((e) => {
    if (!["blocked_by", "depends_on", "assigned"].includes(e.type)) return;
    if (!adj.has(e.source)) adj.set(e.source, []);
    adj.get(e.source)!.push(e.target);
  });
  const resolve = (id: string, stack = new Set<string>()): number => {
    if (layer[id] !== undefined) return layer[id];
    if (stack.has(id)) return 0; // cycle guard — never recurse through a cycle
    const next = new Set(stack);
    next.add(id);
    const deps = adj.get(id) ?? [];
    const d = deps.length ? Math.max(...deps.map((d) => resolve(d, next))) + 1 : 0;
    layer[id] = d;
    return d;
  };
  ids.forEach((id) => resolve(id));

  // Trunk strip: BRAIN → CORE stacked top-left, clear of every layer.
  let trunkTop = 0;
  for (const n of nodes) {
    if (n.type === "HIVE_CORE") {
      dims[n.id] = { x: 0, y: trunkTop, w: NODE_W.HIVE_CORE, h: SPINE_H };
      trunkTop += SPINE_H + vGap;
    } else if (n.type === "CORE") {
      dims[n.id] = { x: 0, y: trunkTop, w: nodeW(n), h: CORE_H };
      trunkTop += CORE_H + vGap;
    }
  }
  const top = trunkTop;

  const inRail = (n: TNode) => n.type === "MISSION" || ["TOOL", "MCP", "AUTOMATION", "MEMORY", "DECISION"].includes(n.type);

  // Measure each finished layer's widest node (trunk + rails excluded).
  const layerMaxW: number[] = new Array(7).fill(0);
  for (const n of nodes) {
    if (n.type === "HIVE_CORE" || n.type === "CORE" || inRail(n)) continue;
    const l = Math.min(layer[n.id] ?? 0, 6);
    layerMaxW[l] = Math.max(layerMaxW[l], nodeW(n));
  }

  // Measured per-layer pitch: x = running sum of previous maxW + gap.
  const layerX: number[] = new Array(7).fill(20);
  let x = 20;
  for (let l = 0; l < 7; l++) {
    layerX[l] = x;
    x += layerMaxW[l] + hGap;
  }
  let gridRight = 0;
  for (let l = 0; l < 7; l++) gridRight = Math.max(gridRight, layerX[l] + layerMaxW[l]);

  // Rails to the right of the deep layers (mirror EXECUTION).
  const missionsX = gridRight + 60;
  const resourcesX = missionsX + NODE_W.MISSION + 40;

  const cursor: Record<string, number> = {};
  for (const n of nodes) {
    if (n.type === "HIVE_CORE" || n.type === "CORE" || inRail(n)) continue;
    const l = Math.min(layer[n.id] ?? 0, 6);
    const y = cursor[l] ?? top;
    dims[n.id] = { x: layerX[l], y, w: nodeW(n), h: nodeH(n) };
    cursor[l] = y + nodeH(n) + vGap;
  }
  let missionY = top;
  for (const n of nodes) {
    if (n.type === "MISSION") {
      dims[n.id] = { x: missionsX, y: missionY, w: NODE_W.MISSION, h: MISSION_H };
      missionY += MISSION_H + vGap;
    }
  }
  let resY = top;
  for (const n of nodes) {
    if (["TOOL", "MCP", "AUTOMATION", "MEMORY", "DECISION"].includes(n.type)) {
      dims[n.id] = { x: resourcesX, y: resY, w: nodeW(n), h: nodeH(n) };
      resY += nodeH(n) + vGap;
    }
  }
  return dims;
}

/** Communication mode: agents clustered by colony in a horizontal row (wide
 *  inter-cluster gaps ≥ 2× HIERARCHY's), members ordered active-first inside
 *  each cluster; BRAIN/CORE shrink to a slim top-left strip (the colony-spanning
 *  bar stays HIERARCHY's signature); unassigned agents drop into a strip below
 *  the clusters. Members keep relative coords + parentOf — the same containment
 *  contract as HIERARCHY — so clusters remain resizable panel containers. */
function layoutCommunication(nodes: TNode[]): { dims: Record<string, { x: number; y: number; w: number; h: number }>; parentOf: Record<string, string> } {
  const dims: Record<string, { x: number; y: number; w: number; h: number }> = {};
  for (const n of nodes) dims[n.id] = { x: 0, y: 0, w: nodeW(n), h: nodeH(n) };
  const parentOf: Record<string, string> = {};

  const colonies = nodes.filter((n) => n.type === "COLONY");
  const agents = nodes.filter((n) => isAgent(n.type));

  // Sub-agents are parented to a lead agent (`agent:<leadId>`). Group them.
  const subByLead = new Map<string, TNode[]>();
  for (const a of agents) {
    const p = a.parent ?? "";
    if (p.startsWith("agent:")) {
      if (!subByLead.has(p)) subByLead.set(p, []);
      subByLead.get(p)!.push(a);
    }
  }

  // Slim top-left trunk strip — reduced-width bar, not the HIERARCHY full-width
  // colony-spanning silhouette.
  const hive = nodes.find((n) => n.type === "HIVE_CORE");
  const core = nodes.find((n) => n.type === "CORE");
  let trunkBottom = 0;
  if (hive) {
    dims[hive.id] = { x: 0, y: 0, w: NODE_W.HIVE_CORE, h: SPINE_H };
    trunkBottom += SPINE_H + vGap;
  }
  if (core) {
    dims[core.id] = { x: 0, y: trunkBottom, w: Math.max(NODE_W.HIVE_CORE, NODE_W.CORE), h: CORE_H };
    trunkBottom += CORE_H + vGap;
  }

  // Active-first rank: active > waiting/blocked/failed > idle/completed.
  const rank = (n: TNode): number => {
    const s = n.status;
    if (ACTIVE_STATES.includes(s)) return 0;
    return ["waiting", "waiting_for_approval", "blocked", "failed", "paused"].includes(s) ? 1 : 2;
  };

  // Size each cluster (member coords relative to the colony panel, like
  // HIERARCHY: COL_PAD column, sub-agents on a second column under their lead).
  const clusterSize: Record<string, { w: number; h: number }> = {};
  colonies.forEach((c) => {
    const leads = agents.filter((a) => a.parent === c.id).sort((a, b) => rank(a) - rank(b));
    let innerW = 0;
    let innerH = COL_HEAD;
    leads.forEach((lead) => {
      const leadY = innerH;
      dims[lead.id] = { x: COL_PAD, y: leadY, w: NODE_W.AGENT, h: AGENT_H };
      parentOf[lead.id] = c.id;
      let rowH = AGENT_H;
      const subX = COL_PAD + NODE_W.AGENT + hGap;
      (subByLead.get(lead.id) ?? []).forEach((s, i) => {
        const sy = leadY + i * (AGENT_H + vGap);
        dims[s.id] = { x: subX, y: sy, w: NODE_W.AGENT - 14, h: AGENT_H };
        parentOf[s.id] = c.id;
        rowH = Math.max(rowH, AGENT_H + i * (AGENT_H + vGap));
        innerW = Math.max(innerW, subX + NODE_W.AGENT);
      });
      innerW = Math.max(innerW, COL_PAD + NODE_W.AGENT);
      innerH = innerH + rowH + vGap;
    });
    clusterSize[c.id] = {
      w: Math.max(NODE_W.COLONY, innerW + COL_PAD * 2),
      h: Math.max(COLONY_H, (leads.length ? innerH : COLONY_H) + COL_PAD),
    };
  });

  // Cluster row below the trunk, with wide inter-cluster gaps (≥ 2× the 40px
  // HIERARCHY uses) so the row reads as distinct communication clusters.
  const CLUSTER_GAP = 80;
  const clusterTop = trunkBottom + 40;
  let clusterX = 0;
  colonies.forEach((c) => {
    dims[c.id] = { x: clusterX, y: clusterTop, w: clusterSize[c.id].w, h: clusterSize[c.id].h };
    clusterX = clusterX + clusterSize[c.id].w + CLUSTER_GAP;
  });
  const clusterRight = clusterX - (colonies.length ? CLUSTER_GAP : 0);
  const clusterBottom = Math.max(0, ...colonies.map((c) => clusterTop + clusterSize[c.id].h));

  // Unassigned (colony-less, non-sub) agents: a wrapped strip below the row,
  // mirroring the HIERARCHY unassigned strip (their own sub-agents ride along).
  const unassigned = agents.filter((a) => {
    const p = a.parent ?? "";
    return !p.startsWith("agent:") && !colonies.some((c) => c.id === p);
  });
  if (unassigned.length) {
    const stripY = clusterBottom + 40;
    let sx = 0;
    unassigned.forEach((a) => {
      dims[a.id] = { x: sx, y: stripY, w: NODE_W.AGENT, h: AGENT_H };
      const subX = sx + NODE_W.AGENT + hGap;
      (subByLead.get(a.id) ?? []).forEach((s, i) => {
        dims[s.id] = { x: subX, y: stripY + i * (AGENT_H + vGap), w: NODE_W.AGENT - 14, h: AGENT_H };
      });
      sx += NODE_W.AGENT + hGap;
    });
  }

  // Missions + resources ride right-side rails (nothing left at the origin).
  const railX = Math.max(clusterRight, hive ? NODE_W.HIVE_CORE : 0) + 60;
  let railY = clusterTop;
  for (const n of nodes) {
    if (n.type === "MISSION") {
      dims[n.id] = { x: railX, y: railY, w: NODE_W.MISSION, h: MISSION_H };
      railY += MISSION_H + vGap;
    }
  }
  const resourcesX = railX + NODE_W.MISSION + 40;
  let resY = clusterTop;
  for (const n of nodes) {
    if (["TOOL", "MCP", "AUTOMATION", "MEMORY", "DECISION"].includes(n.type)) {
      dims[n.id] = { x: resourcesX, y: resY, w: nodeW(n), h: nodeH(n) };
      resY += nodeH(n) + vGap;
    }
  }

  return { dims, parentOf };
}

/** Resource mode: one column per resource class. Columns sit adjacent in the
 *  order TRUNK · AGENTS · RESOURCES · MISSIONS · COLONIES so agents sit next to
 *  the resource chips and `uses` edges stay short; each column's x is measured
 *  from the widest node in the previous column + a fixed gap, so columns can
 *  never overlap. DECISION gates are resource-class chips (kept current). */
function layoutResource(nodes: TNode[]): Record<string, { x: number; y: number; w: number; h: number }> {
  const dims: Record<string, { x: number; y: number; w: number; h: number }> = {};
  const classes: Record<string, TNode[]> = {
    TRUNK: [],
    AGENTS: [],
    RESOURCES: [],
    MISSIONS: [],
    COLONIES: [],
  };
  nodes.forEach((n) => {
    if (n.type === "HIVE_CORE" || n.type === "CORE") classes.TRUNK.push(n);
    else if (n.type === "COLONY") classes.COLONIES.push(n);
    else if (n.type === "MISSION") classes.MISSIONS.push(n);
    else if (isAgent(n.type)) classes.AGENTS.push(n);
    else classes.RESOURCES.push(n);
  });
  const classNames = ["TRUNK", "AGENTS", "RESOURCES", "MISSIONS", "COLONIES"];
  const cursor: Record<string, number> = {};
  const xFor: Record<string, number> = {};
  let x = 20;
  for (const cls of classNames) {
    xFor[cls] = x;
    x += (classes[cls].length ? Math.max(...classes[cls].map((n) => nodeW(n))) : 0) + hGap;
  }
  for (const cls of classNames) {
    classes[cls].forEach((n: TNode) => {
      const y = cursor[cls] ?? 0;
      dims[n.id] = { x: xFor[cls], y, w: nodeW(n), h: nodeH(n) };
      cursor[cls] = y + nodeH(n) + vGap;
    });
  }
  return dims;
}

export function layoutGraph(
  nodes: TNode[],
  edges: TEdge[],
  mode: LayoutMode,
  collapsed: Set<string>
): LayoutResult {
  let all = nodes;
  if (collapsed.size) {
    all = nodes.filter((n) => !(n.parent && collapsed.has(n.parent)) && !collapsed.has(n.id));
  }
  const colonies = all.filter((n) => n.type === "COLONY");
  let dims: Record<string, { x: number; y: number; w: number; h: number }>;
  let parentOf: Record<string, string> = {};
  switch (mode) {
    case "EXECUTION": dims = layoutExecution(all); break;
    case "DEPENDENCY": dims = layoutDependency(all, edges); break;
    case "RESOURCE": dims = layoutResource(all); break;
    case "COMMUNICATION": {
      const r = layoutCommunication(all);
      dims = r.dims;
      parentOf = r.parentOf;
      break;
    }
    default: {
      const r = layoutHierarchy(all);
      dims = r.dims;
      parentOf = r.parentOf;
      break;
    }
  }

  const visible = new Set(all.map((n) => n.id));
  const visEdges = edges.filter((e) => visible.has(e.source) && visible.has(e.target));

  const agentNs = all.filter((n) => isAgent(n.type));
  const stats: Record<string, number> = {
    agents: agentNs.length,
    active: agentNs.filter((a) => ACTIVE_STATES.includes(a.status)).length,
    blocked: agentNs.filter((a) => a.status === "blocked").length,
    failed: agentNs.filter((a) => a.status === "failed").length,
    paused: agentNs.filter((a) => a.status === "paused").length,
    completed: agentNs.filter((a) => a.status === "completed").length,
  };

  return { nodes: all, edges: visEdges, dims, parentOf, colonyBuckets: colonyBucketsFor(all, colonies), stats };
}