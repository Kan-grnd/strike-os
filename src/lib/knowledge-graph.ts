/**
 * Pure model for the Knowledge page.
 *
 * The page it replaces drew a flat list under the heading "Graph" and showed
 * connections as *types* (`agent → manages → agent`), which is meaningless the
 * moment two agents exist. Everything here exists to build a real graph of
 * *instances*: nodes are specific entities, edges are specific relationships,
 * and every node can be traced back to the row it came from.
 *
 * It is deliberately dependency-free and side-effect-free so the layout,
 * filtering and label logic can be reasoned about (and tested) without a
 * browser.
 */

import { safeJson } from "@/lib/utils";

export interface GraphRelationship {
  id: string;
  fromId: string;
  fromType: string;
  relation: string;
  toId: string;
  toType: string;
  metadata?: string | null;
  createdAt?: string | null;
}

export interface EntitySources {
  agents?: any[];
  colonies?: any[];
  missions?: any[];
  memories?: any[];
}

export type KnowledgeNode = {
  /** Stable React Flow id and lookup key: `${type}:${id}`. */
  key: string;
  id: string;
  type: string;
  label: string;
  subtitle: string | null;
  /** Present only when the entity has a real detail route. */
  href: string | null;
  degree: number;
};

export interface KnowledgeEdge {
  id: string;
  source: string;
  target: string;
  relation: string;
  metadata: Record<string, unknown>;
  createdAt: string | null;
}

export interface KnowledgeGraph {
  nodes: KnowledgeNode[];
  edges: KnowledgeEdge[];
  /** Relationships loaded but left out of the graph by the cap. */
  omitted: number;
}

export const MAX_EDGES = 200;

/* The layout engine lives in a dependency-free module (knowledge-layout) so its
 * geometry can be verified by scripts/check-graph-layout.ts without a browser.
 * Re-exported here so the page and node components keep one import surface. */
export {
  layoutKnowledgeGraph,
  isAgentType,
  sampleCubic,
  sampleRoute,
  SOURCE_WIDTH,
  SOURCE_HEIGHT,
  AGENT_WIDTH,
  AGENT_HEIGHT,
  CARD_RADIUS,
  GRID,
  AGENT_ROW_STEP,
  SOURCE_PORT_MIN_GAP,
  AGENT_PORT_MIN_GAP,
  PORT_MIN_GAP,
  PORT_SPACING,
  MIN_ROW_PITCH,
  MIN_COLUMN_GAP,
  MAX_COLUMN_GAP,
  MAX_SLOPE_DEG,
} from "@/lib/knowledge-layout";
export type {
  Cubic,
  KnowledgeLayout,
  LayoutBounds,
  LayoutCard,
  LayoutColumn,
  LayoutPort,
  LayoutRoute,
  LayoutZone,
  LayoutZone as LanePlacement,
  Pt,
  RouteKind,
  Side,
} from "@/lib/knowledge-layout";

export const nodeKey = (type: string, id: string) => `${type}:${id}`;

export function typeLabel(type: string): string {
  if (!type) return "Unknown";
  return type.charAt(0).toUpperCase() + type.slice(1);
}

const shortId = (id: string) => (id ? id.slice(0, 6) : "unknown");

const clip = (value: string, limit: number) =>
  value.length > limit ? `${value.slice(0, limit).trimEnd()}…` : value;

/** Relation words that read better with spaces than snake_case. */
const PLAIN_RELATIONS: Record<string, string> = {
  assigned_to: "assigned to",
  belongs_to: "belongs to",
  created_by: "created by",
  created_for: "created for",
  depends_on: "depends on",
  led_by: "led by",
  managed_by: "managed by",
  owned_by: "owned by",
};

/**
 * Display form of a relation: plain words for known machine names, otherwise the
 * raw name with any separators turned into spaces. Matching, filtering and
 * search keep using the raw relation — this is presentation only, so the same
 * relationship is easy to read on an arrow and exact to query in the filters.
 */
export function plainRelation(relation: string): string {
  if (!relation) return "related";
  if (PLAIN_RELATIONS[relation]) return PLAIN_RELATIONS[relation];
  return relation.replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim() || "related";
}

/**
 * Resolve one relationship endpoint to a displayable node. Missing entities are
 * not dropped — a relationship to a record that no longer exists is still a
 * relationship, and hiding its endpoint would silently break the graph. It is
 * instead labelled from its type and id so the user can see the dangling link.
 */
export function resolveEntity(
  type: string,
  id: string,
  sources: EntitySources
): KnowledgeNode {
  const key = nodeKey(type, id);

  if (type === "agent") {
    const a = sources.agents?.find((x) => x.id === id);
    return {
      key,
      id,
      type,
      label: a?.name ? clip(String(a.name), 48) : `Agent ${shortId(id)}`,
      subtitle: a?.runtimeState ?? a?.status ?? null,
      href: a ? `/workforce/agents/${id}` : null,
      degree: 0,
    };
  }

  if (type === "colony") {
    const c = sources.colonies?.find((x) => x.id === id);
    return {
      key,
      id,
      type,
      label: c?.name ? clip(String(c.name), 48) : `Territory ${shortId(id)}`,
      subtitle: c?.status ?? null,
      /* There is no colony detail route, so linking to the list would promise
         more than it delivers. Plain label wins over a misleading link. */
      href: null,
      degree: 0,
    };
  }

  if (type === "mission") {
    const m = sources.missions?.find((x) => x.id === id);
    return {
      key,
      id,
      type,
      label: m?.goal ? clip(String(m.goal), 48) : `Mission ${shortId(id)}`,
      subtitle: m?.status ?? null,
      href: m ? `/missions/${id}` : null,
      degree: 0,
    };
  }

  if (type === "memory") {
    const mem = sources.memories?.find((x) => x.id === id);
    const content = typeof mem?.content === "string" ? mem.content : "";
    return {
      key,
      id,
      type,
      label: content ? clip(content, 48) : `Memory ${shortId(id)}`,
      subtitle: mem?.source ?? null,
      href: null,
      degree: 0,
    };
  }

  return {
    key,
    id,
    type,
    label: `${typeLabel(type)} ${shortId(id)}`,
    subtitle: null,
    href: null,
    degree: 0,
  };
}

/** Parse a relationship's metadata defensively; never throws on bad JSON. */
export function parseMetadata(raw: unknown): Record<string, unknown> {
  const parsed = safeJson<unknown>(raw, {});
  return parsed && typeof parsed === "object" && !Array.isArray(parsed)
    ? (parsed as Record<string, unknown>)
    : {};
}

/**
 * Build the graph from relationships plus whatever entities could be resolved.
 * Nodes are only the endpoints relationships actually reference, so the graph
 * is as big as the data warrants rather than as big as the memory table.
 */
export function buildKnowledgeGraph(
  relationships: GraphRelationship[],
  sources: EntitySources
): KnowledgeGraph {
  const capped = relationships.slice(0, MAX_EDGES);
  const omitted = Math.max(0, relationships.length - capped.length);

  const nodes = new Map<string, KnowledgeNode>();
  const edges: KnowledgeEdge[] = [];

  for (const r of capped) {
    const from = resolveEntity(r.fromType, r.fromId, sources);
    const to = resolveEntity(r.toType, r.toId, sources);
    if (!nodes.has(from.key)) nodes.set(from.key, from);
    if (!nodes.has(to.key)) nodes.set(to.key, to);

    from.degree += 1;
    to.degree += 1;

    edges.push({
      id: r.id,
      source: from.key,
      target: to.key,
      relation: r.relation || "related",
      metadata: parseMetadata(r.metadata),
      createdAt: r.createdAt ?? null,
    });
  }

  return { nodes: Array.from(nodes.values()), edges, omitted };
}

/**
 * Categorical tone per entity type, used for the node rail, the lane title and
 * the legend. These are type identities, not states — the legend says so, so an
 * amber mission never reads as "blocked". Unknown types stay neutral.
 */
const TYPE_TONES: Record<string, string> = {
  colony: "hsl(var(--muted-foreground))",
  agent: "#1D9E75",
  mission: "hsl(var(--warning))",
  memory: "hsl(var(--success))",
};

export function typeTone(type: string): string {
  return TYPE_TONES[type] ?? "hsl(var(--muted-foreground))";
}

/**
 * Link ink per relationship type. Color AND dash pattern both carry the
 * meaning, so the types stay readable in grayscale. Colours are fixed hex
 * values (identical in light and dark mode); any other relationship gets a
 * solid neutral line plus its own legend entry.
 */
export interface EdgeInk {
  color: string;
  dashArray?: string;
  lineCap?: "round" | "butt";
  width: number;
  label: string;
}

const RELATION_INK: Record<string, EdgeInk> = {
  contains: { color: "#888780", width: 1.5, label: "contains" },
  assigned_to: { color: "#BA7517", dashArray: "9 5", width: 1.5, label: "assigned to" },
  manages: { color: "#1D9E75", dashArray: "0.5 5", lineCap: "round", width: 2, label: "manages" },
};

export function edgeStyleFor(relation: string): EdgeInk {
  return (
    RELATION_INK[relation] ?? {
      color: "hsl(var(--muted-foreground))",
      width: 1.5,
      label: plainRelation(relation),
    }
  );
}

/** Legend rows: the three known types first, then any other types present. */
export function legendEntries(relations: string[]): EdgeInk[] {
  const known = ["contains", "assigned_to", "manages"].filter((r) =>
    relations.includes(r)
  );
  const other = Array.from(new Set(relations))
    .filter((r) => !(r in RELATION_INK))
    .sort();
  return [...known, ...other].map(edgeStyleFor);
}

export interface GraphFilters {
  term: string;
  relation: string;
  entityType: string;
}

export const EMPTY_FILTERS: GraphFilters = { term: "", relation: "", entityType: "" };

/** Distinct relation names present, for the filter dropdown. */
export function relationOptions(edges: KnowledgeEdge[]): string[] {
  return Array.from(new Set(edges.map((e) => e.relation))).sort();
}

/** Distinct entity types present, for the filter dropdown. */
export function entityTypeOptions(nodes: KnowledgeNode[]): string[] {
  return Array.from(new Set(nodes.map((n) => n.type))).sort();
}

/**
 * Apply search + relation + entity-type filters with AND semantics.
 *
 * The entity-type filter means "relationships involving this type", not "only
 * nodes of this type": keeping an edge only when *both* endpoints pass would
 * make selecting `colony` drop every contains edge (colony → agent) and report
 * a false empty graph. An edge therefore survives when either endpoint is of
 * the chosen type.
 *
 * A search term may name a relation as readily as an entity, so a term match on
 * the relation itself keeps the edge, and a match on either endpoint keeps that
 * node's neighbourhood — otherwise searching "manages" would draw nothing.
 */
export function filterGraph(
  graph: KnowledgeGraph,
  filters: GraphFilters
): KnowledgeGraph {
  const term = filters.term.trim().toLowerCase();
  const { relation, entityType } = filters;
  const byKey = new Map(graph.nodes.map((n) => [n.key, n]));

  const nodeMatches = (n: KnowledgeNode) =>
    !term ||
    n.label.toLowerCase().includes(term) ||
    n.type.toLowerCase().includes(term) ||
    n.id.toLowerCase().includes(term) ||
    (n.subtitle ?? "").toLowerCase().includes(term);

  const edges = graph.edges.filter((e) => {
    if (relation && e.relation !== relation) return false;

    const source = byKey.get(e.source);
    const target = byKey.get(e.target);
    if (entityType && source?.type !== entityType && target?.type !== entityType) {
      return false;
    }

    if (!term) return true;
    if (e.relation.toLowerCase().includes(term)) return true;
    return (!!source && nodeMatches(source)) || (!!target && nodeMatches(target));
  });

  const touched = new Set<string>();
  for (const e of edges) {
    touched.add(e.source);
    touched.add(e.target);
  }

  /* With no relationships at all there is nothing to traverse, so fall back to
     matching isolated nodes by the term rather than showing an empty canvas. */
  const nodes =
    graph.edges.length === 0
      ? graph.nodes.filter(nodeMatches)
      : graph.nodes.filter((n) => touched.has(n.key));

  return { nodes, edges, omitted: graph.omitted };
}

export const hasActiveFilters = (f: GraphFilters) =>
  f.term.trim().length > 0 || f.relation.length > 0 || f.entityType.length > 0;
