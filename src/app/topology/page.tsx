"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ReactFlow,
  MiniMap,
  Background,
  BackgroundVariant,
  Node,
  Edge,
  ReactFlowProvider,
  useReactFlow,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { toast } from "sonner";

import { HiveCoreNode } from "@/components/topology/nodes/hive-core-node";
import StrikeControls from "@/components/topology/controls";
import { CoreNode, DecisionGateNode } from "@/components/topology/nodes/core-node";
import { ColonyNode } from "@/components/topology/nodes/colony-node";
import { AgentNode } from "@/components/topology/nodes/agent-node";
import { MissionNode } from "@/components/topology/nodes/mission-node";
import { ToolNode, MCPCNode, AutomationNode, MemoryNode } from "@/components/topology/nodes/resource-chip";
import edgeTypes from "@/components/topology/edges";
import { useEdgeSignals } from "@/components/topology/edges/signals-hook";
import { PACKET_COLORS, type SignalGraph, type SignalPacket } from "@/components/topology/edges/signals";
import { useTopology, resetDatabase } from "@/hooks/useApi";
import { useEventStream } from "@/hooks/useEventStream";
import { buildGraph, layoutGraph, stateMeta, stateHex, ACTIVE_STATES, LayoutMode, TNode } from "@/lib/topology";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";

const nodeTypes = {
  HIVE_CORE: HiveCoreNode,
  CORE: CoreNode,
  COLONY: ColonyNode,
  AGENT: AgentNode,
  WORKER: AgentNode,
  SPECIALIST: AgentNode,
  ARCHITECT: AgentNode,
  PLANNER: AgentNode,
  OBSERVER: AgentNode,
  EVALUATOR: AgentNode,
  SUB_AGENT: AgentNode,
  MISSION: MissionNode,
  DECISION: DecisionGateNode,
  TOOL: ToolNode,
  MCP: MCPCNode,
  AUTOMATION: AutomationNode,
  MEMORY: MemoryNode,
};

const LAYOUT_MODES: { id: LayoutMode; label: string }[] = [
  { id: "HIERARCHY", label: "Hierarchy" },
  { id: "EXECUTION", label: "Execution" },
  { id: "DEPENDENCY", label: "Dependency" },
  { id: "COMMUNICATION", label: "Communication" },
  { id: "RESOURCE", label: "Resource" },
];

// Which relationship types matter per layout — everything else is hidden so the
// canvas stays readable instead of dragging wires across the whole sheet.
// approval / delegates are not edge types: they ride as signal packets on
// reports_to / assigned edges (no topology edge of their own).
const EDGE_ALLOW: Record<LayoutMode, string[]> = {
  HIERARCHY: ["reports_to", "assigned", "manages", "contains"],
  EXECUTION: ["assigned", "blocked_by", "depends_on"],
  DEPENDENCY: ["blocked_by", "depends_on", "assigned"],
  COMMUNICATION: ["reports_to", "assigned"],
  RESOURCE: ["uses"],
};

const EDGE_COLORS: Record<string, string> = { reports_to: "#71717a", assigned: "#22d3ee", blocked_by: "#f43f5e", depends_on: "#f59e0b", uses: "#71717a", manages: "#71717a", contains: "#52525b" };

const EDGE_LABEL: Record<string, string> = {
  reports_to: "reports to / hierarchy",
  assigned: "mission assignment",
  blocked_by: "blocker / dependency",
  depends_on: "task dependency",
  uses: "tool usage",
  manages: "manages",
  contains: "contains",
  delegates_to: "delegates",
  approval: "human approval",
};

const SIGNAL_LABELS: [string, string][] = [
  ["assign", "assignment"],
  ["complete", "completion / report"],
  ["spawn", "spawn"],
  ["delegate", "delegation"],
  ["tool-call", "tool call / return"],
  ["tool-fail", "tool failure"],
  ["failure", "failure"],
  ["blocked", "blocked"],
  ["clear", "retry / unblock"],
  ["approval", "human approval"],
];

const SCENARIOS: { id: string; label: string }[] = [
  { id: "normal", label: "Normal" },
  { id: "agent_failure", label: "Agent failure" },
  { id: "dependency_failure", label: "Dependency failure" },
  { id: "colony_pause", label: "Colony pause" },
  { id: "agent_spawning", label: "Agent spawning" },
  { id: "tool_failure", label: "Tool failure" },
  { id: "parallel_execution", label: "Parallel execution" },
  { id: "human_approval", label: "Human approval" },
  { id: "cascading_failure", label: "Cascading failure" },
  { id: "recovery", label: "Recovery" },
  { id: "large_workforce", label: "Large workforce" },
];

const FLASH_TYPES = new Set([
  "agent.blocked", "agent.failed", "agent.paused", "agent.stopped", "agent.cancelled",
  "colony.paused", "colony.stopped", "colony.failed", "agent.waiting_approval",
]);

function entityKey(e: { subject?: string; subjectId?: string }): string | null {
  if (!e?.subjectId) return null;
  return `${e.subject}:${e.subjectId}`;
}

function LiveTopology() {
  const { data, isLoading, error, mutate } = useTopology();
  const { events } = useEventStream({ initialLimit: 40 });
  const wrapRef = useRef<HTMLDivElement | null>(null);

  const [mode, setMode] = useState<"LIVE" | "SIMULATE">("LIVE");
  const [layoutMode, setLayoutMode] = useState<LayoutMode>("HIERARCHY");
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [flashCount, setFlashCount] = useState<Record<string, number>>({});
  const [searchQuery, setSearchQuery] = useState("");
  const [detail, setDetail] = useState<any>(null);
  const [scenarioBusy, setScenarioBusy] = useState(false);
  const [spawnOpen, setSpawnOpen] = useState(false);
  const [confirm, setConfirm] = useState<{ kind: "agent" | "colony" | "mission" | "resource"; mode: string } | null>(null);

  const projection = data?.projection;
  const graph = useMemo(() => buildGraph(projection), [projection]);
  const layout = useMemo(
    () => layoutGraph(graph.nodes, graph.edges, layoutMode, collapsed),
    [graph, layoutMode, collapsed]
  );
  const tasksById = useMemo(() => projection?.taskSummaryById ?? {}, [projection]);
  const missionPct = useMemo(() => projection?.missionPercent ?? {}, [projection]);

  const flashNode = useCallback((key: string) => {
    setFlashCount((fc) => ({ ...fc, [key]: (fc[key] ?? 0) + 1 }));
    setTimeout(() => {
      setFlashCount((fc) => {
        const next = { ...fc };
        if (next[key]) next[key] -= 1;
        if (next[key] <= 0) delete next[key];
        return next;
      });
    }, 1500);
  }, []);

  useEffect(() => {
    const latest = events[0];
    if (!latest) return;
    const key = entityKey(latest);
    if (key && FLASH_TYPES.has(latest.type)) flashNode(key);
    if (key && latest.subject === "agent" && ["agent.blocked", "agent.failed"].includes(latest.type)) {
      setSelectedId((prev) => prev ?? key);
    }
  }, [events, flashNode]);

  const toggleColony = useCallback((id: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const nodeDataFor = useCallback(
    (n: TNode) => {
      const base = { label: n.label, status: n.status, flash: (flashCount[n.id] ?? 0) > 0 };
      if (n.type === "HIVE_CORE") {
        return { ...base, count: `${layout.stats.agents} agents · ${layout.stats.active} active` };
      }
      if (n.type === "CORE") {
        return { ...base, colonies: n.data.colonies as number, active: n.data.active as number };
      }
      if (n.type === "COLONY") {
        return { ...base, agents: n.data.agents as number, expanded: !collapsed.has(n.id), onToggle: () => toggleColony(n.id), buckets: layout.colonyBuckets[n.id] };
      }
      if (n.type === "MISSION") return { ...base, tasks: n.data.tasks as number, pct: missionPct[n.id] ?? 0 };
      if (isResourceNode(n.type) || n.type === "DECISION") return { ...base };
      return {
        ...base,
        role: n.type,
        reason: n.status === "blocked" ? (n.stateReason ?? n.blockedBy ?? null) : null,
        blockedBy: n.blockedBy ?? null,
        pausedFrom: n.status === "paused" ? n.previousRuntimeState : null,
        isSub: (n.parent ?? "").startsWith("agent:"),
        currentTask:
          n.currentTaskId
            ? tasksById[n.currentTaskId] ?? (n.currentTaskId.length > 8 ? `task #${n.currentTaskId.slice(-6)}` : n.currentTaskId)
            : ACTIVE_STATES.includes(n.status)
            ? "…"
            : null,
      };
    },
    [layout, collapsed, flashCount, tasksById, missionPct, toggleColony]
  );

  const flowNodes: Node[] = useMemo(
    () =>
      layout.nodes.map((n) => {
        const d = layout.dims[n.id];
        const parentId = layout.parentOf?.[n.id];
        return {
          id: n.id,
          type: n.type,
          position: d ? { x: d.x, y: d.y } : { x: 0, y: 0 },
          data: nodeDataFor(n),
          selected: selectedId === n.id,
          parentId,
          extent: parentId ? "parent" : undefined,
          ...(parentId ? {} : SIZED_STRUCTURAL.has(n.type) && d ? { style: { width: d.w, height: d.h } } : {}),
        };
      }),
    [layout, nodeDataFor, selectedId]
  );

  // Signal graph: only the edges visible in the current mode + the node id set,
  // so signals whose ideal edge is hidden/missing fall back to node pulses
  // instead of riding (or inventing) hidden topology.
  const rawEdges = useMemo(
    () =>
      layout.edges
        .filter((e) => EDGE_ALLOW[layoutMode].includes(e.type))
        .map((e) => ({ id: e.id, source: e.source, target: e.target, type: e.type, data: e.data ?? {} })),
    [layout.edges, layoutMode]
  );

  const signalGraph = useMemo<SignalGraph>(
    () => ({
      nodeIds: new Set(layout.nodes.map((n) => n.id)),
      edges: rawEdges,
    }),
    [layout.nodes, rawEdges]
  );

  const signals = useEdgeSignals(events, signalGraph);

  const packetsByEdge = useMemo(() => {
    const map = new Map<string, SignalPacket[]>();
    for (const s of signals) {
      if (!s.edgeId) continue;
      const arr = map.get(s.edgeId);
      if (arr) arr.push(s);
      else map.set(s.edgeId, [s]);
    }
    return map;
  }, [signals]);

  // Fallback node pulses (hidden-mode signals) ride self-loop pulse edges in the
  // same transformed layer as the canvas — no overlay misalignment on pan/zoom.
  const nodePulses = useMemo(() => signals.filter((s) => !s.edgeId && s.fallbackNodeId), [signals]);

  const flowEdges: Edge[] = useMemo(() => {
    const withSignals: Edge[] = rawEdges.map((e) => ({
      ...e,
      data: { ...e.data, signals: packetsByEdge.get(e.id) ?? [] },
    }));
    const pulses: Edge[] = nodePulses.map((p) => ({
      id: p.id,
      source: p.fallbackNodeId as string,
      target: p.fallbackNodeId as string,
      type: "default",
      data: { signals: [p], pulse: true },
    }));
    return [...withSignals, ...pulses];
  }, [rawEdges, packetsByEdge, nodePulses]);

  // Refit the viewport whenever the arrangement changes (mode, collapse, simulate reset).
  const { fitView } = useReactFlow();
  useEffect(() => {
    const t = setTimeout(() => fitView({ padding: 0.2, maxZoom: 1 }), 350);
    return () => clearTimeout(t);
  }, [layoutMode, collapsed, fitView]);

  const onNodeClick = useCallback((_ev: React.MouseEvent, node: Node) => {
    setSelectedId(node.id);
  }, []);

  // Load detail for inspector
  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      return;
    }
    const [kind, raw] = selectedId.split(":");
    const id = raw ?? selectedId;
    if (kind === "agent") {
      fetch(`/api/agents/${id}`).then((r) => r.json()).then((d) => setDetail(d)).catch(() => setDetail(null));
    } else if (kind === "colony") {
      fetch(`/api/colonies/${id}`).then((r) => r.json()).then((d) => setDetail(d)).catch(() => setDetail(null));
    } else if (kind === "mission") {
      fetch(`/api/missions/${id}`).then((r) => r.json()).then((d) => setDetail(d)).catch(() => setDetail(null));
    } else {
      setDetail(null);
    }
  }, [selectedId]);

  const runAction = useCallback(
    async (path: string, body?: unknown, successMsg?: string) => {
      const res = await fetch(path, {
        method: body === undefined ? "POST" : "PATCH",
        headers: body !== undefined ? { "Content-Type": "application/json" } : undefined,
        body: body !== undefined ? JSON.stringify(body) : undefined,
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json?.error ?? "Action failed");
        return false;
      }
      if (successMsg) toast.success(successMsg);
      setTimeout(() => mutate(), 350);
      return true;
    },
    [mutate]
  );

  const runScenario = useCallback(
    async (scenario: string) => {
      setScenarioBusy(true);
      try {
        const res = await fetch("/api/topology/scenario", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ scenario }),
        });
        const json = await res.json();
        if (!res.ok) {
          toast.error(json?.error ?? "Scenario failed");
        } else {
          (json.messages ?? []).forEach((m: string) => toast.info(m));
        }
        setTimeout(() => mutate(), 600);
      } finally {
        setScenarioBusy(false);
      }
    },
    [mutate]
  );

  const resetSim = useCallback(async () => {
    await resetDatabase();
    toast.info("Scenarios reset — database reseeded");
    setTimeout(() => mutate(), 700);
  }, [mutate]);

  const handleSearch = useCallback(
    (q: string) => {
      setSearchQuery(q);
      if (!q.trim()) return;
      const hit = graph.nodes.find((n) => n.label.toLowerCase().includes(q.trim().toLowerCase()));
      if (hit) {
        setSelectedId(hit.id);
        flashNode(hit.id);
      }
    },
    [graph.nodes, flashNode]
  );

  const spawnForm = async (body: Record<string, unknown>) => {
    const res = await fetch("/api/agents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...body, spawn: true }),
    });
    const json = await res.json();
    if (!res.ok) {
      toast.error(json?.error ?? "Spawn failed");
      return;
    }
    toast.success(`Spawned ${String(body.name)}`);
    setSpawnOpen(false);
    setTimeout(() => mutate(), 500);
  };

  if (isLoading) return <div className="flex h-screen items-center justify-center text-muted-foreground">Loading topology…</div>;
  if (error) return <div className="flex h-screen items-center justify-center text-destructive">Failed to load topology — is the API up?</div>;

  const selectedNode = graph.nodes.find((n) => n.id === selectedId) ?? null;
  const selectedDetail = selectedNode ? detail : null;

  return (
    <div className="flex h-[calc(100vh-57px)] w-full overflow-hidden">
      <svg width="0" height="0" style={{ position: "absolute" }}>
        <defs>
          <marker id="topology-arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
            <path d="M0,0 L8,4 L0,8 Z" fill="#52525b" />
          </marker>
        </defs>
      </svg>

      {/* ── Left control rail ─────────────────────────────── */}
      <div className="flex w-72 shrink-0 flex-col border-r bg-card/60">
        <div className="border-b p-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold tracking-wide">LIVE TOPOLOGY</h2>
            <span className="font-mono text-[10px] text-zinc-500">{projection?.generatedAt ? "synced" : "…"}</span>
          </div>
          <p className="mt-1 font-mono text-[10px] leading-snug text-zinc-500">
            Live map of the workforce — watch state, take direct control
          </p>
          {/* Live / Simulate / Layout — present state only, no shadow system */}
          <p className="mt-2 font-mono text-[9px] uppercase tracking-wider text-zinc-600">
            observe
          </p>
          <div className="mt-1 grid grid-cols-2 gap-1 rounded-lg border p-1">
            {(["LIVE", "SIMULATE"] as const).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`rounded-md px-2 py-1 text-[11px] font-semibold transition-colors ${
                  mode === m ? "bg-cyan-500/15 text-cyan-300" : "text-zinc-500 hover:text-zinc-300"
                }`}
              >
                {m}
              </button>
            ))}
            <button
              onClick={() => layoutGraph(graph.nodes, graph.edges, layoutMode, collapsed)}
              className="col-span-2 rounded-md px-2 py-1 text-[11px] font-semibold text-zinc-500 hover:bg-zinc-800"
              title="Recompute positions"
            >
              LAYOUT ▸ {layoutMode}
            </button>
          </div>
          <div className="mt-2 flex flex-wrap gap-1">
            {LAYOUT_MODES.map((m) => (
              <button
                key={m.id}
                onClick={() => setLayoutMode(m.id)}
                className={`rounded px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-wide ${
                  layoutMode === m.id ? "bg-zinc-200 text-black" : "bg-zinc-800 text-zinc-400 hover:text-zinc-200"
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>

        <div className="border-b p-3">
          <p className="font-mono text-[9px] uppercase tracking-wider text-zinc-600">control</p>
          <div className="relative mt-1.5">
            <input
              type="text"
              placeholder="Search nodes…"
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              className="w-full rounded-md border bg-background px-2.5 py-1.5 font-mono text-[11px] outline-none focus:border-cyan-500/50"
            />
          </div>
          <button
            onClick={() => setSpawnOpen((v) => !v)}
            className="mt-2 w-full rounded-md border border-dashed border-zinc-700 px-2.5 py-1.5 text-[11px] font-semibold text-zinc-400 hover:border-cyan-500/50 hover:text-cyan-300"
          >
            {spawnOpen ? "− close spawn form" : "+ spawn agent"}
          </button>
          {spawnOpen && <SpawnForm colonies={graph.nodes.filter((n) => n.type === "COLONY")} agents={graph.nodes.filter((n) => n.type !== "COLONY" && n.type !== "HIVE_CORE" && n.type !== "CORE" && n.type !== "DECISION" && !isResourceNode(n.type))} onSubmit={spawnForm} />}
        </div>

        <ScrollArea className="flex-1">
          <div className="space-y-4 p-3">
            {/* Stats */}
            <div className="grid grid-cols-3 gap-1.5">
              <Stat label="agents" value={layout.stats.agents} accent="text-zinc-300" />
              <Stat label="active" value={layout.stats.active} accent="text-cyan-300" />
              <Stat label="paused" value={layout.stats.paused} accent="text-orange-300" />
              <Stat label="blocked" value={layout.stats.blocked} accent="text-amber-300" />
              <Stat label="failed" value={layout.stats.failed} accent="text-red-300" />
              <Stat label="done" value={layout.stats.completed} accent="text-emerald-300" />
            </div>

            {/* Edge legend */}
            <div className="space-y-1">
              <p className="font-mono text-[9px] uppercase tracking-wider text-zinc-600">relationships · {layoutMode.toLowerCase()}</p>
              {EDGE_ALLOW[layoutMode].map((t) => (
                <div key={t} className="flex items-center gap-2 font-mono text-[10px] text-zinc-400">
                  <span className="h-[2px] w-5 rounded" style={{ background: EDGE_COLORS[t] ?? "#52525b", boxShadow: t === "blocked_by" ? "0 0 4px rgba(244,63,94,0.7)" : undefined }} />
                  <span>{EDGE_LABEL[t] ?? t}</span>
                </div>
              ))}
            </div>

            {/* Signal legend */}
            <div className="space-y-1">
              <p className="font-mono text-[9px] uppercase tracking-wider text-zinc-600">signals</p>
              {SIGNAL_LABELS.map(([kind, label]) => (
                <div key={kind} className="flex items-center gap-2 font-mono text-[10px] text-zinc-400">
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ background: PACKET_COLORS[kind as keyof typeof PACKET_COLORS] }}
                  />
                  <span>{label}</span>
                </div>
              ))}
            </div>

            {mode === "SIMULATE" && (
              <div className="space-y-1.5">
                <p className="font-mono text-[9px] uppercase tracking-wider text-amber-400">test console</p>
                <p className="font-mono text-[9px] text-zinc-600">mutations are real</p>
                <button
                  onClick={resetSim}
                  className="flex w-full items-center justify-between rounded-md border border-zinc-800 bg-zinc-950/60 px-2 py-1 text-left font-mono text-[10px] text-zinc-300 hover:border-red-500/40 hover:text-red-300"
                >
                  <span>reset demo db</span>
                  <span className="text-zinc-600">↺</span>
                </button>
                {SCENARIOS.map((s) => (
                  <button
                    key={s.id}
                    disabled={scenarioBusy}
                    onClick={() => runScenario(s.id)}
                    className="flex w-full items-center justify-between rounded-md border border-zinc-800 bg-zinc-950/60 px-2 py-1 text-left font-mono text-[10px] text-zinc-300 hover:border-amber-500/40 hover:text-amber-200 disabled:opacity-40"
                  >
                    <span>{s.label}</span>
                    <span className="text-zinc-600">▶</span>
                  </button>
                ))}
              </div>
            )}

            {/* Event feed */}
            <div className="space-y-1">
              <p className="font-mono text-[9px] uppercase tracking-wider text-zinc-600">event stream</p>
              {events.slice(0, 8).map((e) => (
                <button
                  key={e.id}
                  onClick={() => {
                    const k = entityKey(e);
                    if (k) setSelectedId(k);
                  }}
                  className="block w-full truncate text-left font-mono text-[10px] text-zinc-500 hover:text-zinc-300"
                  title={`${e.type} — ${e.payload ?? ""}`}
                >
                  <span className="text-zinc-600">{new Date(e.timestamp).toLocaleTimeString()}</span> {e.type}
                </button>
              ))}
            </div>
          </div>
        </ScrollArea>
      </div>

      {/* ── Canvas ────────────────────────────────────────── */}
      <div className="relative flex-1">
        <div className="pointer-events-none absolute left-3 top-3 z-10 rounded-md border border-zinc-800 bg-zinc-950/80 px-2 py-1 font-mono text-[10px] text-zinc-400 backdrop-blur-sm">
          {layout.nodes.length} nodes · {layout.edges.length} edges · {layoutMode.toLowerCase()} · {mode.toLowerCase()} {mode === "SIMULATE" && <span className="text-amber-400">(db mutations)</span>}
        </div>
        <ReactFlow
          nodes={flowNodes}
          edges={flowEdges}
          onNodeClick={onNodeClick}
          nodeTypes={nodeTypes as any}
          edgeTypes={edgeTypes as any}
          fitView
          fitViewOptions={{ padding: 0.12 }}
          minZoom={0.08}
          maxZoom={1}
          nodesDraggable
          defaultEdgeOptions={{ markerEnd: "url(#topology-arrow)" }}
          proOptions={{ hideAttribution: true }}
        >
          <Background variant={BackgroundVariant.Dots} color="#27272a" gap={24} size={1.5} />
          <StrikeControls />
          <MiniMap
            position="bottom-left"
            pannable
            zoomable
            nodeColor={(n: any) => stateHex(n.data?.status)}
            nodeStrokeWidth={0}
            maskColor="rgba(0,0,0,0.72)"
          />
        </ReactFlow>
      </div>

      {/* ── Inspector ─────────────────────────────────────── */}
      {selectedNode && (
        <Inspector
          node={selectedNode}
          detail={selectedDetail}
          nodes={graph.nodes}
          missionPct={missionPct}
          onClose={() => setSelectedId(null)}
          onAction={runAction}
          onConfirm={(kind, mode) => setConfirm({ kind, mode })}
        />
      )}

      {/* ── Delete confirmation ───────────────────────────── */}
      {confirm && <ConfirmDialog kind={confirm.kind} detail={selectedDetail} onCancel={() => setConfirm(null)} onConfirm={async (mode, extra) => {
        let ok = false;
        if (confirm.kind === "agent") ok = await runAction(`/api/agents/${selectedId!.replace("agent:", "")}?${new URLSearchParams({ mode, ...(extra?.target ? { targetAgentId: extra.target } : {}) })}`.replace("?&", "?"), undefined);
        if (confirm.kind === "colony") ok = await runAction(`/api/colonies/${selectedId!.replace("colony:", "")}?${new URLSearchParams({ mode, ...(extra?.targetColony ? { targetColonyId: extra.targetColony } : {}) })}`.replace("?&", "?"), undefined);
        if (ok) {
          setConfirm(null);
          setSelectedId(null);
          toast.info(`Removed ${confirm.kind} (${mode})`);
        }
      }} nodes={graph.nodes} />}
    </div>
  );
}

function isResourceNode(t: string): boolean {
  return ["TOOL", "MCP", "AUTOMATION", "MEMORY"].includes(t);
}

/** Top-level nodes sized by the layout engine (structural silhouettes). */
const SIZED_STRUCTURAL = new Set(["HIVE_CORE", "COLONY", "CORE", "DECISION"]);

function Stat({ label, value, accent }: { label: string; value: number; accent: string }) {
  return (
    <div className="rounded-md border border-zinc-900 bg-zinc-950/70 px-2 py-1.5 text-center">
      <div className={`font-mono text-sm font-bold ${accent}`}>{value}</div>
      <div className="font-mono text-[9px] uppercase tracking-wide text-zinc-600">{label}</div>
    </div>
  );
}

function SpawnForm({ colonies, agents, onSubmit }: { colonies: TNode[]; agents: TNode[]; onSubmit: (b: Record<string, unknown>) => void }) {
  const [name, setName] = useState("");
  const [type, setType] = useState("WORKER");
  const [parent, setParent] = useState("");
  const [colony, setColony] = useState("");
  return (
    <form
      className="mt-2 space-y-1.5 rounded-md border border-zinc-800 bg-zinc-950/70 p-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (!name.trim()) return;
        onSubmit({ name, type, parentId: parent || undefined, colonyId: colony || undefined });
      }}
    >
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="agent name" className="w-full rounded border bg-background px-2 py-1 font-mono text-[10px]" />
      <div className="grid grid-cols-2 gap-1.5">
        <select value={type} onChange={(e) => setType(e.target.value)} className="rounded border bg-background px-1 py-1 font-mono text-[10px]">
          {["WORKER", "SPECIALIST", "ARCHITECT", "PLANNER", "OBSERVER", "EVALUATOR"].map((t) => <option key={t}>{t}</option>)}
        </select>
        <select value={colony} onChange={(e) => setColony(e.target.value)} className="rounded border bg-background px-1 py-1 font-mono text-[10px]">
          <option value="">— colony —</option>
          {colonies.map((c) => <option key={c.id} value={c.id.replace("colony:", "")}>{c.label}</option>)}
        </select>
      </div>
      <select value={parent} onChange={(e) => setParent(e.target.value)} className="w-full rounded border bg-background px-1 py-1 font-mono text-[10px]">
        <option value="">— parent agent —</option>
        {agents.map((a) => <option key={a.id} value={a.id.replace("agent:", "")}>{a.label}</option>)}
      </select>
      <button type="submit" className="w-full rounded bg-cyan-500/15 py-1 font-mono text-[10px] font-bold text-cyan-300 hover:bg-cyan-500/25">SPAWN</button>
    </form>
  );
}

const TASK_GLYPH: Record<string, [string, string]> = {
  COMPLETED: ["✓", "text-emerald-400"],
  SUCCEEDED: ["✓", "text-emerald-400"],
  RUNNING: ["●", "text-cyan-300"],
  IN_PROGRESS: ["●", "text-cyan-300"],
  PENDING: ["○", "text-zinc-400"],
  BLOCKED: ["▲", "text-amber-300"],
  FAILED: ["✕", "text-red-400"],
  CANCELLED: ["✕", "text-red-400"],
  CANCELED: ["✕", "text-red-400"],
};

function isAgentType(t: string): boolean {
  return !isResourceNode(t) && t !== "COLONY" && t !== "HIVE_CORE" && t !== "CORE" && t !== "DECISION" && t !== "MISSION";
}

function nodeLabel(nodes: TNode[], id: string): string {
  if (!id) return id;
  const found = nodes.find((n) => n.id === id || n.id.endsWith(`:${id}`));
  return found?.label ?? id;
}

function shortId(id: string): string {
  const i = id.lastIndexOf(":");
  return i >= 0 ? id.slice(i + 1) : id;
}

function eventHint(ev: any): string | null {
  const bits: string[] = [];
  if (ev?.payload) {
    try {
      const p = JSON.parse(ev.payload);
      for (const v of Object.values(p)) {
        if (v === null || v === undefined) continue;
        if (["string", "number", "boolean"].includes(typeof v)) bits.push(String(v));
      }
    } catch {
      const s = String(ev.payload);
      if (s.length <= 160) bits.push(s);
    }
  }
  if (ev?.taskId) bits.push(`task ${shortId(ev.taskId)}`);
  if (ev?.agentId && ev.agentId !== ev.subjectId) bits.push(`agent ${shortId(ev.agentId)}`);
  return bits.length ? bits.slice(0, 3).join(" · ") : null;
}

function Chip({ children, tone = "text-zinc-300" }: { children: React.ReactNode; tone?: string }) {
  return <span className={`rounded border border-zinc-700 px-1.5 py-0.5 font-mono text-[10px] ${tone}`}>{children}</span>;
}

function RelationRow({ label, type, status }: { label: string; type: string; status: string }) {
  const m = stateMeta(status, type);
  return (
    <div className="flex items-center gap-2 truncate font-mono text-[11px] text-zinc-300">
      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${m.dot} ${m.active ? "animate-pulse" : ""}`} />
      <span className="truncate">{label}</span>
      <span className={`ml-auto shrink-0 text-[9px] uppercase text-zinc-600 ${m.text}`}>{type}</span>
    </div>
  );
}

function Inspector({
  node, detail, nodes, missionPct, onClose, onAction, onConfirm,
}: {
  node: TNode;
  detail: any;
  nodes: TNode[];
  missionPct: Record<string, number>;
  onClose: () => void;
  onAction: (path: string, body?: unknown, msg?: string) => Promise<boolean>;
  onConfirm: (kind: "agent" | "colony" | "mission" | "resource", mode: string) => void;
}) {
  const meta = stateMeta(node.status, node.type);
  const isAgentNode = isAgentType(node.type);
  const isColony = node.type === "COLONY";
  const isMission = node.type === "MISSION";
  const isResource = isResourceNode(node.type);
  const id = node.id.split(":")[1] ?? node.id;
  const events = detail?.events ?? [];
  const parentNode = node.parent ? nodes.find((n) => n.id === node.parent) ?? null : null;
  const children = nodes.filter((n) => n.parent === node.id);
  const tools = (node.data.tools as string[] | undefined) ?? [];
  const capabilities = (node.data.capabilities as string[] | undefined) ?? [];
  const models = (node.data.models as string[] | undefined) ?? [];
  const usersOf = isResource
    ? nodes.filter((n) => {
        if (!isAgentType(n.type)) return false;
        const t = (n.data as any)?.tools;
        return Array.isArray(t) && (t.includes(node.id) || t.includes(node.id.split(":")[1]));
      })
    : [];
  const missionDetail = detail?.mission ?? null;
  const taskRows = Array.isArray(missionDetail?.tasks) ? missionDetail.tasks : [];
  const planCount = Array.isArray(missionDetail?.plan) ? missionDetail.plan.length : 0;
  const missionStatus = missionDetail?.status ?? node.status;
  const missionPriority = missionDetail?.priority ?? "—";
  const fallbackPct = isMission ? (missionPct[node.id] ?? null) : null;

  // Esc closes the inspector; only mounted while an inspector is open.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed right-0 top-[57px] z-50 flex h-[calc(100vh-57px)] w-[380px] flex-col border-l bg-card">
      <div className="flex items-center justify-between border-b px-4 py-2.5">
        <div className="flex items-center gap-2">
          <span className={`h-2 w-2 rounded-full ${meta.dot} ${meta.active ? "animate-pulse" : ""}`} />
          <h3 className="text-sm font-bold">{node.label}</h3>
        </div>
        <button onClick={onClose} className="rounded-md px-2 py-1 font-mono text-[11px] text-zinc-500 hover:bg-zinc-800 hover:text-zinc-200">close</button>
      </div>

      <ScrollArea className="flex-1">
        <div className="space-y-4 p-4">
          <div className="flex items-center gap-2">
            <span className={`rounded border px-1.5 py-0.5 font-mono text-[10px] ${meta.border} ${meta.text}`}>{node.type}</span>
            <span className="font-mono text-[10px] text-zinc-500">{node.id}</span>
          </div>

          <InfoRow k="runtime" v={node.status} accent={meta.text} />
          {node.previousRuntimeState && node.status === "paused" && <InfoRow k="resume →" v={node.previousRuntimeState} accent="text-orange-300" />}
          {node.blockedBy && <InfoRow k="blocked by" v={node.blockedBy} accent="text-amber-300" />}
          {node.stateReason && <InfoRow k="reason" v={node.stateReason} accent="text-zinc-300" />}
          {node.currentTaskId && <InfoRow k="current task" v={node.currentTaskId} accent="text-cyan-300" />}

          {node.type === "HIVE_CORE" && (
            <>
              <InfoRow k="agents" v={String((node.data as any).agentCount ?? "")} accent="text-zinc-300" />
              <InfoRow k="missions" v={String((node.data as any).missionCount ?? "")} accent="text-zinc-300" />
            </>
          )}
          {node.type === "CORE" && (
            <>
              <InfoRow k="colonies" v={String((node.data as any).colonies ?? "")} accent="text-zinc-300" />
              <InfoRow k="active" v={String((node.data as any).active ?? "")} accent="text-emerald-300" />
            </>
          )}

          {isColony && detail?.impact && (
            <div className="rounded-md border border-zinc-800 p-3">
              <p className="font-mono text-[9px] uppercase tracking-wider text-zinc-500">colony snapshot</p>
              <div className="mt-1 grid grid-cols-2 gap-1 font-mono text-[10px] text-zinc-300">
                <div>agents {detail.impact.agentCount}</div>
                <div>active {detail.impact.activeAgents}</div>
                <div>tasks {detail.impact.activeTasks}</div>
                <div>waiting {detail.impact.dependentAgents}</div>
              </div>
            </div>
          )}

          {isColony && detail?.deleteImpact && (
            <div className="rounded-md border border-amber-900/60 p-3">
              <p className="font-mono text-[9px] uppercase tracking-wider text-amber-400">delete impact</p>
              <div className="mt-1 grid grid-cols-2 gap-1 font-mono text-[10px] text-zinc-300">
                <div>descendants {detail.deleteImpact.descendants}</div>
                <div>active tasks {detail.deleteImpact.activeTasks}</div>
                <div>executions {detail.deleteImpact.activeExecutions}</div>
              </div>
            </div>
          )}

          {isAgentNode && detail?.impact && (
            <div className="rounded-md border border-amber-900/60 p-3">
              <p className="font-mono text-[9px] uppercase tracking-wider text-amber-400">delete impact</p>
              <div className="mt-1 grid grid-cols-2 gap-1 font-mono text-[10px] text-zinc-300">
                <div>open tasks {detail.impact.runningTasks}</div>
                <div>children {detail.impact.childAgents}</div>
                <div>dependents {detail.impact.dependents}</div>
              </div>
            </div>
          )}

          {(parentNode || children.length > 0) && (
            <div className="space-y-1">
              {parentNode && (
                <>
                  <p className="font-mono text-[9px] uppercase tracking-wider text-zinc-500">parent</p>
                  <RelationRow label={parentNode.label} type={parentNode.type} status={parentNode.status} />
                </>
              )}
              {children.length > 0 && (
                <>
                  <p className="font-mono text-[9px] uppercase tracking-wider text-zinc-500">{isColony ? "members" : "children"}</p>
                  {children.map((c) => (
                    <RelationRow key={c.id} label={c.label} type={c.type} status={c.status} />
                  ))}
                </>
              )}
            </div>
          )}

          {isAgentNode && (tools.length > 0 || capabilities.length > 0 || models.length > 0) && (
            <div className="space-y-2">
              {tools.length > 0 && (
                <div>
                  <p className="mb-1 font-mono text-[9px] uppercase tracking-wider text-zinc-500">tools</p>
                  <div className="flex flex-wrap gap-1.5">
                    {tools.map((t) => <Chip key={t}>{nodeLabel(nodes, t)}</Chip>)}
                  </div>
                </div>
              )}
              {capabilities.length > 0 && (
                <div>
                  <p className="mb-1 font-mono text-[9px] uppercase tracking-wider text-zinc-500">capabilities</p>
                  <div className="flex flex-wrap gap-1.5">
                    {capabilities.map((c) => <Chip key={c} tone="text-violet-300">{c}</Chip>)}
                  </div>
                </div>
              )}
              {models.length > 0 && (
                <div>
                  <p className="mb-1 font-mono text-[9px] uppercase tracking-wider text-zinc-500">models</p>
                  <div className="flex flex-wrap gap-1.5">
                    {models.map((m) => <Chip key={m} tone="text-amber-200">{m}</Chip>)}
                  </div>
                </div>
              )}
            </div>
          )}

          {isMission && (
            <div className="rounded-md border border-zinc-800 p-3">
              <div className="mb-2 flex items-baseline justify-between">
                <p className="font-mono text-[9px] uppercase tracking-wider text-zinc-500">mission checklist</p>
                {fallbackPct != null && <span className="font-mono text-[10px] text-cyan-300">{fallbackPct}%</span>}
              </div>
              {taskRows.length === 0 ? (
                <div className="grid grid-cols-2 gap-1 font-mono text-[10px] text-zinc-300">
                  <div>tasks {String(node.data.tasks ?? 0)}</div>
                  <div>plan {planCount}</div>
                  <div>status {missionStatus}</div>
                  <div>priority {missionPriority}</div>
                </div>
              ) : (
                <div className="space-y-1.5">
                  {taskRows.map((t: any) => {
                    const glyph = TASK_GLYPH[t.status] ?? ["○", "text-zinc-500"];
                    return (
                      <div key={t.id} className="flex items-start gap-2">
                        <span className={`mt-0.5 shrink-0 font-mono text-[11px] ${glyph[1]}`}>{glyph[0]}</span>
                        <div className="min-w-0">
                          <div className="break-words font-mono text-[11px] leading-tight text-zinc-300">{t.description}</div>
                          <div className="font-mono text-[9px] text-zinc-600">
                            {t.status} · {nodeLabel(nodes, t.ownerAgentId)} · prio {t.priority}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {(isResource || node.type === "DECISION") && (
            <div className="rounded-md border border-zinc-800 p-3">
              <p className="mb-2 font-mono text-[9px] uppercase tracking-wider text-zinc-500">kind</p>
              <div className="flex flex-wrap gap-1.5">
                <Chip tone="text-cyan-300">{node.type}</Chip>
                <Chip tone={meta.text}>{node.status}</Chip>
              </div>
              {node.parent && <InfoRow k="owning" v={nodeLabel(nodes, node.parent)} accent="text-zinc-300" />}
              {isResource && (
                <div className="mt-2">
                  <p className="mb-1 font-mono text-[9px] uppercase tracking-wider text-zinc-500">used by</p>
                  {usersOf.length === 0 ? (
                    <Chip tone="text-zinc-600">none</Chip>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {usersOf.map((a) => <Chip key={a.id}>{a.label}</Chip>)}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {(isAgentNode || isColony || isMission) && (
            <div className="rounded-md border border-zinc-800 p-3">
              <p className="mb-2 font-mono text-[9px] uppercase tracking-wider text-zinc-500">lifecycle</p>
              <div className="flex flex-wrap gap-1.5">
                {isColony && (
                  <>
                    <Action onClick={() => onAction(`/api/colonies/${id}`, { action: "pause", scope: "PAUSE_ALL" }, `Paused ${node.label}`)}>Pause all</Action>
                    <Action onClick={() => onAction(`/api/colonies/${id}`, { action: "pause", scope: "PAUSE_ACTIVE_ONLY" })}>Pause active</Action>
                    <Action onClick={() => onAction(`/api/colonies/${id}`, { action: "pause", scope: "PAUSE_COORDINATOR_ONLY" })}>Pause coord.</Action>
                    <Action onClick={() => onAction(`/api/colonies/${id}`, { action: "resume" }, `Resumed ${node.label}`)}>Resume</Action>
                    <Action onClick={() => onAction(`/api/colonies/${id}`, { action: "stop" })} warn>Stop</Action>
                    <Action onClick={() => onConfirm("colony", "ARCHIVE_COLONY")} warn>Delete…</Action>
                  </>
                )}
                {isMission && (
                  <>
                    <Action onClick={() => onAction(`/api/missions/${id}`, { action: "start" }, "Mission started")}>Start</Action>
                    <Action onClick={() => onAction(`/api/missions/${id}`, { action: "pause" })}>Pause</Action>
                    <Action onClick={() => onAction(`/api/missions/${id}`, { action: "resume" })}>Resume</Action>
                    <Action onClick={() => onAction(`/api/missions/${id}`, { action: "cancel" })} warn>Cancel</Action>
                  </>
                )}
                {isAgentNode && (
                  <>
                    <Action onClick={() => onAction(`/api/agents/${id}`, { action: "pause" }, `Paused ${node.label}`)}>Pause</Action>
                    <Action onClick={() => onAction(`/api/agents/${id}`, { action: "resume" }, `Resumed ${node.label}`)}>Resume</Action>
                    <Action onClick={() => onAction(`/api/agents/${id}`, { action: "stop", reason: "stopped from topology" })} warn>Stop</Action>
                    <Action onClick={() => onAction(`/api/agents/${id}`, { action: "block", blockedBy: "hive-core", reason: "blocked from topology" })}>Block</Action>
                    <Action onClick={() => onAction(`/api/agents/${id}`, { action: "unblock" }, "Unblocked")}>Unblock</Action>
                    <Action onClick={() => onAction(`/api/agents/${id}`, { action: "retry" }, "Retry scheduled")}>Retry</Action>
                    <Action onClick={() => onConfirm("agent", "STOP_AND_REMOVE")} warn>Delete…</Action>
                  </>
                )}
              </div>
            </div>
          )}

          <div className="space-y-1">
              <p className="font-mono text-[9px] uppercase tracking-wider text-zinc-600">traced events</p>
              {events.length === 0 ? (
                <p className="font-mono text-[10px] text-zinc-600">no traced events</p>
              ) : (
                events.slice(0, 12).map((ev: any) => {
                  const hint = eventHint(ev);
                  return (
                    <div key={ev.id} className="font-mono text-[10px]">
                      <div className="truncate text-zinc-500">
                        <span className="text-zinc-600">{new Date(ev.timestamp).toLocaleTimeString()}</span> {ev.type}
                      </div>
                      {hint && <div className="truncate text-zinc-600">{hint}</div>}
                    </div>
                  );
                })
              )}
            </div>
        </div>
      </ScrollArea>
    </div>
  );
}

function InfoRow({ k, v, accent }: { k: string; v: string; accent: string }) {
  return (
    <div className="flex items-start gap-2 font-mono text-[11px]">
      <span className="w-20 shrink-0 text-zinc-600">{k}</span>
      <span className={`min-w-0 break-words ${accent}`}>{v}</span>
    </div>
  );
}

function Action({ children, onClick, warn }: { children: React.ReactNode; onClick: () => void; warn?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={`rounded border px-2 py-1 font-mono text-[10px] ${
        warn
          ? "border-red-900/60 text-red-300 hover:bg-red-950/40"
          : "border-zinc-700 text-zinc-300 hover:border-cyan-500/50 hover:text-cyan-300"
      }`}
    >
      {children}
    </button>
  );
}

function ConfirmDialog({
  kind, detail, nodes, onCancel, onConfirm,
}: {
  kind: "agent" | "colony" | "mission" | "resource";
  detail: any;
  nodes: TNode[];
  onCancel: () => void;
  onConfirm: (mode: string, extra?: { target?: string; targetColony?: string }) => void;
}) {
  const modes =
    kind === "agent"
      ? ["STOP_AND_REMOVE", "ARCHIVE", "REASSIGN_TASKS", "REPLACE_AGENT", "CANCEL_BRANCH"]
      : kind === "colony"
      ? ["ARCHIVE_COLONY", "STOP_ALL_AND_REMOVE", "REASSIGN_WORK", "DELETE_SUBTREE", "CANCEL_BRANCH"]
      : ["CANCEL"];
  const [mode, setMode] = useState(modes[0]);
  const [target, setTarget] = useState("");
  const impact = kind === "colony" ? detail?.deleteImpact : detail?.impact;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onCancel}>
      <div className="w-[440px] rounded-xl border border-zinc-700 bg-card p-4 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-sm font-bold">Confirm {kind} operation</h3>
        <p className="mt-1 font-mono text-[11px] text-zinc-500">historical traces are never destroyed; archived rows stay in the record.</p>
        <div className="mt-3 rounded-md border border-zinc-800 p-3">
          <p className="font-mono text-[9px] uppercase tracking-wider text-zinc-500">mode</p>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {modes.map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`rounded border px-2 py-1 font-mono text-[10px] ${mode === m ? "border-cyan-500/60 text-cyan-300" : "border-zinc-800 text-zinc-500 hover:text-zinc-300"}`}
              >
                {m}
              </button>
            ))}
          </div>
          {(mode === "REASSIGN_TASKS" || mode === "REPLACE_AGENT") && (
            <label className="mt-2 block">
              <span className="font-mono text-[9px] uppercase tracking-wider text-zinc-500">target agent</span>
              <select value={target} onChange={(e) => setTarget(e.target.value)} className="mt-1 w-full rounded border bg-background px-2 py-1 font-mono text-[10px]">
                <option value="">— none —</option>
                {nodes.filter((n) => n.id.startsWith("agent:")).map((n) => <option key={n.id} value={n.id.replace("agent:", "")}>{n.label}</option>)}
              </select>
            </label>
          )}
          {mode === "REASSIGN_WORK" && (
            <label className="mt-2 block">
              <span className="font-mono text-[9px] uppercase tracking-wider text-zinc-500">target colony</span>
              <select value={target} onChange={(e) => setTarget(e.target.value)} className="mt-1 w-full rounded border bg-background px-2 py-1 font-mono text-[10px]">
                <option value="">— none —</option>
                {nodes.filter((n) => n.id.startsWith("colony:")).map((n) => <option key={n.id} value={n.id.replace("colony:", "")}>{n.label}</option>)}
              </select>
            </label>
          )}
          {impact && (
            <div className="mt-2 grid grid-cols-3 gap-1 font-mono text-[10px] text-amber-300">
              {Object.entries(impact).filter(([, v]) => typeof v === "number").slice(0, 6).map(([k, v]) => (
                <div key={k}><span className="text-zinc-600">{k}</span> {v as number}</div>
              ))}
            </div>
          )}
        </div>
        <div className="mt-3 flex justify-end gap-2">
          <button onClick={onCancel} className="rounded border border-zinc-800 px-3 py-1.5 font-mono text-[11px] text-zinc-400 hover:text-zinc-200">Cancel</button>
          <button
            onClick={() =>
              onConfirm(mode, {
                target: mode === "REASSIGN_TASKS" || mode === "REPLACE_AGENT" ? target : undefined,
                targetColony: mode === "REASSIGN_WORK" ? target : undefined,
              })
            }
            className="rounded border border-red-900 bg-red-950/60 px-3 py-1.5 font-mono text-[11px] font-bold text-red-200 hover:bg-red-900/60"
          >
            Execute {mode}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function TopologyPage() {
  useEffect(() => {
    document.body.dataset.canvas = "topology";
    return () => {
      delete document.body.dataset.canvas;
    };
  }, []);

  return (
    <ReactFlowProvider>
      <LiveTopology />
    </ReactFlowProvider>
  );
}