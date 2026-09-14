/**
 * Edge signal derivation — P3.
 *
 * Pure, event-driven mapping from the runtime event bus onto the rendered
 * topology graph. A `SignalPacket` is an ephemeral visual marker that rides an
 * existing edge (or pulses a node when that edge is missing / hidden for the
 * current layout mode). Signals NEVER invent topology: if neither the edge nor
 * a known node can be resolved, the event is dropped silently.
 *
 * This module is deliberately free of React / browser APIs so it can be unit
 * tested headlessly.
 */

export type PacketKind =
  | "assign" //     cyan    mission → agent (task.assigned / task.started)
  | "complete" //   emerald agent → mission (task.completed / agent.completed)
  | "spawn" //      sky     parent → child (agent.created + parentId)
  | "delegate" //   teal    child → parent (agent.delegating)
  | "tool-call" //  zinc    agent → tool
  | "tool-return" // zylind  tool → agent
  | "tool-fail" //  rose    agent → tool (distinct from agent-failure red)
  | "failure" //    red     incoming edge → failed agent
  | "blocked" //    amber   cause → blocked agent
  | "clear" //      teal    retried / unblocked
  | "approval"; //  violet  agent → mission (waiting for approval)

export const PACKET_COLORS: Record<PacketKind, string> = {
  assign: "#22d3ee",
  complete: "#10b981",
  spawn: "#38bdf8",
  delegate: "#2dd4bf",
  "tool-call": "#a1a1aa",
  "tool-return": "#a1a1aa",
  "tool-fail": "#fb7185",
  failure: "#f87171",
  blocked: "#f59e0b",
  clear: "#2dd4bf",
  approval: "#a78bfa",
};

/** Higher priority survives the global/per-edge caps first. */
export const PACKET_PRIORITY: Record<PacketKind, number> = {
  failure: 10,
  "tool-fail": 9,
  blocked: 9,
  approval: 8,
  complete: 5,
  clear: 5,
  assign: 4,
  "tool-call": 3,
  "tool-return": 3,
  spawn: 2,
  delegate: 2,
};

export const PACKET_TTL_MS = 2400;
export const MAX_PACKETS = 48;
export const MAX_PER_EDGE = 3;

export interface SignalEvent {
  id: string;
  type: string;
  timestamp: string | number | Date;
  source?: string;
  subjectId?: string;
  missionId?: string;
  taskId?: string;
  agentId?: string;
  payload?: string | Record<string, unknown>;
}

export interface SignalEdge {
  id: string;
  source: string;
  target: string;
  type: string;
  data?: Record<string, unknown> | null;
}

export interface SignalGraph {
  nodeIds: ReadonlySet<string>;
  edges: readonly SignalEdge[];
}

export interface SignalPacket {
  /** Stable identity for React keys / SMIL lifecycle — `${edgeId}:${kind}` or `node:${nodeId}:${kind}`. */
  id: string;
  /** Edge to ride. Absent when falling back to a node pulse. */
  edgeId?: string;
  /** Node to pulse when the ideal edge is missing or hidden for the mode. */
  fallbackNodeId?: string;
  kind: PacketKind;
  color: string;
  priority: number;
  ttlMs: number;
  /** True = animate edge.source → edge.target; false = reverse. */
  forward: boolean;
  /** Event epoch ms — drives TTL expiry. */
  createdAt: number;
  /** Source event id. */
  eventId: string;
  /** "static" when the viewer prefers reduced motion (SMIL can't be frozen via CSS). */
  motion: "animated" | "static";
}

export interface DeriveOptions {
  /** Only events strictly after this epoch ms are considered (post-mount freshness). */
  since?: number;
  /** "Now" in epoch ms — default Date.now(). Used for TTL pruning. */
  now?: number;
}

function toMs(value: string | number | Date): number {
  if (typeof value === "number") return value;
  if (value instanceof Date) return value.getTime();
  const t = Date.parse(value);
  return Number.isNaN(t) ? 0 : t;
}

function patch(ev: SignalEvent): Record<string, unknown> {
  if (!ev.payload) return {};
  if (typeof ev.payload === "object") return ev.payload as Record<string, unknown>;
  try {
    const v = JSON.parse(ev.payload);
    return v && typeof v === "object" ? (v as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

function findEdge(graph: SignalGraph, type: string, source: string, target: string): SignalEdge | null {
  return (
    graph.edges.find((e) => e.type === type && e.source === source && e.target === target) ?? null
  );
}

function findEdgeByTarget(graph: SignalGraph, type: string, target: string): SignalEdge | null {
  return graph.edges.find((e) => e.type === type && e.target === target) ?? null;
}

/** The most specific assigned edge for this agent: mission+agent, then taskId, then any. */
function findAssigned(
  graph: SignalGraph,
  missionId: string | undefined,
  agentId: string,
  taskId: string | undefined
): SignalEdge | null {
  const target = `agent:${agentId}`;
  if (missionId) {
    const edge = findEdge(graph, "assigned", `mission:${missionId}`, target);
    if (edge) return edge;
  }
  if (taskId) {
    const byTask = graph.edges.find((e) => e.type === "assigned" && e.data?.taskId === taskId);
    if (byTask) return byTask;
  }
  return graph.edges.find((e) => e.type === "assigned" && e.target === target) ?? null;
}

/** Incoming failure edge: prefer the assignment, else the hierarchy edge. */
function findIncoming(graph: SignalGraph, agentId: string): SignalEdge | null {
  const target = `agent:${agentId}`;
  return (
    graph.edges.find((e) => e.type === "assigned" && e.target === target) ??
    graph.edges.find((e) => e.type === "reports_to" && e.target === target) ??
    null
  );
}

/** Build a packet or fall back to a node pulse — never invents topology. */
function makePacket(
  graph: SignalGraph,
  edge: SignalEdge | null,
  fallbackNodeId: string,
  kind: PacketKind,
  ev: SignalEvent,
  forward: boolean
): SignalPacket | null {
  const createdAt = toMs(ev.timestamp);
  const base = {
    kind,
    color: PACKET_COLORS[kind],
    priority: PACKET_PRIORITY[kind],
    ttlMs: PACKET_TTL_MS,
    createdAt,
    eventId: ev.id,
    motion: "animated" as const,
  };
  if (edge) return { ...base, id: `${edge.id}:${kind}`, edgeId: edge.id, forward };
  if (graph.nodeIds.has(fallbackNodeId)) {
    return { ...base, id: `node:${fallbackNodeId}:${kind}`, fallbackNodeId, forward: false };
  }
  return null;
}

function candidatesFor(ev: SignalEvent, graph: SignalGraph): SignalPacket[] {
  const a = ev.agentId;

  switch (ev.type) {
    case "task.assigned":
    case "task.started": {
      if (!a) return [];
      const edge = findAssigned(graph, ev.missionId, a, ev.taskId);
      return compact([makePacket(graph, edge, `agent:${a}`, "assign", ev, true)]);
    }

    case "task.completed":
    case "agent.completed": {
      if (!a) return [];
      const edge = findAssigned(graph, ev.missionId, a, ev.taskId);
      return compact([makePacket(graph, edge, `agent:${a}`, "complete", ev, false)]);
    }

    case "agent.created": {
      if (!a) return [];
      const parentId = patch(ev).parentId;
      if (typeof parentId === "string" && parentId) {
        const edge = findEdge(graph, "reports_to", `agent:${parentId}`, `agent:${a}`);
        return compact([makePacket(graph, edge, `agent:${a}`, "spawn", ev, true)]);
      }
      return compact([makePacket(graph, null, `agent:${a}`, "spawn", ev, true)]);
    }

    case "agent.delegating": {
      if (!a) return [];
      // Delegate packet travels child → parent along the reports_to edge
      // (the delegating agent reports the hand-off up to its supervisor).
      const edge = findEdgeByTarget(graph, "reports_to", `agent:${a}`);
      return compact([makePacket(graph, edge, `agent:${a}`, "delegate", ev, false)]);
    }

    case "agent.delegated":
      // Deliberately ignored: the payload is name-only ({ delegatedTo: "Name",
      // task: "..." }), with no resolvable target id. Pairing it to an edge
      // would require guessing — which the signal layer must never do. The
      // `agent.delegating` state transition already surfaces the activity.
      return [];

    case "tool.completed": {
      const actor = patch(ev).agentId;
      if (typeof actor !== "string" || !actor) return [];
      const edge = findEdge(graph, "uses", `agent:${actor}`, `tool:${ev.subjectId ?? ""}`);
      return compact([
        makePacket(graph, edge, `agent:${actor}`, "tool-call", ev, true),
        makePacket(graph, edge, `tool:${ev.subjectId ?? ""}`, "tool-return", ev, false),
      ]);
    }

    case "tool.failed": {
      const actor = patch(ev).agentId;
      const edge =
        typeof actor === "string" && actor
          ? findEdge(graph, "uses", `agent:${actor}`, `tool:${ev.subjectId ?? ""}`)
          : null;
      return compact([makePacket(graph, edge, `tool:${ev.subjectId ?? ""}`, "tool-fail", ev, true)]);
    }

    case "agent.failed":
    case "task.failed": {
      if (!a) return [];
      const edge = findIncoming(graph, a);
      return compact([makePacket(graph, edge, `agent:${a}`, "failure", ev, true)]);
    }

    case "agent.blocked": {
      if (!a) return [];
      const edge = findEdgeByTarget(graph, "blocked_by", `agent:${a}`);
      return compact([makePacket(graph, edge, `agent:${a}`, "blocked", ev, true)]);
    }

    case "task.retried": {
      if (!a) return [];
      const edge = findAssigned(graph, ev.missionId, a, ev.taskId);
      return compact([makePacket(graph, edge, `agent:${a}`, "clear", ev, true)]);
    }

    case "agent.unblocked": {
      if (!a) return [];
      const edge =
        findEdgeByTarget(graph, "blocked_by", `agent:${a}`) ?? findIncoming(graph, a);
      return compact([makePacket(graph, edge, `agent:${a}`, "clear", ev, true)]);
    }

    case "agent.waiting_approval": {
      if (!a) return [];
      const edge = findAssigned(graph, ev.missionId, a, ev.taskId);
      return compact([makePacket(graph, edge, `agent:${a}`, "approval", ev, false)]);
    }

    default:
      return [];
  }
}

function compact<T>(arr: (T | null | undefined)[]): T[] {
  return arr.filter((x): x is T => Boolean(x));
}

/**
 * Derive live signal packets from fresh events against the current graph.
 * Pure and headlessly testable. Handles freshness (since), TTL pruning (now),
 * same-edge-kind coalescing, per-edge caps, and the global 48-packet cap —
 * failures/blocked always outrank completion/assign/tool/spawn.
 */
export function deriveSignals(
  freshEvents: readonly SignalEvent[],
  graph: SignalGraph,
  opts: DeriveOptions = {}
): SignalPacket[] {
  const now = opts.now ?? Date.now();
  const since = opts.since ?? 0;

  const candidates: SignalPacket[] = [];
  for (const ev of freshEvents) {
    const t = toMs(ev.timestamp);
    if (t <= since) continue;
    if (now - t > PACKET_TTL_MS) continue;
    for (const p of candidatesFor(ev, graph)) candidates.push(p);
  }

  // Same-edge/same-node + same-kind → coalesce to the freshest packet.
  const byId = new Map<string, SignalPacket>();
  for (const p of candidates) {
    const cur = byId.get(p.id);
    if (!cur || p.priority > cur.priority || (p.priority === cur.priority && p.createdAt > cur.createdAt)) {
      byId.set(p.id, p);
    }
  }

  // Per-edge (and per-node for pulses) cap: keep the highest-priority kinds.
  const buckets = new Map<string, SignalPacket[]>();
  for (const p of Array.from(byId.values())) {
    const key = p.edgeId ? `edge:${p.edgeId}` : `node:${p.fallbackNodeId ?? ""}`;
    const arr = buckets.get(key);
    if (arr) arr.push(p);
    else buckets.set(key, [p]);
  }
  const trimmed: SignalPacket[] = [];
  for (const arr of Array.from(buckets.values())) {
    arr.sort((x, y) => y.priority - x.priority || y.createdAt - x.createdAt);
    trimmed.push(...arr.slice(0, MAX_PER_EDGE));
  }

  // Global cap: drop lowest priority first (failures survive the burst).
  trimmed.sort((x, y) => y.priority - x.priority || y.createdAt - x.createdAt);
  return trimmed.slice(0, MAX_PACKETS);
}