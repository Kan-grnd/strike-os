"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  type Edge,
  type Node,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import {
  Loader2,
  Maximize,
  Network,
  Palette,
  RefreshCw,
  RotateCcw,
  Search,
  Settings,
  SlidersHorizontal,
  TriangleAlert,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EmptyState } from "@/components/ui/empty-state";
import { KnowledgeNode } from "@/components/knowledge/knowledge-node";
import { KnowledgeLane } from "@/components/knowledge/knowledge-lane";
import {
  KnowledgeEdge,
  type KnowledgeEdgeData,
} from "@/components/knowledge/knowledge-edge";
import {
  KnowledgeInspector,
  type KnowledgeSelection,
} from "@/components/knowledge/knowledge-inspector";
import {
  useAgents,
  useColonies,
  useMemories,
  useMissions,
  useRelationships,
} from "@/hooks/useApi";
import {
  buildKnowledgeGraph,
  edgeStyleFor,
  EMPTY_FILTERS,
  entityTypeOptions,
  filterGraph,
  hasActiveFilters,
  layoutKnowledgeGraph,
  legendEntries,
  plainRelation,
  relationOptions,
  typeLabel,
  typeTone,
  type GraphFilters,
  type KnowledgeGraph,
  type LayoutCard,
  type LayoutZone,
} from "@/lib/knowledge-graph";
import { cn } from "@/lib/utils";

const nodeTypes = { knowledge: KnowledgeNode, lane: KnowledgeLane };
const edgeTypes = { knowledge: KnowledgeEdge };

/**
 * One pass, two products: the placed nodes (each carrying its own pixel ports)
 * and the routed edges. All geometry comes from `layoutKnowledgeGraph`, which is
 * verified without a browser by scripts/check-graph-layout.ts — the page only
 * adapts it to React Flow, so what ships is the same picture the checker proved.
 */
function buildRfGraph(
  graph: KnowledgeGraph,
  activeKeys: Set<string> | null,
  activeEdgeIds: Set<string> | null
): { nodes: Node[]; edges: Edge[] } {
  const layout = layoutKnowledgeGraph(
    graph.nodes.map((n) => ({
      key: n.key,
      type: n.type,
      label: n.label,
      degree: n.degree,
    })),
    graph.edges.map((e) => ({ id: e.id, source: e.source, target: e.target }))
  );

  const cardOf = new Map<string, LayoutCard>(
    layout.cards.map((c) => [c.key, c])
  );
  const routeOf = new Map(layout.routes.map((r) => [r.edgeId, r]));

  const lanes: Node[] = layout.zones.map((zone: LayoutZone) => ({
    id: zone.key,
    type: "lane",
    position: { x: zone.x, y: zone.y },
    data: zone as unknown as Record<string, unknown>,
    draggable: false,
    selectable: false,
    connectable: false,
    focusable: false,
    deletable: false,
    zIndex: -1,
    className: "!pointer-events-none",
  }));

  /* The "N links" counter must equal the number of lines actually drawn, not
   * the entity's total degree. Recompute from the edges this view renders so
   * the badge is always honest — a filtered view never claims links that
   * aren't on the canvas. */
  const visibleDegree = new Map<string, number>();
  for (const e of graph.edges) {
    visibleDegree.set(e.source, (visibleDegree.get(e.source) ?? 0) + 1);
    visibleDegree.set(e.target, (visibleDegree.get(e.target) ?? 0) + 1);
  }

  const dimming = activeKeys !== null;
  const entities: Node[] = graph.nodes.map((n) => {
    const card = cardOf.get(n.key);
    const width = card?.width ?? 170;
    const height = card?.height ?? 76;
    return {
      id: n.key,
      type: "knowledge",
      position: {
        x: (card?.x ?? 0) - width / 2,
        y: (card?.y ?? 0) - height / 2,
      },
      data: {
        ...n,
        width,
        height,
        ports: card?.ports ?? [],
        degree: visibleDegree.get(n.key) ?? 0,
        active: activeKeys?.has(n.key) ?? false,
        dimmed: dimming && !(activeKeys?.has(n.key) ?? false),
      },
      draggable: false,
    };
  });

  const hasFocus = activeEdgeIds !== null;
  const edges: Edge[] = graph.edges.map((e) => {
    const active = activeEdgeIds?.has(e.id) ?? false;
    const dimmed = hasFocus && !active;
    const route = routeOf.get(e.id);
    /* Link ink comes from the relationship type (colour + dash pattern), never
     * from focus state: focusing boosts the width but keeps the type readable
     * so a selected amber dash still reads as "assigned to". */
    const ink = edgeStyleFor(e.relation);
    const data: KnowledgeEdgeData = {
      d: route?.path ?? "",
      arrow: route?.arrow ?? { x: 0, y: 0 },
      arrowAngle: route?.arrowAngle ?? 0,
      labelAt: route?.labelAt ?? { x: 0, y: 0 },
      color: ink.color,
      dashArray: ink.dashArray,
      lineCap: ink.lineCap,
      strokeWidth: ink.width + (active ? 0.75 : 0),
      active,
      dimmed,
      label: active ? plainRelation(e.relation) : "",
    };
    return {
      id: e.id,
      source: e.source,
      target: e.target,
      type: "knowledge",
      data: data as unknown as Record<string, unknown>,
      selectable: true,
      focusable: true,
    };
  });

  return { nodes: [...lanes, ...entities], edges };
}

/**
 * The canvas owns the initial fit only. Refitting on every filter change would
 * throw the camera around under the user's hands, so after the first frame the
 * camera belongs to the user; the toolbar's Fit button restores the fitted view.
 */
function Canvas({
  nodes,
  edges,
  onSelectNode,
  onSelectEdge,
  onPaneClick,
}: {
  nodes: Node[];
  edges: Edge[];
  onSelectNode: (key: string) => void;
  onSelectEdge: (id: string) => void;
  onPaneClick: () => void;
}) {
  const { fitView } = useReactFlow();
  const fitted = useRef(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (fitted.current || nodes.length === 0) return;
    fitted.current = true;
    requestAnimationFrame(() => fitView({ padding: 0.2, maxZoom: 1 }));
  }, [nodes.length, fitView]);

  /* Hover highlighting is applied straight to the DOM rather than through
   * React state: rebuilding the nodes array on hover would replace the node
   * under the cursor mid-gesture and swallow the click. The behaviour matches
   * the selection focus — the hovered node and its neighbours stay lit while
   * everything else dims. */
  useEffect(() => {
    const root = wrapRef.current;
    if (!root) return;
    const incident = new Map<string, Set<string>>();
    const neighbours = new Map<string, Set<string>>();
    const touch = (key: string) => {
      if (!incident.has(key)) incident.set(key, new Set());
      if (!neighbours.has(key)) neighbours.set(key, new Set());
      return { edges: incident.get(key)!, nodes: neighbours.get(key)! };
    };
    for (const e of edges) {
      const a = touch(e.source);
      const b = touch(e.target);
      a.edges.add(e.id);
      a.nodes.add(e.target);
      b.edges.add(e.id);
      b.nodes.add(e.source);
    }

    let hovered: string | null = null;
    const reset = () => {
      for (const el of Array.from(root.querySelectorAll<HTMLElement>(".react-flow__node-knowledge")))
        el.style.opacity = "";
      for (const el of Array.from(root.querySelectorAll<HTMLElement>(".react-flow__edge")))
        el.style.opacity = "";
    };
    const apply = (key: string) => {
      const set = incident.get(key);
      const nbrs = neighbours.get(key);
      if (!set) return;
      for (const el of Array.from(root.querySelectorAll<HTMLElement>(".react-flow__node-knowledge"))) {
        const id = el.getAttribute("data-id");
        el.style.opacity = id === key || nbrs?.has(id ?? "") ? "" : "0.25";
      }
      for (const el of Array.from(root.querySelectorAll<HTMLElement>(".react-flow__edge"))) {
        el.style.opacity = set.has(el.getAttribute("data-id") ?? "") ? "" : "0.12";
      }
    };
    const onOver = (event: Event) => {
      const target = event.target as HTMLElement | null;
      const node = target?.closest?.(".react-flow__node-knowledge");
      const id = node?.getAttribute("data-id") ?? null;
      if (id === hovered) return;
      hovered = id;
      if (id) apply(id);
      else reset();
    };
    const onLeave = () => {
      hovered = null;
      reset();
    };
    const onDown = () => {
      hovered = null;
      reset();
    };
    root.addEventListener("mouseover", onOver);
    root.addEventListener("mouseleave", onLeave);
    root.addEventListener("pointerdown", onDown);
    return () => {
      root.removeEventListener("mouseover", onOver);
      root.removeEventListener("mouseleave", onLeave);
      root.removeEventListener("pointerdown", onDown);
    };
  }, [edges]);

  return (
    <div ref={wrapRef} className="absolute inset-0">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        onNodeClick={(_, node) => {
          if (node.type === "knowledge") onSelectNode(node.id);
        }}
        onEdgeClick={(_, edge) => onSelectEdge(edge.id)}
        onPaneClick={onPaneClick}
        nodesDraggable={false}
        nodesConnectable={false}
        edgesReconnectable={false}
        minZoom={0.2}
        maxZoom={1.5}
        proOptions={{ hideAttribution: true }}
        className="[&_.react-flow__node-knowledge]:cursor-pointer"
      />
    </div>
  );
}

function KnowledgePageInner() {
  const { fitView } = useReactFlow();
  const relationships = useRelationships();
  const agents = useAgents();
  const colonies = useColonies();
  const missions = useMissions();
  const memories = useMemories();

  const error =
    relationships.error ||
    agents.error ||
    colonies.error ||
    missions.error ||
    memories.error;

  const loading =
    !error &&
    (relationships.isLoading ||
      agents.isLoading ||
      colonies.isLoading ||
      missions.isLoading ||
      memories.isLoading);

  const [filters, setFilters] = useState<GraphFilters>(EMPTY_FILTERS);
  const [selection, setSelection] = useState<KnowledgeSelection>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [controlsOpen, setControlsOpen] = useState(false);

  const graph = useMemo(
    () =>
      buildKnowledgeGraph(relationships.data?.relationships ?? [], {
        agents: agents.data?.agents,
        colonies: colonies.data?.colonies,
        missions: missions.data?.missions,
        memories: memories.data?.memories,
      }),
    [relationships.data, agents.data, colonies.data, missions.data, memories.data]
  );

  const filtered = useMemo(() => filterGraph(graph, filters), [graph, filters]);
  const relations = useMemo(() => relationOptions(graph.edges), [graph.edges]);
  const entityTypes = useMemo(() => entityTypeOptions(graph.nodes), [graph.nodes]);

  const focusKey = selection?.kind === "node" ? selection.key : null;
  const focusEdgeId = selection?.kind === "edge" ? selection.id : null;

  /* Focus is a one-hop authored neighbourhood, never an inferred one: the
   * selected node plus the entities it is actually related to. */
  const activeKeys = useMemo(() => {
    if (focusKey) {
      const keys = new Set<string>([focusKey]);
      for (const e of filtered.edges) {
        if (e.source === focusKey) keys.add(e.target);
        if (e.target === focusKey) keys.add(e.source);
      }
      return keys;
    }
    if (focusEdgeId) {
      const edge = filtered.edges.find((e) => e.id === focusEdgeId);
      return edge ? new Set([edge.source, edge.target]) : new Set<string>();
    }
    return null;
  }, [focusKey, focusEdgeId, filtered.edges]);

  const activeEdgeIds = useMemo(() => {
    if (focusKey) {
      return new Set(
        filtered.edges
          .filter((e) => e.source === focusKey || e.target === focusKey)
          .map((e) => e.id)
      );
    }
    if (focusEdgeId) return new Set([focusEdgeId]);
    return null;
  }, [focusKey, focusEdgeId, filtered.edges]);

  const rfGraph = useMemo(
    () => buildRfGraph(filtered, activeKeys, activeEdgeIds),
    [filtered, activeKeys, activeEdgeIds]
  );

  const active = hasActiveFilters(filters);
  const linkLegend = legendEntries(relations);

  /* Deep-linkable state, matching the diagram grammar: `#focus=<key>` opens a
   * node, `#lens=<type>` selects an entity type. Read on mount and on
   * `hashchange` so a pasted link and the browser's back/forward both work. */
  useEffect(() => {
    if (typeof window === "undefined") return;
    const apply = () => {
      const params = new URLSearchParams(window.location.hash.replace(/^#/, ""));
      const lens = params.get("lens");
      const focus = params.get("focus");
      if (lens) setFilters((f) => ({ ...f, entityType: lens }));
      if (focus) setSelection({ kind: "node", key: focus });
    };
    apply();
    window.addEventListener("hashchange", apply);
    return () => window.removeEventListener("hashchange", apply);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams();
    if (selection?.kind === "node") params.set("focus", selection.key);
    if (filters.entityType) params.set("lens", filters.entityType);
    const hash = params.toString();
    window.history.replaceState(
      null,
      "",
      `${window.location.pathname}${window.location.search}${hash ? `#${hash}` : ""}`
    );
  }, [selection, filters.entityType]);

  /* Controls popup: Escape closes the panel, and opening it moves focus into
   * the search field so the controls are immediately keyboard-usable. */
  useEffect(() => {
    if (!controlsOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setControlsOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [controlsOpen]);

  useEffect(() => {
    if (!controlsOpen) return;
    const el = document.getElementById("knowledge-search");
    el?.focus();
  }, [controlsOpen]);

  async function refresh() {
    setRefreshing(true);
    try {
      await Promise.all([
        relationships.mutate(),
        agents.mutate(),
        colonies.mutate(),
        missions.mutate(),
        memories.mutate(),
      ]);
    } finally {
      setRefreshing(false);
    }
  }

  const isLoadingFirst = loading && graph.edges.length === 0;

  let pane: ReactNode;
  if (isLoadingFirst) {
    pane = (
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-sm text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin motion-reduce:animate-none" aria-hidden />
        Loading graph…
      </div>
    );
  } else if (error) {
    pane = (
      <div className="absolute inset-0 flex items-center justify-center p-6">
        <EmptyState
          className="glass bg-card/60"
          icon={TriangleAlert}
          title="Could not load the knowledge graph"
          description="The relationships or entities could not be read. Check the connection and try again."
          action={
            <Button variant="outline" onClick={refresh} disabled={refreshing}>
              {refreshing ? "Retrying…" : "Retry"}
            </Button>
          }
        />
      </div>
    );
  } else if (graph.edges.length === 0) {
    pane = (
      <div className="absolute inset-0 flex items-center justify-center p-6">
        <EmptyState
          className="glass bg-card/60"
          icon={Network}
          title="No relationships yet"
          description="Relationships are written by the runtime as agents are organised into territories and assigned to missions. There is nothing to draw until the workforce creates its first link."
          cta="Open topology"
          ctaHref="/topology"
        />
      </div>
    );
  } else if (filtered.edges.length === 0) {
    pane = (
      <div className="absolute inset-0 flex items-center justify-center p-6">
        <EmptyState
          className="glass bg-card/60"
          icon={Search}
          title="No relationships match these filters"
          description={`${graph.edges.length} relationships exist across the graph, but none match the current search or filters.`}
          action={
            <Button variant="outline" onClick={() => setFilters(EMPTY_FILTERS)}>
              Reset filters
            </Button>
          }
        />
      </div>
    );
  } else {
    pane = (
      <Canvas
        nodes={rfGraph.nodes}
        edges={rfGraph.edges}
        onSelectNode={(key) => setSelection({ kind: "node", key })}
        onSelectEdge={(id) => setSelection({ kind: "edge", id })}
        onPaneClick={() => {
          setSelection(null);
          setControlsOpen(false);
        }}
      />
    );
  }

  const countLabel = active
    ? `Showing ${filtered.edges.length} of ${graph.edges.length} relationships`
    : `${graph.edges.length} ${graph.edges.length === 1 ? "relationship" : "relationships"} across ${graph.nodes.length} ${graph.nodes.length === 1 ? "entity" : "entities"}`;

  return (
    <div className="relative h-full w-full overflow-hidden">
      {pane}

      {/* Caption chip — the diagram's name and truthful count. */}
      <div className="pointer-events-none absolute left-3 sm:left-4 top-3 sm:top-4 z-40 max-w-[calc(100%-2rem)]">
        <div className="flex items-baseline gap-1.5 rounded-full border glass-elevated px-3 py-1.5 text-xs">
          <h1 className="truncate font-semibold">Knowledge Graph</h1>
          <p
            role="status"
            aria-live="polite"
            className="truncate tabular-nums text-muted-foreground"
          >
            {error ? "Could not load the graph" : countLabel}
            {!error && graph.omitted > 0 ? ` · showing first ${graph.edges.length}` : ""}
          </p>
        </div>
      </div>

      {/* Reading guide — plain language helper so the flow is immediately clear. */}
      <div className="pointer-events-none absolute top-3 left-1/2 -translate-x-1/2 z-30 hidden md:block">
        <div className="rounded-full border border-border/60 bg-background/80 px-3 py-1 text-xs text-muted-foreground shadow-sm backdrop-blur-sm">
          Follow each line to its arrowhead to see who does what to another.
        </div>
      </div>

      {/* Link-type legend — colour and dash pattern both carry the meaning. */}
      {graph.edges.length > 0 && !error ? (
        <div
          id="knowledge-link-legend"
          className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 z-30 hidden md:block"
        >
          <div className="flex items-center gap-4 rounded-full border glass-elevated px-4 py-1.5 text-xs text-muted-foreground">
            {linkLegend.map((ink) => (
              <span key={ink.label} className="flex items-center gap-1.5">
                <svg width="34" height="8" aria-hidden>
                  <line
                    x1="1"
                    y1="4"
                    x2="33"
                    y2="4"
                    stroke={ink.color}
                    strokeWidth={ink.width}
                    strokeDasharray={ink.dashArray}
                    strokeLinecap={ink.lineCap ?? "round"}
                  />
                </svg>
                <span>{ink.label}</span>
              </span>
            ))}
          </div>
        </div>
      ) : null}

      {/* Floating popup button — bottom-left corner with Settings gear icon */}
      <div className="absolute left-3 sm:left-4 bottom-3 sm:bottom-4 z-40">
        <Button
          variant="outline"
          size="icon"
          aria-label="Graph controls"
          aria-expanded={controlsOpen}
          aria-controls="knowledge-controls-panel"
          className={cn(
            "h-11 w-11 rounded-full border glass-elevated shadow-lg transition-transform",
            controlsOpen && "bg-primary text-primary-foreground border-primary hover:bg-primary/90"
          )}
          onClick={() => setControlsOpen((prev) => !prev)}
        >
          <Settings className={cn("h-5 w-5", controlsOpen && "text-primary-foreground")} aria-hidden />
        </Button>
      </div>

      {/* Unified Controls Popup Panel — opens upward from the bottom-left button */}
      <div
        id="knowledge-controls-panel"
        className={cn(
          "pointer-events-auto absolute left-3 sm:left-4 bottom-16 z-50 w-72 max-w-[calc(100vw-2rem)] rounded-xl border glass-elevated p-3 shadow-xl backdrop-blur-md",
          controlsOpen ? "block" : "hidden"
        )}
      >
        {/* Search section */}
        <div id="knowledge-search-panel">
          <Label htmlFor="knowledge-search" className="mb-1 block text-xs font-medium">
            Search entities and relations
          </Label>
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              id="knowledge-search"
              value={filters.term}
              onChange={(e) => setFilters((f) => ({ ...f, term: e.target.value }))}
              placeholder="Name, id, relation…"
              className="h-9 pl-9 pr-9"
            />
            {filters.term ? (
              <button
                type="button"
                onClick={() => setFilters((f) => ({ ...f, term: "" }))}
                aria-label="Clear search"
                className="absolute right-2 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-xl text-muted-foreground hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <X className="h-3.5 w-3.5" aria-hidden />
              </button>
            ) : null}
          </div>
        </div>

        {/* Filters section */}
        <div id="knowledge-filters" className="mt-3">
          <Label htmlFor="knowledge-relation" className="mb-1 block text-xs font-medium">
            Relation
          </Label>
          <Select
            value={filters.relation || "all"}
            onValueChange={(v) =>
              setFilters((f) => ({ ...f, relation: v === "all" ? "" : v }))
            }
          >
            <SelectTrigger id="knowledge-relation" className="h-8 w-full" aria-label="Filter by relation">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All relations</SelectItem>
              {relations.map((r) => (
                <SelectItem key={r} value={r}>
                  {r}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Label htmlFor="knowledge-type" className="mt-2.5 mb-1 block text-xs font-medium">
            Entity type
          </Label>
          <Select
            value={filters.entityType || "all"}
            onValueChange={(v) =>
              setFilters((f) => ({ ...f, entityType: v === "all" ? "" : v }))
            }
          >
            <SelectTrigger id="knowledge-type" className="h-8 w-full" aria-label="Filter by entity type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All types</SelectItem>
              {entityTypes.map((t) => (
                <SelectItem key={t} value={t}>
                  {typeLabel(t)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {active ? (
            <Button
              variant="ghost"
              size="sm"
              className="mt-2.5 h-7 px-2.5 text-xs text-muted-foreground hover:text-foreground"
              onClick={() => setFilters(EMPTY_FILTERS)}
            >
              <RotateCcw className="mr-1.5 h-3.5 w-3.5" aria-hidden />
              Reset
            </Button>
          ) : null}
        </div>

        {/* Actions section */}
        <div className="my-2.5 h-px bg-border/60" />
        <div className="flex items-center gap-1.5">
          <Button
            variant="outline"
            size="sm"
            className="flex-1 h-8 text-xs justify-center"
            onClick={refresh}
            disabled={refreshing}
          >
            <RefreshCw
              className={cn(
                "mr-1.5 h-3.5 w-3.5",
                refreshing && "animate-spin motion-reduce:animate-none"
              )}
              aria-hidden
            />
            Refresh
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="flex-1 h-8 text-xs justify-center"
            onClick={() => fitView({ padding: 0.2, maxZoom: 1 })}
          >
            <Maximize className="mr-1.5 h-3.5 w-3.5" aria-hidden />
            Fit view
          </Button>
        </div>

        {/* Legend section */}
        {graph.edges.length > 0 && !error ? (
          <>
            <div className="my-2.5 h-px bg-border/60" />
            <div id="knowledge-legend" tabIndex={-1}>
              <p className="mb-1.5 text-[11px] font-medium text-muted-foreground">Entity Types</p>
              <div className="grid grid-cols-2 gap-1.5">
                {entityTypes.map((t) => (
                  <div key={t} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <span
                      className="h-2 w-2 rounded-full shrink-0"
                      style={{ background: typeTone(t) }}
                      aria-hidden
                    />
                    <span className="truncate">{typeLabel(t)}</span>
                  </div>
                ))}
              </div>
            </div>
          </>
        ) : null}
      </div>

      <KnowledgeInspector
        selection={selection}
        nodes={graph.nodes}
        edges={graph.edges}
        visibleEdges={filtered.edges}
        onSelect={setSelection}
        onClose={() => setSelection(null)}
      />
    </div>
  );
}

export default function KnowledgePage() {
  return (
    <ReactFlowProvider>
      <KnowledgePageInner />
    </ReactFlowProvider>
  );
}
