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
import { type TopologyLevel } from "@/lib/runtime/selectors";
import { Loader2, Plus, X, Zap } from "lucide-react";
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

const LEVEL_LEGEND: { level: TopologyLevel; label: string }[] = [
  { level: "core", label: "strike brain" },
  { level: "territory", label: "territory" },
  { level: "agent", label: "agent" },
  { level: "sub", label: "sub-agent" },
  { level: "op", label: "operation" },
];

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

  const toggleNode = useCallback((id: string) => {
    setExpandedNodes((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
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
  const allExpanded = useMemo(
    () => territoryIds.length > 0 && territoryIds.every((id) => expandedNodes.has(id)),
    [territoryIds, expandedNodes]
  );
  const expandAll = useCallback(() => {
    setExpandedNodes(allExpanded ? new Set() : new Set(territoryIds));
  }, [allExpanded, territoryIds]);

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

      {/* Hint chip */}
      {!dismissedHint && (
        <div className="fixed top-16 left-4 z-40 animate-in slide-in-from-top-2 duration-200">
          <div className={cn(
            "flex items-center gap-2 rounded-lg border border-border bg-background/95 px-3 py-2 text-sm text-muted-foreground shadow-lg",
            narrow && "max-w-[calc(100vw-2rem)]"
          )}>
            <span className="flex-1">
              Scroll to zoom · tap + to open a box · click Inspect for details
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

      <div className={cn(
        "pointer-events-none absolute bottom-4 left-4 z-40 rounded-lg border border-border bg-background/90 px-3 py-2 text-xs text-muted-foreground",
        narrow
          ? "flex items-center gap-x-2"
          : "flex flex-wrap items-center gap-x-3 gap-y-1"
      )}>
        {LEVEL_LEGEND.map(({ level, label }) => (
          <span key={level} className={cn("flex items-center gap-1.5", narrow && "gap-1")}>
            <span className={cn("inline-block h-3.5 w-1 rounded-full", levelDotClass(level))} />
            <span className={narrow ? "hidden" : undefined}>{label}</span>
          </span>
        ))}
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

function levelDotClass(level: TopologyLevel): string {
  switch (level) {
    case "core":
      return "bg-[hsl(var(--level-core))]";
    case "territory":
      return "bg-[hsl(var(--level-territory))]";
    case "agent":
      return "bg-[hsl(var(--level-agent))]";
    case "sub":
      return "bg-[hsl(var(--level-sub))]";
    case "op":
      return "bg-[hsl(var(--level-op))]";
  }
}

export default function TopologyPage() {
  return (
    <ReactFlowProvider>
      <TopologyCanvas />
    </ReactFlowProvider>
  );
}