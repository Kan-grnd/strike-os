"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { useSubscribeRuntime, useTopologyGraph, useRuntime, useTempEdges, useFlashes } from "@/lib/runtime/useRuntime";
import { getHiddenTransientCounts, nextBand, BAND_ANCHOR_ZOOM } from "@/lib/runtime/selectors";
import type { TopologyBand } from "@/lib/runtime/types";
import { Loader2, Plus, Zap, AlertTriangle } from "lucide-react";
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

function TopologyCanvas() {
  useSubscribeRuntime();
  const [zoom, setZoom] = useState(0.6);
  const [band, setBand] = useState<TopologyBand>("specialist");
  const bandRef = useRef<TopologyBand>("specialist");
  const [focusAgentId, setFocusAgentId] = useState<string | null>(null);
  const [selection, setSelection] = useState<InspectorSelection | null>(null);
  const [narrow, setNarrow] = useState(false);
  const [dismissedZoomHint, setDismissedZoomHint] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const zoomRef = useRef(0.6);
  const lastMoveRef = useRef(0);
  const rafRef = useRef<number | null>(null);
  const bandTimerRef = useRef<number | null>(null);
  const { fitView } = useReactFlow();
  const runtime = useRuntime();
  const tempEdges = useTempEdges();
  const flashes = useFlashes();
  const hiddenCounts = useMemo(
    () =>
      runtime
        ? getHiddenTransientCounts(runtime, BAND_ANCHOR_ZOOM[band], tempEdges, flashes)
        : { tempEdges: 0, flashes: 0 },
    [runtime, band, tempEdges, flashes]
  );
  const FIT_VIEW_OPTIONS = useMemo(
    () => ({ padding: 0.18, maxZoom: 0.72 } as const),
    []
  );
  const BAND_MAX_ZOOM = useMemo(
    () =>
      ({
        specialist: 0.72,
        agents: 1.3,
        operations: 2.0,
        metadata: 3,
      } as const),
    []
  );
  const BAND_MIN_ZOOM = useMemo(
    () =>
      ({
        specialist: 0.2,
        agents: 0.8,
        operations: 1.3,
        metadata: 2.0,
      } as const),
    []
  );
  const [paneSize, setPaneSize] = useState<{ w: number; h: number } | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const { width, height } = entries[0]?.contentRect ?? { width: 0, height: 0 };
      setNarrow(width < 800);
      setPaneSize((prev) =>
        prev && Math.abs(prev.w - width) < 2 && Math.abs(prev.h - height) < 2
          ? prev
          : { w: width, h: height }
      );
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

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

  const { nodes, edges } = useTopologyGraph(band, focusAgentId, { narrow, activate });

  // Stabilize the band with hysteresis: the visible set must not flip while a
  // continuous wheel gesture jitters around a threshold (0.8 / 1.3 / 2.0). The
  // committed band only changes once zoom settles outside its deadband.
  useEffect(() => {
    if (bandTimerRef.current) window.clearTimeout(bandTimerRef.current);
    bandTimerRef.current = window.setTimeout(() => {
      const next = nextBand(bandRef.current, zoomRef.current);
      if (next !== bandRef.current) {
        bandRef.current = next;
        setBand(next);
      }
    }, 150);
    return () => {
      if (bandTimerRef.current) window.clearTimeout(bandTimerRef.current);
    };
  }, [zoom]);

  // Refit the camera deterministically when the frameable content changes:
  // zoom band growth, live node add/remove, or pane resize. Keyed on a
  // structural signature so flash nodes and cursor wobble never trigger it.
  // Waits for the gesture to end so the camera never fights the wheel.
  const structuralCount = useMemo(
    () => nodes.filter((n) => n.type !== "flash").length,
    [nodes]
  );
  const paneKey = useMemo(
    () => (paneSize ? `${Math.round(paneSize.w)}:${Math.round(paneSize.h)}` : ""),
    [paneSize]
  );
  const refitKey = `${band}:${structuralCount}:${paneKey}`;
  const lastRefitKey = useRef<string>("");
  const fitTimer = useRef<number | null>(null);

  useEffect(() => {
    if (!runtime) return;
    // Only specialist/agents content is frameable within its band's zoom
    // window (deeper graphs are wider than the pane at their threshold, so a
    // "fit" would only yank the camera back down). Leave deeper bands to the
    // user's deliberate wheel + pan.
    if (band === "operations" || band === "metadata") return;
    const attempt = () => {
      if (performance.now() - lastMoveRef.current < 250) {
        fitTimer.current = window.setTimeout(attempt, 150);
        return;
      }
      if (lastRefitKey.current === refitKey) return;
      lastRefitKey.current = refitKey;
      fitView({ padding: 0.2, minZoom: BAND_MIN_ZOOM[band], maxZoom: BAND_MAX_ZOOM[band] });
    };
    if (fitTimer.current) window.clearTimeout(fitTimer.current);
    fitTimer.current = window.setTimeout(attempt, 350);
    return () => {
      if (fitTimer.current) window.clearTimeout(fitTimer.current);
    };
  }, [refitKey, runtime, band, fitView]);

  const onMove = useCallback((_: unknown, viewport: { x: number; y: number; zoom: number }) => {
    zoomRef.current = viewport.zoom;
    lastMoveRef.current = performance.now();
    if (rafRef.current !== null) return;
    rafRef.current = window.requestAnimationFrame(() => {
      rafRef.current = null;
      setZoom(zoomRef.current);
    });
  }, []);

  const onMoveEnd = useCallback(() => {
    lastMoveRef.current = 0;
  }, []);

  const onNodeClick = useCallback(
    (_: unknown, node: Node) => openInspector(node.id as string, node.type as string),
    [openInspector]
  );

  const onNodeDoubleClick = useCallback(
    (_: unknown, node: Node) => {
      if (node.type === "brain") {
        setFocusAgentId(null);
        fitView(FIT_VIEW_OPTIONS);
        return;
      }
      if (node.type === "agent" || node.type === "subagent") {
        setFocusAgentId((current) => (current === node.id ? null : (node.id as string)));
      }
      if (node.type === "specialist") {
        setFocusAgentId(null);
        fitView({ ...FIT_VIEW_OPTIONS, maxZoom: 0.9 });
      }
      if (node.type === "operation") {
        setSelection({ type: "operation", id: node.id as string });
      }
    },
    [fitView]
  );

  const onPaneClick = useCallback(() => {
    setSelection(null);
  }, []);

  const resetView = useCallback(() => {
    setSelection(null);
    setFocusAgentId(null);
    fitView(FIT_VIEW_OPTIONS);
  }, [fitView, FIT_VIEW_OPTIONS]);

  // Loading state
  if (!runtime) {
    return (
      <div ref={containerRef} className="h-full w-full flex items-center justify-center">
        <div className="flex flex-col items-center gap-4 text-muted-foreground">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
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
    return (
      <div ref={containerRef} className="h-full w-full flex items-center justify-center p-8">
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
            <Button variant="outline" size="sm" onClick={() => window.location.href = "/admin"}>
              Admin panel
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="h-full w-full relative">
      <ConnectionBadge />
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={FIT_VIEW_OPTIONS}
        minZoom={0.2}
        maxZoom={3}
        nodeOrigin={[0.5, 0]}
        nodesDraggable={false}
        nodesConnectable={false}
        proOptions={{ hideAttribution: true }}
        onMove={onMove}
        onMoveEnd={onMoveEnd}
        onNodeClick={onNodeClick}
        onNodeDoubleClick={onNodeDoubleClick}
        onPaneClick={onPaneClick}
      />

      {/* Zoom hint chip */}
      {!dismissedZoomHint && (
        <div className="fixed top-16 left-4 z-40 animate-in slide-in-from-top-2 duration-200">
          <div className={cn(
            "flex items-center gap-2 rounded-lg border border-border bg-background/95 px-3 py-2 text-sm text-muted-foreground shadow-lg",
            narrow && "max-w-[calc(100vw-2rem)]"
          )}>
            <span className="flex-1">
              Zoom in for agents → operations → details
            </span>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setDismissedZoomHint(true)}
              aria-label="Dismiss zoom hint"
            >
              <span className="text-xs">✕</span>
            </Button>
          </div>
        </div>
      )}

      {/* Hidden transient indicator */}
      {(hiddenCounts.tempEdges > 0 || hiddenCounts.flashes > 0) && (
        <div className="fixed top-16 right-4 z-40 animate-in slide-in-from-top-2 duration-200">
          <div className="flex items-center gap-2 rounded-lg border border-warning/50 bg-warning/10 px-3 py-2 text-sm text-warning shadow-lg">
            <AlertTriangle className="h-4 w-4 flex-shrink-0" />
            <span>
              {hiddenCounts.tempEdges > 0 && <>{hiddenCounts.tempEdges} delegation{hiddenCounts.tempEdges > 1 ? "s" : ""} hidden</>}
              {hiddenCounts.tempEdges > 0 && hiddenCounts.flashes > 0 && " · "}
              {hiddenCounts.flashes > 0 && <>{hiddenCounts.flashes} completion{hiddenCounts.flashes > 1 ? "s" : ""} hidden</>}
              <span className="ml-2 text-xs text-muted-foreground">— zoom in to see</span>
            </span>
          </div>
        </div>
      )}

      {selection && (
        <InspectorPanel
          selection={selection}
          onClose={() => setSelection(null)}
          onOpenAgent={(id) => openInspector(id, "agent")}
          narrow={narrow}
        />
      )}

      <div className={cn(
        "pointer-events-none absolute bottom-4 left-4 z-40 rounded-lg border border-border bg-background/90 px-3 py-2 text-[11px] text-muted-foreground",
        narrow
          ? "flex items-center gap-x-2"
          : "flex flex-wrap items-center gap-x-3 gap-y-1"
      )}>
        <span className={cn("flex items-center gap-1.5", narrow && "gap-1")}>
          <span className="inline-block h-0.5 w-5 bg-border" />
          {!narrow && <span>ownership</span>}
        </span>
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
        <span className={cn("flex items-center gap-1.5 px-2", narrow && "hidden")}>
          <span className="w-5 h-5 rounded border border-dashed border-muted-foreground/30 flex items-center justify-center">
            <span className="text-[9px]">~</span>
          </span>
          <span>zoom band: {band}</span>
        </span>
        <button
          type="button"
          onClick={resetView}
          className={cn("pointer-events-auto text-foreground/70 underline underline-offset-2 hover:text-foreground", narrow && "hidden")}
        >
          reset view
        </button>
      </div>
    </div>
  );
}

export default function TopologyPage() {
  return (
    <ReactFlowProvider>
      <TopologyCanvas />
    </ReactFlowProvider>
  );
}