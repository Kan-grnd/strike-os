"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  type Node,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import { ConnectionBadge } from "@/components/topology/connection-badge";
import { BrainNode } from "@/components/topology/nodes/brain-node";
import { SpecialistNode } from "@/components/topology/nodes/specialist-node";
import { AgentNode } from "@/components/topology/nodes/agent-node";
import { SubAgentNode } from "@/components/topology/nodes/subagent-node";
import { OperationNode } from "@/components/topology/nodes/operation-node";
import { FlashNode } from "@/components/topology/nodes/flash-node";
import { InspectorPanel, type InspectorSelection } from "@/components/topology/inspector-panel";
import { useSubscribeRuntime, useTopologyGraph, useRuntime, useConnection, useResync, useTempEdges, useFlashes } from "@/lib/runtime/useRuntime";
import { getLiveAgents } from "@/lib/runtime/selectors";
import {
  FIT_MIN_ZOOM,
  NO_INSETS,
  VIEWPORT_DEADBAND,
  fitTransformFor,
  graphFitsIn,
  narrowFor,
  type Insets,
  type Placed,
} from "@/lib/runtime/layout";
import { Loader2, Plus, RefreshCw, Scan, WifiOff, X, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const nodeTypes = {
  brain: BrainNode,
  specialist: SpecialistNode,
  agent: AgentNode,
  subagent: SubAgentNode,
  operation: OperationNode,
  flash: FlashNode,
};

/** Marks a floating element the camera has to keep clear of. It lives on the
 *  inspector, the one panel big enough to sit on top of a branch. Corner chips
 *  — the legend, the connection badge — are deliberately not marked:
 *  they overlap a corner of the pane, and displacing the whole graph to clear
 *  one would shove the graph sideways to avoid a small box. */
const OVERLAY_ATTR = "data-topology-overlay";

/** An overlay may not claim more than this share of the pane edge it covers.
 *  Without a cap, a full-width inspector sheet on a phone would leave a sliver
 *  to frame the whole graph in and the fit would collapse to a speck. */
const MAX_INSET_RATIO = 1 / 3;

/** Sub-pixel slack when deciding which pane edge an overlay is hugging. */
const EDGE_SLOP = 1;

function TopologyCanvas() {
  useSubscribeRuntime();
  const [expandedNodes, setExpandedNodes] = useState<ReadonlySet<string>>(new Set());
  const [focusAgentId, setFocusAgentId] = useState<string | null>(null);
  const [selection, setSelection] = useState<InspectorSelection | null>(null);
  const [narrow, setNarrowState] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const { getNodes, getNodesBounds, getViewport, setViewport } = useReactFlow();
  const runtime = useRuntime();
  const connection = useConnection();
  const resync = useResync();
  const tempEdges = useTempEdges();
  const flashes = useFlashes();

  /* ── Pane measurement ──────────────────────────────────────────────────────
   * The container is observed on one element that exists in every state,
   * loading and empty included. It used to be the canvas div, which is not
   * mounted until the runtime has loaded: the observer attached to the loading
   * placeholder, kept watching a detached node afterwards, and the pane size
   * the camera used was never the real one. */
  const [paneSize, setPaneSize] = useState<{ w: number; h: number } | null>(null);
  const narrowRef = useRef(false);
  const applyNarrow = useCallback((next: boolean) => {
    if (narrowRef.current === next) return;
    narrowRef.current = next;
    setNarrowState(next);
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const { width, height } = entries[0]?.contentRect ?? { width: 0, height: 0 };
      applyNarrow(narrowFor(width, narrowRef.current));
      setPaneSize((prev) =>
        prev && Math.abs(prev.w - width) < 2 && Math.abs(prev.h - height) < 2
          ? prev
          : { w: width, h: height }
      );
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [applyNarrow]);

  /* ── Overlay insets ────────────────────────────────────────────────────────
   * Panels float above the canvas, so they cover part of it without changing
   * its size. Rather than hard-code how wide any of them is, every overlay is
   * measured and whichever pane edges it reaches become insets, which the
   * camera then frames inside. Overlays appear, animate and disappear, so the
   * measurement watches both the subtree and the elements themselves. */
  const [insets, setInsets] = useState<Insets>(NO_INSETS);
  const insetsRef = useRef<Insets>(NO_INSETS);
  useLayoutEffect(() => {
    insetsRef.current = insets;
  }, [insets]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    let frame = 0;
    let watched: HTMLElement[] = [];
    const measure = () => {
      frame = 0;
      const box = el.getBoundingClientRect();
      if (box.width <= 0 || box.height <= 0) return;
      const next: Insets = { top: 0, right: 0, bottom: 0, left: 0 };
      for (const node of watched) {
        const r = node.getBoundingClientRect();
        if (r.width <= 0 || r.height <= 0) continue;
        if (r.right >= box.right - EDGE_SLOP) {
          next.right = Math.max(next.right, Math.max(0, box.right - r.left));
        }
        if (r.left <= box.left + EDGE_SLOP) {
          next.left = Math.max(next.left, Math.max(0, r.right - box.left));
        }
        if (r.top <= box.top + EDGE_SLOP) {
          next.top = Math.max(next.top, Math.max(0, r.bottom - box.top));
        }
        if (r.bottom >= box.bottom - EDGE_SLOP) {
          next.bottom = Math.max(next.bottom, Math.max(0, box.bottom - r.top));
        }
      }
      const capped: Insets = {
        top: Math.min(next.top, box.height * MAX_INSET_RATIO),
        right: Math.min(next.right, box.width * MAX_INSET_RATIO),
        bottom: Math.min(next.bottom, box.height * MAX_INSET_RATIO),
        left: Math.min(next.left, box.width * MAX_INSET_RATIO),
      };
      const prev = insetsRef.current;
      const same =
        Math.abs(prev.top - capped.top) < 1 &&
        Math.abs(prev.right - capped.right) < 1 &&
        Math.abs(prev.bottom - capped.bottom) < 1 &&
        Math.abs(prev.left - capped.left) < 1;
      if (!same) setInsets(capped);
    };
    const schedule = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(measure);
    };
    const observer = new ResizeObserver(schedule);
    const apply = () => {
      const found = Array.from(el.querySelectorAll<HTMLElement>(`[${OVERLAY_ATTR}]`));
      for (const node of watched) if (!found.includes(node)) observer.unobserve(node);
      for (const node of found) if (!watched.includes(node)) observer.observe(node);
      watched = found;
      schedule();
    };
    const mutations = new MutationObserver(apply);
    mutations.observe(el, { childList: true, subtree: true });
    apply();
    return () => {
      mutations.disconnect();
      observer.disconnect();
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  // A focus that outlives its worker leaves the graph permanently dimmed with
  // no card to un-dim, so drop the focus the moment that agent is gone.
  useEffect(() => {
    if (!focusAgentId) return;
    if (!runtime) return;
    if (getLiveAgents(runtime).some((a) => a.id === focusAgentId)) return;
    setFocusAgentId(null);
  }, [focusAgentId, runtime]);

  // Escape closes the inspector wherever focus lives (the dialog keeps its own
  // handler as a backup; both do the same thing).
  useEffect(() => {
    if (!selection) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSelection(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selection]);

  const openInspector = useCallback((id: string, type: string) => {
    if (type === "brain") setSelection({ type: "system" });
    else if (type === "specialist") setSelection({ type: "territory", id });
    else if (type === "subagent") setSelection({ type: "subagent", id });
    else if (type === "agent") setSelection({ type: "agent", id });
    else if (type === "operation") setSelection({ type: "operation", id });
  }, []);

  const activate = useCallback(
    (id: string, type: string) => openInspector(id, type),
    [openInspector]
  );

  const toggleNode = useCallback((id: string, dim?: "sub" | "ops") => {
    const key = dim ? `${id}:${dim}` : id;
    setExpandedNodes((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const territoryIds = useMemo(
    () =>
      runtime
        ? runtime.colonies.filter((c) => c.status !== "ARCHIVED").map((c) => c.id)
        : [],
    [runtime]
  );
  const allExpanded = useMemo(() => {
    if (!runtime || territoryIds.length === 0) return false;
    if (!territoryIds.every((id) => expandedNodes.has(id))) return false;
    return getLiveAgents(runtime).every(
      (a) => expandedNodes.has(a.id + ":sub") && expandedNodes.has(a.id + ":ops")
    );
  }, [territoryIds, expandedNodes, runtime]);
  const expandAll = useCallback(() => {
    if (allExpanded) {
      setExpandedNodes(new Set());
      return;
    }
    const next = new Set(territoryIds);
    for (const agent of runtime?.agents ?? []) {
      if (["cancelled", "stopped"].includes(agent.runtimeState)) continue;
      next.add(agent.id + ":sub");
      next.add(agent.id + ":ops");
    }
    setExpandedNodes(next);
  }, [allExpanded, territoryIds, runtime]);

  /* Spacing adapts to the pane, but only across coarse bands. Without the
   * quantisation a drag-resize would rebuild the layout on every pixel and the
   * cards would visibly swim; snapping to VIEWPORT_DEADBAND means the graph only
   * re-spaces when the pane has actually changed size by a meaningful amount. */
  const bandedViewport = useMemo(() => {
    if (!paneSize) return undefined;
    const snap = (v: number) => Math.round(v / VIEWPORT_DEADBAND) * VIEWPORT_DEADBAND;
    return { w: snap(paneSize.w), h: snap(paneSize.h) };
  }, [paneSize]);

  const { nodes, edges } = useTopologyGraph(expandedNodes, focusAgentId, {
    narrow,
    activate,
    toggle: toggleNode,
    expandAll,
    allExpanded,
    viewport: bandedViewport,
  });

  /* ── Camera ─────────────────────────────────────────────────────────────────
   * Everything here exists to answer one question with numbers instead of
   * time: when something changes, is the whole graph still on screen? If it is,
   * the camera stays where the user put it. If it is not, the camera is derived
   * from the current pane and the current graph in one step.
   *
   * The old version waited 350ms, keyed on a node count and a rounded pane
   * width, and treated "I have run fitView once for this key" as success
   * *before* running it. Three ways that lost the graph: a resize that arrived
   * inside the window cancelled the pending fit, a key that did not change
   * after a fit-on-stale-nodes was never retried, and completion flashes were
   * counted as graph content, dragging the fit box below the last card. */

  /** The pane edges not covered by floating UI — what the camera frames in. */
  const usablePane = useMemo(() => {
    if (!paneSize) return null;
    return {
      w: Math.max(1, paneSize.w - insets.left - insets.right),
      h: Math.max(1, paneSize.h - insets.top - insets.bottom),
    };
  }, [paneSize, insets]);

  const paneRef = useRef<{ w: number; h: number } | null>(null);
  paneRef.current = paneSize;
  const usableRef = useRef<{ w: number; h: number } | null>(null);
  usableRef.current = usablePane;

  /** The graph as the camera should see it: every card, measured, with the
   *  ephemeral completion badges left out. A badge hangs below its owner and is
   *  a fraction of a card, so letting it into the bounds pushed the top of the
   *  graph above the top of the pane on every completion.
   *
   *  Each card is measured by React Flow itself rather than by this page. The
   *  nodes here are laid out in graph coordinates, and `getNodesBounds` answers
   *  from the same store the cards were measured into, so the numbers are the
   *  on-screen boxes — `nodeOrigin` already folded in — with no second copy of
   *  the origin arithmetic here to drift out of step with React Flow.
   *
   *  That rect is a left edge and `Placed.x` is a centre, so the half-width is
   *  added on the way in. Left uncorrected, every card sat half a card-width too
   *  far left: the box the camera framed was the right size, centred a card off,
   *  which is why a graph that fit by measurement still hung over the right edge
   *  of a narrow pane. */
  const frameableCards = useCallback((): Placed[] => {
    const cards: Placed[] = [];
    for (const node of getNodes()) {
      if (node.type === "flash" || node.hidden) continue;
      const rect = getNodesBounds([node.id]);
      cards.push({
        x: rect.x + rect.width / 2,
        y: rect.y,
        w: rect.width,
        h: rect.height,
      });
    }
    return cards;
  }, [getNodes, getNodesBounds]);

  /** True while the pane changed, which is the one case that must not animate:
   *  a resize is still arriving, and an eased camera lags behind the box it is
   *  supposed to be framing. */
  const paneKey = useMemo(
    () => (paneSize ? `${Math.round(paneSize.w)}:${Math.round(paneSize.h)}` : ""),
    [paneSize]
  );
  const lastPaneKey = useRef(paneKey);

  const fitGraph = useCallback(
    (opts: { animate?: boolean; force?: boolean } = {}) => {
      const pane = paneRef.current;
      const usable = usableRef.current;
      if (!pane || !usable) return false;
      const cards = frameableCards();
      /* No cards, or cards that are not measured yet. A false here is a retry,
       * not a failure: measurement lands a frame or two after a card is added,
       * and guessing bounds from the layout's intent is what this camera was
       * rewritten to stop doing. */
      if (cards.length === 0) return false;
      if (cards.some((card) => !(card.w > 0) || !(card.h > 0))) return false;
      const current = getViewport();
      if (!opts.force && graphFitsIn(cards, current, usable, insetsRef.current)) {
        return true;
      }
      const target = fitTransformFor(cards, usable);
      void setViewport(
        {
          x: target.x + insetsRef.current.left,
          y: target.y + insetsRef.current.top,
          zoom: target.zoom,
        },
        { duration: opts.animate ? 200 : 0 }
      );
      return true;
    },
    [frameableCards, getViewport, setViewport]
  );

  /* A signature of everything the camera frames. It is the node ids and where
   * they sit, so it changes for every real layout change — a new worker, a
   * collapsed card, a mode flip, a re-spacing — and changes for nothing else.
   * Flashes are excluded, and so is any change that only moves the pane, which
   * is tracked separately. */
  const frameKey = useMemo(
    () =>
      nodes
        .filter((n) => n.type !== "flash")
        .map((n) => `${n.id}@${Math.round(n.position.x)},${Math.round(n.position.y)}`)
        .join("|"),
    [nodes]
  );
  const insetKey = `${Math.round(insets.top)}:${Math.round(insets.right)}:${Math.round(insets.bottom)}:${Math.round(insets.left)}`;
  const refitKey = `${frameKey}|${paneKey}|${insetKey}`;
  const lastRefitKey = useRef<string>("");
  /* A gesture is a real pointer or wheel gesture only. React Flow fires the
   * same start/end pair for a camera move it performs itself, and it passes no
   * event for those, so the presence of an event is the whole discriminator. */
  const userGestureRef = useRef(false);
  const [gestureSettled, setGestureSettled] = useState(0);

  useEffect(() => {
    if (!runtime || !paneSize) return;
    if (lastRefitKey.current === refitKey) return;
    /* While the user is dragging the graph there is nothing to correct yet, and
     * correcting mid-drag would yank the canvas out from under them. Leaving the
     * key unclaimed is deliberate: onMoveEnd bumps gestureSettled, this effect
     * runs again, and the fit happens then — with the graph still framed if the
     * user got there themselves. */
    if (userGestureRef.current) return;
    const paneMoved = lastPaneKey.current !== paneKey;
    lastPaneKey.current = paneKey;
    /* Asking again next frame covers the gap between this commit and the one
     * where React Flow has measured the cards it just rendered. The cap is a
     * backstop, not a wait: a fit that stays impossible simply leaves the key
     * unclaimed, and the next real change tries again. */
    let frame = 0;
    let attempts = 0;
    const attempt = () => {
      if (userGestureRef.current) return;
      if (!fitGraph({ animate: !paneMoved })) {
        if (attempts < 30) {
          attempts += 1;
          frame = window.requestAnimationFrame(attempt);
        }
        return;
      }
      lastRefitKey.current = refitKey;
    };
    frame = window.requestAnimationFrame(attempt);
    return () => window.cancelAnimationFrame(frame);
  }, [refitKey, runtime, paneSize, gestureSettled, fitGraph, paneKey]);

  const onMoveStart = useCallback((event: unknown) => {
    if (event) userGestureRef.current = true;
  }, []);

  const onMoveEnd = useCallback(() => {
    if (!userGestureRef.current) return;
    userGestureRef.current = false;
    setGestureSettled((n) => n + 1);
  }, []);

  const onNodeClick = useCallback(
    (_: unknown, node: Node) => openInspector(node.id as string, node.type as string),
    [openInspector]
  );

  const onNodeDoubleClick = useCallback(
    (_: unknown, node: Node) => {
      if (node.type === "brain") {
        setFocusAgentId(null);
        fitGraph({ animate: true, force: true });
        return;
      }
      if (node.type === "agent" || node.type === "subagent") {
        setFocusAgentId((current) => (current === node.id ? null : (node.id as string)));
      }
      if (node.type === "specialist") {
        setFocusAgentId(null);
        fitGraph({ animate: true, force: true });
      }
      if (node.type === "operation") {
        setSelection({ type: "operation", id: node.id as string });
      }
    },
    [fitGraph]
  );

  const onPaneClick = useCallback(() => {
    setSelection(null);
  }, []);

  const resetView = useCallback(() => {
    setSelection(null);
    setFocusAgentId(null);
    fitGraph({ animate: true, force: true });
  }, [fitGraph]);

  /* One measured element in every state. The camera, the narrow mode and the
   * overlay insets all read this box, and it is mounted before the runtime
   * arrives — measuring the canvas instead meant the observer spent the whole
   * loading phase watching a placeholder that was about to be thrown away. */
  const shell = (body: ReactNode) => (
    <div ref={containerRef} className="h-full w-full relative">
      {body}
    </div>
  );

  // Loading state
  if (!runtime) {
    if (connection === "DISCONNECTED") {
      return shell(
        <div className="h-full w-full flex items-center justify-center p-8">
          <div className="flex flex-col items-center gap-4 text-center max-w-sm">
            <WifiOff className="h-12 w-12 text-muted-foreground/50" />
            <div className="space-y-2">
              <h2 className="text-lg font-semibold">Couldn't load the workforce</h2>
              <p className="text-sm text-muted-foreground">
                Check your connection and try again.
              </p>
            </div>
            <Button size="sm" onClick={() => resync()}>
              <RefreshCw className="h-4 w-4 mr-1.5" />
              Retry
            </Button>
          </div>
        </div>
      );
    }
    return shell(
      <div className="h-full w-full flex items-center justify-center">
        <div className="flex flex-col items-center gap-4 text-muted-foreground">
          <Loader2 className="h-8 w-8 animate-spin motion-reduce:animate-none text-primary" />
          <p className="text-sm">Loading topology…</p>
        </div>
      </div>
    );
  }

  // Empty state - no territories, no agents
  const hasTerritories = runtime.colonies.some((c) => c.status !== "ARCHIVED");
  const hasAgents = runtime.agents.some((a) => !["cancelled", "stopped"].includes(a.runtimeState));
  const isEmpty = !hasTerritories && !hasAgents;

  if (isEmpty) {
    return shell(
      <div className="h-full w-full flex items-center justify-center p-8">
        <div className="flex flex-col items-center gap-4 text-center max-w-sm">
          <Zap className="h-12 w-12 text-muted-foreground/50" />
          <div className="space-y-2">
            <h2 className="text-lg font-semibold">No topology yet</h2>
            <p className="text-sm text-muted-foreground">
              Create a territory or start a mission to see the workforce graph.
            </p>
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={() => window.location.href = "/chat"}>
              <Plus className="h-4 w-4 mr-1.5" />
              New mission
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return shell(
    <>
      <ConnectionBadge />
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        minZoom={FIT_MIN_ZOOM}
        maxZoom={3}
        nodeOrigin={[0.5, 0]}
        nodesDraggable={false}
        nodesConnectable={false}
        proOptions={{ hideAttribution: true }}
        onMoveStart={onMoveStart}
        onMoveEnd={onMoveEnd}
        onNodeClick={onNodeClick}
        onNodeDoubleClick={onNodeDoubleClick}
        onPaneClick={onPaneClick}
        zoomOnDoubleClick={false}
      />

      {selection && (
        <InspectorPanel
          selection={selection}
          onClose={() => setSelection(null)}
          onOpenAgent={(id) => openInspector(id, "agent")}
          narrow={narrow}
        />
      )}

      {focusAgentId && (
        <div className="absolute bottom-4 right-4 z-40 flex items-center gap-2 rounded-lg border glass-focus px-3 py-2 text-xs">
          <span className="text-muted-foreground">Focused:</span>
          <span className="max-w-40 truncate font-medium">
            {runtime.agents.find((a) => a.id === focusAgentId)?.name ?? "agent"}
          </span>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setFocusAgentId(null)}
            aria-label="Exit focus"
            className="h-6 w-6 p-0"
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}

      <div className={cn(
        "pointer-events-none absolute bottom-4 left-4 z-40 rounded-lg border glass-elevated px-3 py-2 text-xs text-muted-foreground",
        narrow
          ? "flex items-center gap-x-2"
          : "flex flex-wrap items-center gap-x-3 gap-y-1"
      )}>
        <span className={cn("flex items-center gap-1.5", narrow && "gap-1")}>
          <span className="inline-block h-0.5 w-5 border-t-2 border-dotted border-info" />
          {!narrow && <span>delegation</span>}
        </span>
        <span className={cn("flex items-center gap-1.5", narrow && "gap-1")}>
          <span className="inline-block h-0.5 w-5 bg-success" />
          {!narrow && <span>communication</span>}
        </span>
        <span className={cn("flex items-center gap-1.5", narrow && "gap-1")}>
          <span className="inline-block h-0.5 w-5 bg-warning" />
          {!narrow && <span>verification</span>}
        </span>
        {/* Reset must exist on every size: on a phone the graph is far taller
            than the screen, so losing the way back to "everything" is a trap.
            Narrow gets an icon-only control (still 24px+, still labelled). */}
        <button
          type="button"
          onClick={resetView}
          aria-label="Reset view"
          title="Reset view"
          className={cn(
            "pointer-events-auto inline-flex items-center justify-center text-foreground/70 underline underline-offset-2 hover:text-foreground",
            narrow ? "h-6 w-6 rounded-md border border-border" : "h-auto"
          )}
        >
        {narrow ? (
          <Scan className="h-3.5 w-3.5" aria-hidden />
        ) : (
          <span className="text-xs">reset view</span>
        )}
        </button>
      </div>
    </>
  );
}


export default function TopologyPage() {
  return (
    <ReactFlowProvider>
      <TopologyCanvas />
    </ReactFlowProvider>
  );
}