"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  MiniMap,
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
import { useSubscribeRuntime, useTopologyGraph } from "@/lib/runtime/useRuntime";

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
  const [focusAgentId, setFocusAgentId] = useState<string | null>(null);
  const [selection, setSelection] = useState<InspectorSelection | null>(null);
  const [narrow, setNarrow] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const { fitView } = useReactFlow();
  const FIT_VIEW_OPTIONS = useMemo(
    () => ({ padding: 0.18, maxZoom: 0.72 } as const),
    []
  );

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width ?? window.innerWidth;
      setNarrow(width < 800);
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

  const { nodes, edges } = useTopologyGraph(zoom, focusAgentId, { narrow, activate });

  const onMove = useCallback((_: unknown, viewport: { x: number; y: number; zoom: number }) => {
    setZoom(viewport.zoom);
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

  return (
    <div ref={containerRef} className="h-screen w-full">
      <ConnectionBadge />
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={FIT_VIEW_OPTIONS}
        minZoom={0.2}
        maxZoom={3}
        nodesDraggable={false}
        nodesConnectable={false}
        onMove={onMove}
        onNodeClick={onNodeClick}
        onNodeDoubleClick={onNodeDoubleClick}
        onPaneClick={onPaneClick}
      >
        <Background />
        {!narrow && <MiniMap pannable zoomable className="!bg-muted/40" />}
      </ReactFlow>

      {selection && (
        <InspectorPanel
          selection={selection}
          onClose={() => setSelection(null)}
          onOpenAgent={(id) => openInspector(id, "agent")}
        />
      )}

      <div className="pointer-events-none absolute bottom-4 left-4 z-40 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-border bg-background/90 px-3 py-2 text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-0.5 w-5 bg-border" /> ownership
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-0.5 w-5 border-t-2 border-dotted border-info" /> delegation
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-0.5 w-5 bg-success" /> communication
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-0.5 w-5 bg-warning" /> verification
        </span>
        <button
          type="button"
          onClick={resetView}
          className="pointer-events-auto text-foreground/70 underline underline-offset-2 hover:text-foreground"
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