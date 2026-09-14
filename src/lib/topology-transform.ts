/**
 * Topology data transform — converts raw /api/topology projection
 * into React Flow compatible nodes + edges.
 */

export interface TopologyNode {
  id: string;
  type: string;
  label: string;
  status: string;
  parent?: string;
  data: Record<string, unknown>;
  position?: { x: number; y: number };
}

export interface TopologyEdge {
  id: string;
  source: string;
  target: string;
  type: string;
}

export function transformProjection(projection: any): { nodes: TopologyNode[]; edges: TopologyEdge[] } {
  const rawNodes = projection?.projection?.nodes || [];
  const relationships = projection?.projection?.relationships || [];

  const nodes: TopologyNode[] = rawNodes.map((n: any) => ({
    id: n.id,
    type: n.type,
    label: n.label,
    status: n.status,
    parent: n.parent,
    data: n.data || {},
    position: { x: 0, y: 0 }, // D3-force will assign
  }));

  const nodeIds = new Set(nodes.map((n) => n.id));

  const edges: TopologyEdge[] = relationships
    .filter((r: any) => nodeIds.has(`agent:${r.fromId}`) || nodeIds.has(`colony:${r.fromId}`) || nodeIds.has(r.fromId))
    .map((r: any) => {
      // Resolve from/to IDs to topology node IDs
      const fromId = r.fromType === "agent" ? `agent:${r.fromId}` : r.fromType === "colony" ? `colony:${r.fromId}` : r.fromType === "mission" ? `mission:${r.fromId}` : r.fromId;
      const toId = r.toType === "agent" ? `agent:${r.toId}` : r.toType === "colony" ? `colony:${r.toId}` : r.toType === "mission" ? `mission:${r.toId}` : r.toId;

      return {
        id: `${fromId}-${r.relation}-${toId}`,
        source: fromId,
        target: toId,
        type: r.relation,
      };
    })
    .filter((e: { source: string; target: string }) => nodeIds.has(e.source) && nodeIds.has(e.target));

  return { nodes, edges };
}
