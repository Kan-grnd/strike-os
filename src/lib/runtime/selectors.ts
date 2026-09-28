import type { Edge, Node } from "@xyflow/react";
import type {
  AgentRuntime,
  BrainRuntime,
  ColonyRuntime,
  CompletionFlash,
  SystemRuntime,
  TaskRuntime,
  TempEdge,
  WorkforceRuntime,
} from "./types";
import { buildAdaptiveTopologyLayout, buildTopologyLayout, type TopologyLayout, type ViewportSize } from "./layout";

/**
 * Manual disclosure: zoom is pure scale; the visible node set is decided only
 * by the user's expand/collapse actions. Expanding a node reveals its direct
 * children (territory → agents, agent/sub-agent → sub-agents + operations).
 */
export const BRAIN_NODE_ID = "brain";

export type TopologyNodeType = "brain" | "specialist" | "agent" | "subagent" | "operation" | "flash";
export type TopologyLevel = "core" | "territory" | "agent" | "sub" | "op";

export interface TopologyNodeData<T = unknown> extends Record<string, unknown> {
  entity: T;
  level: TopologyLevel;
  activate?: (id: string, type: string) => void;
  expanded?: boolean;
  /** Toggle disclosure. dim selects which child kind expands for worker nodes. */
  toggle?: (id: string, dim?: "sub" | "ops") => void;
}

const REMOVED_STATES = new Set(["cancelled", "stopped"]);
export const ATTENTION_PENDING_STATES = new Set(["waiting_for_approval", "blocked", "failed"]);
const ACTIVE_STATES = new Set(["executing", "thinking", "planning", "delegating", "retrying"]);
const WAITING_STATES = new Set(["waiting", "waiting_for_approval", "blocked"]);

const isLiveAgent = (a: AgentRuntime) => !REMOVED_STATES.has(a.runtimeState);

const dimStyle = (dimmed: boolean) => (dimmed ? { opacity: 0.2 } : undefined);

export function getActiveOperations(runtime: WorkforceRuntime): TaskRuntime[] {
  return runtime.tasks.filter((t) => t.status !== "COMPLETED" && t.status !== "CANCELLED");
}

export function getAttentionRequired(runtime: WorkforceRuntime): AgentRuntime[] {
  return runtime.agents.filter((a) => isLiveAgent(a) && ATTENTION_PENDING_STATES.has(a.runtimeState));
}

export function getLiveAgents(runtime: WorkforceRuntime): AgentRuntime[] {
  return runtime.agents.filter(isLiveAgent);
}

export function getVisibleTerritories(runtime: WorkforceRuntime): ColonyRuntime[] {
  return runtime.colonies.filter((c) => c.status !== "ARCHIVED");
}

/** Live root agents whose territory is expanded. */
export function getVisibleAgents(runtime: WorkforceRuntime, expanded: ReadonlySet<string>): AgentRuntime[] {
  return getLiveAgents(runtime).filter((a) => !a.parentId && !!a.colonyId && expanded.has(a.colonyId));
}

/** Live sub-agents whose direct parent is expanded via its "Sub-agents" toggle. */
export function getVisibleSubAgents(runtime: WorkforceRuntime, expanded: ReadonlySet<string>): AgentRuntime[] {
  return getLiveAgents(runtime).filter((a) => !!a.parentId && expanded.has(a.parentId + ":sub"));
}

/** Active operations whose owning worker is expanded via its "Operations" toggle. */
export function getVisibleOperations(runtime: WorkforceRuntime, expanded: ReadonlySet<string>): TaskRuntime[] {
  return getActiveOperations(runtime).filter((t) => !!t.ownerAgentId && expanded.has(t.ownerAgentId + ":ops"));
}

/** Live children (sub-agents + active operations) count per worker, for expand buttons. */
export function getAgentExpandCounts(runtime: WorkforceRuntime, agentId: string): { sub: number; ops: number } {
  let sub = 0;
  let ops = 0;
  for (const a of runtime.agents) {
    if (a.parentId === agentId && !REMOVED_STATES.has(a.runtimeState)) sub += 1;
  }
  for (const t of runtime.tasks) {
    if (t.ownerAgentId === agentId && t.status !== "COMPLETED" && t.status !== "CANCELLED") ops += 1;
  }
  return { sub, ops };
}

export interface TerritoryStats {
  total: number;
  active: number;
  waiting: number;
  errors: number;
}

export function getTerritoryStats(runtime: WorkforceRuntime, colonyId: string): TerritoryStats {
  const members = getLiveAgents(runtime).filter((a) => a.colonyId === colonyId);
  return {
    total: members.length,
    active: members.filter((a) => ACTIVE_STATES.has(a.runtimeState)).length,
    waiting: members.filter((a) => WAITING_STATES.has(a.runtimeState)).length,
    errors: members.filter((a) => a.runtimeState === "failed").length,
  };
}

function focusedAgentIds(runtime: WorkforceRuntime, focusAgentId: string): Set<string> {
  const ids = new Set<string>([focusAgentId]);
  const byId = new Map(runtime.agents.map((a) => [a.id, a]));
  let cur = byId.get(focusAgentId);
  while (cur?.parentId) {
    ids.add(cur.parentId);
    cur = byId.get(cur.parentId);
  }
  const stack = [focusAgentId];
  while (stack.length > 0) {
    const pid = stack.pop() as string;
    runtime.agents
      .filter((a) => a.parentId === pid)
      .forEach((a) => {
        if (!ids.has(a.id)) {
          ids.add(a.id);
          stack.push(a.id);
        }
      });
  }
  return ids;
}

export interface FocusContext {
  agentIds: Set<string>;
  territoryIds: Set<string>;
  operationIds: Set<string>;
}

function focusContext(runtime: WorkforceRuntime, focusAgentId: string): FocusContext {
  const agentIds = focusedAgentIds(runtime, focusAgentId);
  const territoryIds = new Set(
    runtime.agents
      .filter((a) => agentIds.has(a.id) && a.colonyId)
      .map((a) => a.colonyId as string)
  );
  const operationIds = new Set(
    runtime.tasks
      .filter((t) => t.ownerAgentId && agentIds.has(t.ownerAgentId))
      .map((t) => t.id)
  );
  return { agentIds, territoryIds, operationIds };
}

/**
 * Resolve the visible node set from the expansion state. Ancestors that were
 * collapsed mid-tree leave orphaned expansion ids behind, so a node is only
 * visible when its whole parent chain is visible AND expanded.
 */
function visibleNodeIds(
  runtime: WorkforceRuntime,
  expanded: ReadonlySet<string>
): Set<string> {
  const visible = new Set<string>([BRAIN_NODE_ID]);
  const colonies = getVisibleTerritories(runtime);
  for (const c of colonies) visible.add(c.id);

  const expandedRoots = getLiveAgents(runtime).filter(
    (a) => !a.parentId && !!a.colonyId && expanded.has(a.colonyId)
  );
  for (const a of expandedRoots) visible.add(a.id);

  // Sub-agents: repeat until fixed-point (parents may themselves be sub-agents).
  const subs = getLiveAgents(runtime).filter((a) => !!a.parentId);
  let changed = true;
  while (changed) {
    changed = false;
    for (const s of subs) {
      if (!visible.has(s.id) && s.parentId && expanded.has(s.parentId + ":sub") && visible.has(s.parentId)) {
        visible.add(s.id);
        changed = true;
      }
    }
  }

  for (const t of getVisibleOperations(runtime, expanded)) {
    if (t.ownerAgentId && visible.has(t.ownerAgentId)) visible.add(t.id);
  }
  return visible;
}

/** Where a transient completion pill sits below its owner card. Cards are ~104px
 *  tall after the compact pass, so measure the rendered node when a browser is
 *  available (offsetHeight — the pill and card share the same scaled plane).
 *  Falls back when there is no DOM (SSR / tests). */
const FLASH_FALLBACK_OFFSET_PX = 116;
function flashOffset(ownerId: string): number {
  if (typeof document === "undefined") return FLASH_FALLBACK_OFFSET_PX;
  try {
    const el = document.querySelector(`.react-flow__node[data-id="${ownerId}"]`);
    const h = el instanceof HTMLElement ? el.offsetHeight : 0;
    return h > 0 ? h + 12 : FLASH_FALLBACK_OFFSET_PX;
  } catch {
    return FLASH_FALLBACK_OFFSET_PX;
  }
}

export function getTopologyNodes(
  runtime: WorkforceRuntime,
  expanded: ReadonlySet<string>,
  focusAgentId?: string,
  opts: {
    narrow?: boolean;
    flashes?: CompletionFlash[];
    activate?: (id: string, type: string) => void;
    expandAll?: () => void;
    allExpanded?: boolean;
    toggle?: (id: string, dim?: "sub" | "ops") => void;
    layout?: TopologyLayout;
    viewport?: ViewportSize;
  } = {}
): Node[] {
  const layout = opts.layout ?? buildAdaptiveTopologyLayout(runtime, opts.narrow ?? false, opts.viewport);
  const focus = focusAgentId ? focusContext(runtime, focusAgentId) : null;
  const visible = visibleNodeIds(runtime, expanded);

  const nodes: Node[] = [];
  const isDimmed = (id: string, type: string): boolean => {
    if (!focus || id === BRAIN_NODE_ID) return false;
    if (type === "specialist") return !focus.territoryIds.has(id);
    if (type === "agent" || type === "subagent") return !focus.agentIds.has(id);
    if (type === "operation") return !focus.operationIds.has(id);
    return true;
  };

  const pushNode = (node: Node) => {
    nodes.push(node);
  };

  const activate = opts.activate;
  const territories = getVisibleTerritories(runtime);

  const brainData: TopologyNodeData<BrainRuntime> = {
    entity: runtime.brain,
    level: "core",
    system: runtime.system as SystemRuntime,
    territoryCount: territories.length,
    allExpanded: opts.allExpanded ?? (territories.length > 0 && territories.every((c) => expanded.has(c.id))),
    expandAll: opts.expandAll,
    activate,
  };
  pushNode({
    id: BRAIN_NODE_ID,
    type: "brain",
    data: brainData as Record<string, unknown>,
    position: layout.brain,
    style: dimStyle(isDimmed(BRAIN_NODE_ID, "brain")),
    selectable: true,
    focusable: false,
  });

  for (const colony of territories) {
    const stats = getTerritoryStats(runtime, colony.id);
    const data: TopologyNodeData<ColonyRuntime> = {
      entity: colony,
      level: "territory",
      stats: { ...stats },
      expanded: expanded.has(colony.id),
      toggle: opts.toggle,
      activate,
    };
    pushNode({
      id: colony.id,
      type: "specialist",
      data: data as Record<string, unknown>,
      position: layout.territories.get(colony.id) ?? { x: 0, y: 0 },
      style: dimStyle(isDimmed(colony.id, "specialist")),
      selectable: true,
      focusable: false,
    });
  }

  for (const agent of getVisibleAgents(runtime, expanded)) {
    pushAgentNode(runtime, agent, "agent", layout, expanded, activate, opts.toggle, focus, pushNode);
  }

  for (const sub of getVisibleSubAgents(runtime, expanded)) {
    if (!visible.has(sub.id)) continue;
    pushAgentNode(runtime, sub, "subagent", layout, expanded, activate, opts.toggle, focus, pushNode);
  }

  for (const task of getVisibleOperations(runtime, expanded)) {
    if (!visible.has(task.id)) continue;
    const owner = task.ownerAgentId
      ? runtime.agents.find((a) => a.id === task.ownerAgentId)
      : undefined;
    const data: TopologyNodeData<TaskRuntime> = {
      entity: task,
      level: "op",
      ownerName: owner?.name,
      activate,
    };
    pushNode({
      id: task.id,
      type: "operation",
      data: data as Record<string, unknown>,
      position: layout.operations.get(task.id) ?? { x: 0, y: 0 },
      style: dimStyle(isDimmed(task.id, "operation")),
      selectable: true,
      focusable: false,
    });
  }

  // Ephemeral completion/error transitions — only when their owner is visible.
  const flashes = opts.flashes ?? [];
  for (const flash of flashes) {
    if (!visible.has(flash.entityId)) continue;
    const ownerPos = layout.agents.get(flash.entityId) ?? layout.subAgents.get(flash.entityId);
    if (!ownerPos) continue;
    const data = { entity: flash, level: "agent", activate } as Record<string, unknown>;
    pushNode({
      id: flash.id,
      type: "flash",
      data,
      position: { x: ownerPos.x, y: ownerPos.y + flashOffset(flash.entityId) },
      style: {
        pointerEvents: "none",
        ...dimStyle(focus ? !focus.agentIds.has(flash.entityId) : false),
      },
      selectable: false,
      focusable: false,
    });
  }

  return nodes;
}

function pushAgentNode(
  runtime: WorkforceRuntime,
  agent: AgentRuntime,
  type: "agent" | "subagent",
  layout: TopologyLayout,
  expanded: ReadonlySet<string>,
  activate: ((id: string, t: string) => void) | undefined,
  toggle: ((id: string, dim?: "sub" | "ops") => void) | undefined,
  focus: FocusContext | null,
  pushNode: (node: Node) => void
) {
  const currentTask = agent.currentTaskId
    ? runtime.tasks.find((t) => t.id === agent.currentTaskId)
    : undefined;
  const counts = getAgentExpandCounts(runtime, agent.id);
  const data: TopologyNodeData<AgentRuntime> = {
    entity: agent,
    level: type === "agent" ? "agent" : "sub",
    expandedSub: expanded.has(agent.id + ":sub"),
    expandedOps: expanded.has(agent.id + ":ops"),
    toggle,
    subCount: counts.sub,
    opCount: counts.ops,
    operation: currentTask?.description,
    activate,
  };
  const position =
    type === "subagent"
      ? layout.subAgents.get(agent.id)
      : layout.agents.get(agent.id);
  pushNode({
    id: agent.id,
    type,
    data: data as Record<string, unknown>,
    position: position ?? { x: 0, y: 0 },
    style: dimStyle(focus ? !focus.agentIds.has(agent.id) : false),
    selectable: true,
    focusable: false,
  });
}

/** Structural ownership edges stay theme-neutral: color is reserved for
 *  status meaning (temp edges). Level is carried by position and size. */
const OWNERSHIP_STROKE = "hsl(var(--muted-foreground) / 0.5)";

export function getTopologyEdges(
  runtime: WorkforceRuntime,
  expanded: ReadonlySet<string>,
  focusAgentId?: string,
  opts: { narrow?: boolean; tempEdges?: TempEdge[]; layout?: TopologyLayout; viewport?: ViewportSize } = {}
): Edge[] {
  const layout = opts.layout ?? buildAdaptiveTopologyLayout(runtime, opts.narrow ?? false, opts.viewport);
  const focus = focusAgentId ? focusContext(runtime, focusAgentId) : null;
  const visible = visibleNodeIds(runtime, expanded);

  const edgeInFocus = (source: string, target: string): boolean => {
    if (!focus) return true;
    return (
      focus.agentIds.has(source) ||
      focus.agentIds.has(target) ||
      focus.territoryIds.has(source) ||
      focus.territoryIds.has(target) ||
      focus.operationIds.has(source) ||
      focus.operationIds.has(target)
    );
  };

  const edges: Edge[] = [];
  const dimTrue = () => ({ opacity: 0.2 });
  const push = (id: string, source: string, target: string, stroke: string) => {
    if (!visible.has(source) || !visible.has(target)) return;
    edges.push({
      id,
      source,
      target,
      type: "default",
      style: {
        stroke,
        strokeWidth: 1,
        ...(focus && !edgeInFocus(source, target) ? dimTrue() : undefined),
      },
    });
  };

  // Structural ownership spine: theme-neutral, thin.
  layout.territories.forEach((_, colonyId) =>
    push(`owns:brain-spec-${colonyId}`, BRAIN_NODE_ID, colonyId, OWNERSHIP_STROKE)
  );
  for (const [agentId] of Array.from(layout.agents)) {
    const agent = runtime.agents.find((a) => a.id === agentId);
    if (agent?.colonyId) push(`owns:spec-agent-${agent.colonyId}-${agentId}`, agent.colonyId, agentId, OWNERSHIP_STROKE);
  }
  for (const [subId] of Array.from(layout.subAgents)) {
    const sub = runtime.agents.find((a) => a.id === subId);
    if (sub?.parentId) push(`owns:agent-sub-${sub.parentId}-${subId}`, sub.parentId, subId, OWNERSHIP_STROKE);
  }
  for (const task of getVisibleOperations(runtime, expanded)) {
    if (task.ownerAgentId) push(`owns:agent-op-${task.ownerAgentId}-${task.id}`, task.ownerAgentId, task.id, OWNERSHIP_STROKE);
  }

  // Transient relationships: only from real runtime events, always animated,
  // always age out (swept by the store).
  for (const t of opts.tempEdges ?? []) {
    if (!visible.has(t.source) || !visible.has(t.target)) continue;
    const style =
      t.kind === "verification"
        ? { stroke: "hsl(var(--warning))", strokeWidth: 1.75 }
        : t.kind === "delegation"
        ? { stroke: "hsl(var(--info))", strokeWidth: 1.75, strokeDasharray: "6 4" }
        : { stroke: "hsl(var(--success))", strokeWidth: 1.75 };
    edges.push({
      id: `temp:${t.id}`,
      source: t.source,
      target: t.target,
      type: "default",
      animated: true,
      label: t.label,
      labelStyle: { fill: "hsl(var(--muted-foreground))", fontSize: 11 },
      style: {
        ...style,
        ...(focus && !edgeInFocus(t.source, t.target) ? dimTrue() : undefined),
      },
      data: { kind: t.kind, label: t.label },
    });
  }

  return edges;
}

/**
 * Single-pass graph derivation: the deterministic layout is computed once and
 * shared by the node and edge builders. Visibility is driven entirely by the
 * user's expand/collapse set, never by zoom.
 */
export function getTopologyGraph(
  runtime: WorkforceRuntime,
  expanded: ReadonlySet<string>,
  focusAgentId?: string,
  opts: {
    narrow?: boolean;
    flashes?: CompletionFlash[];
    tempEdges?: TempEdge[];
    activate?: (id: string, type: string) => void;
    expandAll?: () => void;
    allExpanded?: boolean;
    toggle?: (id: string, dim?: "sub" | "ops") => void;
    viewport?: ViewportSize;
  } = {}
): { nodes: Node[]; edges: Edge[] } {
  const layout = buildAdaptiveTopologyLayout(runtime, opts.narrow ?? false, opts.viewport);
  return {
    nodes: getTopologyNodes(runtime, expanded, focusAgentId, { ...opts, layout }),
    edges: getTopologyEdges(runtime, expanded, focusAgentId, { ...opts, layout }),
  };
}