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
import { useSubscribeRuntime, useTopologyGraph, useRuntime, useConnection, useResync, useTempEdges, useFlashes } from "@/lib/runtime/useRuntime";
import { getLiveAgents } from "@/lib/runtime/selectors";
import { Loader2, Plus, RefreshCw, WifiOff, X, Zap } from "lucide-react";
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
  const [expandedNodes, setExpandedNodes] = useState<ReadonlySet<string>>(new Set());
  const [focusAgentId, setFocusAgentId] = useState<string | null>(null);
  const [selection, setSelection] = useState<InspectorSelection | null>(null);
  const [narrow, setNarrow] = useState(false);
  const [dismissedHint, setDismissedHint] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const lastMoveRef = useRef(0);
  const { fitView } = useReactFlow();
  const runtime = useRuntime();
  const connection = useConnection();
  const resync = useResync();
  const tempEdges = useTempEdges();
  const flashes = useFlashes();
  const FIT_VIEW_OPTIONS = useMemo(
    () => ({ padding: 0.18, maxZoom: 0.72 } as const),
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

  const { nodes, edges } = useTopologyGraph(expandedNodes, focusAgentId, {
    narrow,
    activate,
    toggle: toggleNode,
    expandAll,
  });

  // Refit the camera deterministically when the frameable content changes:
  // expand/collapse or live node add/remove, or pane resize. Keyed on a
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
  const refitKey = `${structuralCount}:${paneKey}`;
  const lastRefitKey = useRef<string>("");
  const fitTimer = useRef<number | null>(null);

  useEffect(() => {
    if (!runtime) return;
    const attempt = () => {
      if (performance.now() - lastMoveRef.current < 250) {
        fitTimer.current = window.setTimeout(attempt, 150);
        return;
      }
      if (lastRefitKey.current === refitKey) return;
      lastRefitKey.current = refitKey;
      fitView(FIT_VIEW_OPTIONS);
    };
    if (fitTimer.current) window.clearTimeout(fitTimer.current);
    fitTimer.current = window.setTimeout(attempt, 350);
    return () => {
      if (fitTimer.current) window.clearTimeout(fitTimer.current);
    };
  }, [refitKey, runtime, fitView, FIT_VIEW_OPTIONS]);

  const onMove = useCallback((_: unknown, _viewport: { x: number; y: number; zoom: number }) => {
    lastMoveRef.current = performance.now();
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
        fitView({ ...FIT_VIEW_OPTIONS });
      }
      if (node.type === "operation") {
        setSelection({ type: "operation", id: node.id as string });
      }
    },
    [fitView, FIT_VIEW_OPTIONS]
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
    if (connection === "DISCONNECTED") {
      return (
        <div ref={containerRef} className="h-full w-full flex items-center justify-center p-8">
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
        zoomOnDoubleClick={false}
      />

      {/* Hint chip */}
      {!dismissedHint && (
        <div className="fixed top-16 left-4 z-40 animate-in slide-in-from-top-2 duration-200">
          <div className={cn(
            "flex items-center gap-2 rounded-lg border border-border bg-background/95 px-3 py-2 text-sm text-muted-foreground shadow-lg",
            narrow && "max-w-[calc(100vw-2rem)]"
          )}>
            <span className="flex-1">
              Scroll to zoom. Open a card to see what's inside. Details opens the side panel.
            </span>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setDismissedHint(true)}
              aria-label="Dismiss hint"
            >
              <X className="h-4 w-4" />
            </Button>
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

      {focusAgentId && (
        <div className="absolute bottom-4 right-4 z-40 flex items-center gap-2 rounded-lg border border-border bg-background/90 px-3 py-2 text-xs shadow-lg">
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
        "pointer-events-none absolute bottom-4 left-4 z-40 rounded-lg border border-border bg-background/90 px-3 py-2 text-xs text-muted-foreground",
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