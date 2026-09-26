import type { Edge, Node } from "@xyflow/react";
import type {
  AgentRuntime,
  BrainRuntime,
  ColonyRuntime,
  CompletionFlash,
  SystemRuntime,
  TaskRuntime,
  TempEdge,
  TopologyBand,
  WorkforceRuntime,
} from "./types";
import { buildTopologyLayout, type TopologyLayout } from "./layout";

/**
 * Zoom = information density, not scaling.
 *  < 0.8  → Brain + Specialist territories (overview)
 *  0.8+   → Agents (+ active states)
 *  1.3+   → Sub-agents + transient Operations + delegation
 *  2.0+   → deep operational metadata, verification, recovery
 */
export const ZOOM_THRESHOLDS = {
  AGENTS: 0.8,
  OPERATIONS: 1.3,
  METADATA: 2.0,
} as const;

export const BRAIN_NODE_ID = "brain";

export type TopologyNodeType = "brain" | "specialist" | "agent" | "subagent" | "operation" | "flash";

export interface TopologyNodeData<T = unknown> extends Record<string, unknown> {
  entity: T;
  band: TopologyBand;
  activate?: (id: string, type: string) => void;
}

const REMOVED_STATES = new Set(["cancelled", "stopped"]);
export const ATTENTION_PENDING_STATES = new Set(["waiting_for_approval", "blocked", "failed"]);
const ACTIVE_STATES = new Set(["executing", "thinking", "planning", "delegating", "retrying"]);
const WAITING_STATES = new Set(["waiting", "waiting_for_approval", "blocked"]);

const isLiveAgent = (a: AgentRuntime) => !REMOVED_STATES.has(a.runtimeState);

const dimStyle = (dimmed: boolean) => (dimmed ? { opacity: 0.2 } : undefined);

const bandFor = (zoom: number): TopologyBand =>
  zoom >= ZOOM_THRESHOLDS.OPERATIONS
    ? zoom >= ZOOM_THRESHOLDS.METADATA
      ? "metadata"
      : "operations"
    : zoom >= ZOOM_THRESHOLDS.AGENTS
    ? "agents"
    : "specialist";

export function getActiveOperations(runtime: WorkforceRuntime): TaskRuntime[] {
  return runtime.tasks.filter(
    (t) => t.status !== "COMPLETED" && t.status !== "CANCELLED"
  );
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

export function getVisibleAgents(runtime: WorkforceRuntime, zoom: number): AgentRuntime[] {
  if (zoom < ZOOM_THRESHOLDS.AGENTS) return [];
  return getLiveAgents(runtime).filter((a) => !a.parentId);
}

export function getVisibleSubAgents(runtime: WorkforceRuntime, zoom: number): AgentRuntime[] {
  if (zoom < ZOOM_THRESHOLDS.OPERATIONS) return [];
  return getLiveAgents(runtime).filter((a) => a.parentId);
}

export function getVisibleOperations(runtime: WorkforceRuntime, zoom: number): TaskRuntime[] {
  if (zoom < ZOOM_THRESHOLDS.OPERATIONS) return [];
  return getActiveOperations(runtime);
}

export function getHiddenTransientCounts(
  runtime: WorkforceRuntime,
  zoom: number,
  tempEdges: TempEdge[],
  flashes: CompletionFlash[]
): { tempEdges: number; flashes: number } {
  const visibleNodeIds = new Set<string>([BRAIN_NODE_ID]);
  for (const colony of runtime.colonies) {
    if (colony.status !== "ARCHIVED") visibleNodeIds.add(colony.id);
  }
  if (zoom >= ZOOM_THRESHOLDS.AGENTS) {
    for (const agent of getLiveAgents(runtime).filter((a) => !a.parentId)) visibleNodeIds.add(agent.id);
  }
  if (zoom >= ZOOM_THRESHOLDS.OPERATIONS) {
    for (const agent of getLiveAgents(runtime).filter((a) => a.parentId)) visibleNodeIds.add(agent.id);
    for (const task of getActiveOperations(runtime)) visibleNodeIds.add(task.id);
  }
  let hiddenTempEdges = 0;
  let hiddenFlashes = 0;
  for (const e of tempEdges) {
    if (!visibleNodeIds.has(e.source) || !visibleNodeIds.has(e.target)) hiddenTempEdges++;
  }
  for (const f of flashes) {
    if (!visibleNodeIds.has(f.entityId)) hiddenFlashes++;
  }
  return { tempEdges: hiddenTempEdges, flashes: hiddenFlashes };
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

export function getTopologyNodes(
  runtime: WorkforceRuntime,
  zoom: number,
  focusAgentId?: string,
  opts: {
    narrow?: boolean;
    flashes?: CompletionFlash[];
    activate?: (id: string, type: string) => void;
    layout?: TopologyLayout;
  } = {}
): Node[] {
  const layout = opts.layout ?? buildTopologyLayout(runtime, opts.narrow ?? false);
  const band = bandFor(zoom);
  const focus = focusAgentId ? focusContext(runtime, focusAgentId) : null;

  const nodes: Node[] = [];
  const visibleIds = new Set<string>([BRAIN_NODE_ID]);

  const isDimmed = (id: string, type: string): boolean => {
    if (!focus || id === BRAIN_NODE_ID) return false;
    if (type === "specialist") return !focus.territoryIds.has(id);
    if (type === "agent" || type === "subagent") return !focus.agentIds.has(id);
    if (type === "operation") return !focus.operationIds.has(id);
    return true;
  };

  const pushNode = (node: Node) => {
    visibleIds.add(node.id);
    nodes.push(node);
  };

  const activate = opts.activate;

  const brainData: TopologyNodeData<BrainRuntime> = {
    entity: runtime.brain,
    band,
    system: runtime.system as SystemRuntime,
    activate,
  };
  pushNode({
    id: BRAIN_NODE_ID,
    type: "brain",
    data: brainData as Record<string, unknown>,
    position: layout.brain,
    style: dimStyle(isDimmed(BRAIN_NODE_ID, "brain")),
    selectable: true,
    focusable: true,
  });

  for (const colony of getVisibleTerritories(runtime)) {
    const stats = getTerritoryStats(runtime, colony.id);
    const data: TopologyNodeData<ColonyRuntime> = {
      entity: colony,
      band,
      stats: { ...stats },
      activate,
    };
    pushNode({
      id: colony.id,
      type: "specialist",
      data: data as Record<string, unknown>,
      position: layout.territories.get(colony.id) ?? { x: 0, y: 0 },
      style: dimStyle(isDimmed(colony.id, "specialist")),
      selectable: true,
      focusable: true,
    });
  }

  if (zoom >= ZOOM_THRESHOLDS.AGENTS) {
    for (const agent of getVisibleAgents(runtime, zoom)) {
      const currentTask = agent.currentTaskId
        ? runtime.tasks.find((t) => t.id === agent.currentTaskId)
        : undefined;
      const data: TopologyNodeData<AgentRuntime> = {
        entity: agent,
        band,
        operation: currentTask?.description,
        activate,
      };
      pushNode({
        id: agent.id,
        type: "agent",
        data: data as Record<string, unknown>,
        position: layout.agents.get(agent.id) ?? { x: 0, y: 0 },
        style: dimStyle(isDimmed(agent.id, "agent")),
        selectable: true,
        focusable: true,
      });
    }
  }

  if (zoom >= ZOOM_THRESHOLDS.OPERATIONS) {
    for (const sub of getVisibleSubAgents(runtime, zoom)) {
      const currentTask = sub.currentTaskId
        ? runtime.tasks.find((t) => t.id === sub.currentTaskId)
        : undefined;
      const data: TopologyNodeData<AgentRuntime> = {
        entity: sub,
        band,
        operation: currentTask?.description,
        activate,
      };
      pushNode({
        id: sub.id,
        type: "subagent",
        data: data as Record<string, unknown>,
        position: layout.subAgents.get(sub.id) ?? { x: 0, y: 0 },
        style: dimStyle(isDimmed(sub.id, "subagent")),
        selectable: true,
        focusable: true,
      });
    }

    for (const task of getVisibleOperations(runtime, zoom)) {
      const owner = task.ownerAgentId
        ? runtime.agents.find((a) => a.id === task.ownerAgentId)
        : undefined;
      const data: TopologyNodeData<TaskRuntime> = {
        entity: task,
        band,
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
        focusable: true,
      });
    }
  }

  // Ephemeral completion/error transitions — swept by the runtime store.
  const flashes = opts.flashes ?? [];
  if (zoom >= ZOOM_THRESHOLDS.OPERATIONS && flashes.length > 0) {
    for (const flash of flashes) {
      const ownerPos =
        layout.agents.get(flash.entityId) ?? layout.subAgents.get(flash.entityId);
      if (!ownerPos) continue;
      const data = { entity: flash, band, activate } as Record<string, unknown>;
      pushNode({
        id: flash.id,
        type: "flash",
        data,
        position: { x: ownerPos.x, y: ownerPos.y + 58 },
        style: { pointerEvents: "none", ...dimStyle(isDimmed(flash.entityId, "agent")) },
        selectable: false,
        focusable: false,
      });
    }
  }

  return nodes;
}

const OWNERSHIP = "hsl(var(--border))";

export function getTopologyEdges(
  runtime: WorkforceRuntime,
  zoom: number,
  focusAgentId?: string,
  opts: { narrow?: boolean; tempEdges?: TempEdge[]; layout?: TopologyLayout } = {}
): Edge[] {
  const layout = opts.layout ?? buildTopologyLayout(runtime, opts.narrow ?? false);
  const focus = focusAgentId ? focusContext(runtime, focusAgentId) : null;

  const visibleNodeIds = new Set<string>([BRAIN_NODE_ID]);
  for (const id of Array.from(layout.territories.keys())) visibleNodeIds.add(id);
  if (zoom >= ZOOM_THRESHOLDS.AGENTS) {
    for (const id of Array.from(layout.agents.keys())) visibleNodeIds.add(id);
  }
  if (zoom >= ZOOM_THRESHOLDS.OPERATIONS) {
    for (const id of Array.from(layout.subAgents.keys())) visibleNodeIds.add(id);
    for (const id of Array.from(layout.operations.keys())) visibleNodeIds.add(id);
  }

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
  const push = (id: string, source: string, target: string) => {
    if (!visibleNodeIds.has(source) || !visibleNodeIds.has(target)) return;
    edges.push({
      id,
      source,
      target,
      type: "default",
      style: {
        stroke: OWNERSHIP,
        strokeWidth: 1,
        ...(focus && !edgeInFocus(source, target) ? dimTrue() : undefined),
      },
    });
  };

  // Structural ownership spine: thin, minimal — hierarchy is spatial.
  layout.territories.forEach((_, colonyId) => push(`owns:brain-spec-${colonyId}`, BRAIN_NODE_ID, colonyId));
  if (zoom >= ZOOM_THRESHOLDS.AGENTS) {
    for (const [agentId] of Array.from(layout.agents)) {
      const agent = runtime.agents.find((a) => a.id === agentId);
      if (agent?.colonyId) push(`owns:spec-agent-${agent.colonyId}-${agentId}`, agent.colonyId, agentId);
    }
  }
  if (zoom >= ZOOM_THRESHOLDS.OPERATIONS) {
    for (const [subId] of Array.from(layout.subAgents)) {
      const sub = runtime.agents.find((a) => a.id === subId);
      if (sub?.parentId) push(`owns:agent-sub-${sub.parentId}-${subId}`, sub.parentId, subId);
    }
    for (const task of getVisibleOperations(runtime, zoom)) {
      if (task.ownerAgentId) push(`owns:agent-op-${task.ownerAgentId}-${task.id}`, task.ownerAgentId, task.id);
    }
  }

  // Transient relationships: only from real runtime events, always animated,
  // always age out (swept by the store).
  if (zoom >= ZOOM_THRESHOLDS.OPERATIONS) {
    for (const t of opts.tempEdges ?? []) {
      if (!visibleNodeIds.has(t.source) || !visibleNodeIds.has(t.target)) continue;
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
        labelStyle: { fill: "hsl(var(--muted-foreground))", fontSize: 9 },
        style: {
          ...style,
          ...(focus && !edgeInFocus(t.source, t.target) ? dimTrue() : undefined),
        },
        data: { kind: t.kind, label: t.label },
      });
    }
  }

  return edges;
}

/**
 * Single-pass graph derivation: the deterministic layout is computed once and
 * shared by the node and edge builders. Avoids running the layout engine twice
 * on every render/zoom frame.
 */
export function getTopologyGraph(
  runtime: WorkforceRuntime,
  zoom: number,
  focusAgentId?: string,
  opts: {
    narrow?: boolean;
    flashes?: CompletionFlash[];
    tempEdges?: TempEdge[];
    activate?: (id: string, type: string) => void;
  } = {}
): { nodes: Node[]; edges: Edge[] } {
  const layout = buildTopologyLayout(runtime, opts.narrow ?? false);
  return {
    nodes: getTopologyNodes(runtime, zoom, focusAgentId, { ...opts, layout }),
    edges: getTopologyEdges(runtime, zoom, focusAgentId, { ...opts, layout }),
  };
}