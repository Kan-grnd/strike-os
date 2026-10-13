"use client";

import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Brain, Building2, X, Cpu, Bot, Play } from "lucide-react";
import { useRuntime, useTempEdges, useConnection } from "@/lib/runtime/useRuntime";
import {
  agentStatePresentation,
  brainStatePresentation,
  formatDate,
  formatState,
} from "@/lib/runtime/presentation";
import { getTerritoryStats } from "@/lib/runtime/selectors";
import type { AgentRuntime, ColonyRuntime, TaskRuntime, WorkforceRuntime } from "@/lib/runtime/types";
import { cn } from "@/lib/utils";

export type InspectorSelection =
  | { type: "system" }
  | { type: "territory"; id: string }
  | { type: "agent"; id: string }
  | { type: "subagent"; id: string }
  | { type: "operation"; id: string };

function Row({ label, children }: { label: string; children?: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 py-1.5">
      <span className="text-xs text-muted-foreground shrink-0">{label}</span>
      <span className="text-xs font-medium text-right truncate">{children ?? "—"}</span>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h4 className="mt-3 text-[11px] font-semibold text-muted-foreground first:mt-0">
      {children}
    </h4>
  );
}

function AgentListRow({
  agent,
  onOpen,
}: {
  agent: AgentRuntime;
  onOpen?: (id: string) => void;
}) {
  const presentation = agentStatePresentation(agent.runtimeState);
  const Icon = presentation.icon;
  return (
    <button
      type="button"
      onClick={() => onOpen?.(agent.id)}
      className="flex w-full items-center justify-between gap-2 rounded-xl px-1.5 py-1 text-left text-xs hover:bg-accent"
    >
      <span className="flex items-center gap-1.5 truncate font-medium">
        <Icon className="h-3 w-3 shrink-0 text-muted-foreground" aria-hidden />
        <span className="truncate">{agent.name}</span>
      </span>
      <span className="shrink-0 text-muted-foreground font-mono">
        {presentation.label.toLowerCase()}
      </span>
    </button>
  );
}

export function InspectorPanel({
  selection,
  onClose,
  onOpenAgent,
  narrow = false,
}: {
  selection: InspectorSelection;
  onClose: () => void;
  onOpenAgent?: (id: string) => void;
  narrow?: boolean;
}) {
  const runtime = useRuntime();
  const tempEdges = useTempEdges();
  const data = useMemo(() => {
    if (!runtime) return null;
    const byAgent = new Map(runtime.agents.map((a) => [a.id, a]));
    const byColony = new Map(runtime.colonies.map((c) => [c.id, c]));
    const byTask = new Map(runtime.tasks.map((t) => [t.id, t]));
    const subAgents = (agentId: string) =>
      runtime.agents.filter((a) => a.parentId === agentId);
    const taskTitle = (taskId?: string) => {
      if (!taskId) return undefined;
      return byTask.get(taskId)?.description;
    };
    return { byAgent, byColony, byTask, subAgents, taskTitle, runtime };
  }, [runtime]);

  /* `data-topology-overlay` on both the loading and the loaded sheet: this
   * panel is the one overlay big enough to sit on top of a branch, so the
   * topology camera measures it and keeps the graph clear of it. It measures
   * the sheet rather than being told how wide it is, so the two cannot drift. */
  if (!data || !runtime) {
    return (
      <div
        role="dialog"
        aria-label="Topology inspector"
        data-topology-overlay
        onKeyDown={(e) => {
          if (e.key === "Escape") onClose();
        }}
        className={cn(
          "flex flex-col rounded-xl border glass-elevated transition-[opacity,border-color,box-shadow] duration-200 motion-reduce:transition-none",
          narrow
            ? "fixed bottom-0 left-0 right-0 z-50 max-h-[70vh] w-full rounded-t-xl border-b-0"
            : "absolute top-20 right-4 z-40 max-h-[calc(100vh-6rem)] w-72"
        )}
      >
        {/* The sheet has no drag behaviour, so the grab-bar affordance is gone
            rather than left on screen as a control that does nothing. */}
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <span className="text-sm font-semibold text-muted-foreground">Loading…</span>
          <Button variant="ghost" size="sm" onClick={onClose} aria-label="Close inspector" className="h-7 w-7 p-0">
            <X className="h-4 w-4" />
          </Button>
        </div>
        <ScrollArea className="flex-1 min-h-0">
          <div className="px-4 py-4 space-y-3">
            <div className="h-4 w-3/4 animate-pulse motion-reduce:animate-none bg-muted rounded" />
            <div className="h-4 w-1/2 animate-pulse motion-reduce:animate-none bg-muted rounded" />
            <div className="h-4 w-5/6 animate-pulse motion-reduce:animate-none bg-muted rounded" />
            <div className="h-4 w-1/3 animate-pulse motion-reduce:animate-none bg-muted rounded" />
          </div>
        </ScrollArea>
      </div>
    );
  }

  const ICON = { system: Brain, territory: Building2, agent: Cpu, subagent: Bot, operation: Play }[selection.type];
  const HeaderIcon = ICON;

  const isOpen = true; // controlled by parent

  return (
    <div
      role="dialog"
      aria-label="Topology inspector"
      data-topology-overlay
      onKeyDown={(e) => {
        if (e.key === "Escape") onClose();
      }}
      className={cn(
        "flex flex-col rounded-xl border glass-elevated transition-[opacity,border-color,box-shadow] duration-200 motion-reduce:transition-none",
        narrow
          ? "fixed bottom-0 left-0 right-0 z-50 max-h-[70vh] w-full rounded-t-xl border-b-0"
          : "absolute top-20 right-4 z-40 max-h-[calc(100vh-6rem)] w-72"
      )}
    >
      <div className="flex items-center justify-between border-b border-border px-4 py-3 flex-shrink-0">
        <span className="flex items-center gap-2 text-sm font-semibold">
          <HeaderIcon className="h-4 w-4 text-muted-foreground" aria-hidden />
          {selection.type === "system"
            ? "System Inspector"
            : selection.type === "territory"
            ? "Territory"
            : selection.type === "subagent"
            ? "Sub-agent"
            : selection.type === "agent"
            ? "Agent"
            : "Operation"}
        </span>
        <Button variant="ghost" size="sm" onClick={onClose} aria-label="Close inspector" className="h-7 w-7 p-0">
          <X className="h-4 w-4" />
        </Button>
      </div>
      <ScrollArea className="flex-1 min-h-0">
        <div className="px-4 py-4">
          {selection.type === "system" && <SystemInspector runtime={runtime} />}
          {selection.type === "territory" && (
            <TerritoryInspector
              colony={data.byColony.get(selection.id) as ColonyRuntime | undefined}
              onOpenAgent={onOpenAgent}
            />
          )}
          {selection.type === "agent" && (
            <AgentInspector
              agent={data.byAgent.get(selection.id)}
              onOpenAgent={onOpenAgent}
            />
          )}
          {selection.type === "subagent" && (
            <AgentInspector
              agent={data.byAgent.get(selection.id)}
              sub
              onOpenAgent={onOpenAgent}
            />
          )}
          {selection.type === "operation" && (
            <OperationInspector
              task={data.byTask.get(selection.id)}
              onOpenAgent={onOpenAgent}
            />
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

function SystemInspector({ runtime }: { runtime: WorkforceRuntime }) {
  const presenting = brainStatePresentation(runtime.brain.state);
  const Icon = presenting.icon;
  const connection = useConnection();
  return (
    <>
      <div className="flex items-center justify-between">
        <span className="text-lg font-bold tracking-tight">STRIKE BRAIN</span>
        <Badge variant={presenting.variant} className="gap-1.5">
          <Icon className="h-3 w-3" aria-hidden />
          {presenting.label}
        </Badge>
      </div>
      <SectionTitle>Workforce</SectionTitle>
      <Row label="Agents">{runtime.brain.agentCount}</Row>
      <Row label="Active">{runtime.brain.activeCount}</Row>
      <Row label="Waiting">{runtime.brain.waitingCount}</Row>
      <Row label="Errors">{runtime.brain.errorCount}</Row>
      <Row label="Missions">{runtime.brain.missionCount}</Row>
      <Row label="Operations">{runtime.brain.operationCount}</Row>
      <Row label="Territories">{runtime.brain.colonyCount}</Row>
      <Separator className="my-2" />
      <SectionTitle>Infrastructure</SectionTitle>
      <Row label="Providers">{runtime.system.providerCount}</Row>
      <Row label="Models">{runtime.system.modelCount}</Row>
      <Row label="MCP">{runtime.system.mcpCount}</Row>
      <Row label="Memory">{runtime.system.memoryCount}</Row>
      <Separator className="my-2" />
      <SectionTitle>Control Plane</SectionTitle>
      <Row label="Connection">{connection}</Row>
      <Row label="Last sync">{formatDate(runtime.generatedAt)}</Row>
      <p className="mt-3 text-xs text-muted-foreground">
        Double-click the brain to reset the view. Use the buttons on a card to
        show or hide what's inside it.
      </p>
    </>
  );
}

function TerritoryInspector({
  colony,
  onOpenAgent,
}: {
  colony?: ColonyRuntime;
  onOpenAgent?: (id: string) => void;
}) {
  const runtime = useRuntime();
  if (!colony || !runtime) return <p className="text-xs text-muted-foreground">Territory not found.</p>;
  const stats = getTerritoryStats(runtime, colony.id);
  const members = runtime.agents.filter(
    (a) => a.colonyId === colony.id && !["cancelled", "stopped"].includes(a.runtimeState)
  );
  return (
    <>
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-base font-semibold">{colony.name}</span>
        <Badge variant={colony.status === "ACTIVE" ? "success" : colony.status === "PAUSED" ? "warning" : "secondary"}>
          {formatState(colony.status)}
        </Badge>
      </div>
      <SectionTitle>Stats</SectionTitle>
      <Row label="Agents">{stats.total}</Row>
      <Row label="Active">{stats.active}</Row>
      <Row label="Waiting">{stats.waiting}</Row>
      <Row label="Errors">{stats.errors}</Row>
      <SectionTitle>Members</SectionTitle>
      {members.length === 0 && <p className="text-xs text-muted-foreground">No agents.</p>}
      {members.map((a) => (
        <AgentListRow key={a.id} agent={a} onOpen={onOpenAgent} />
      ))}
    </>
  );
}

function AgentInspector({
  agent,
  sub,
  onOpenAgent,
}: {
  agent?: AgentRuntime;
  sub?: boolean;
  onOpenAgent?: (id: string) => void;
}) {
  const runtime = useRuntime();
  const tempEdges = useTempEdges();
  if (!agent || !runtime) return <p className="text-xs text-muted-foreground">Agent not found.</p>;
  const presentation = agentStatePresentation(agent.runtimeState);
  const Icon = presentation.icon;
  const parent = agent.parentId ? runtime.agents.find((a) => a.id === agent.parentId) : undefined;
  const children = runtime.agents.filter((a) => a.parentId === agent.id && !["cancelled", "stopped"].includes(a.runtimeState));
  const allAgents = runtime.agents.filter((a) => !["cancelled", "stopped"].includes(a.runtimeState));
  const operation = agent.currentTaskId ? runtime.tasks.find((t) => t.id === agent.currentTaskId) : undefined;
  const verification = tempEdges.filter((e) => e.kind === "verification" && (e.source === agent.id || e.target === agent.id));
  const recoveryNotes = operation && operation.retryCount > 0 ? `${operation.retryCount}/${operation.maxRetries} retries` : undefined;

  return (
    <>
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-base font-semibold">{agent.name}</span>
        <Badge variant={presentation.variant} className="gap-1.5">
          <Icon className="h-3 w-3" aria-hidden />
          {presentation.label}
        </Badge>
      </div>
      <SectionTitle>Runtime</SectionTitle>
      <Row label="Role">{agent.type}</Row>
      <Row label="Status">{formatState(agent.runtimeState)}</Row>
      <Row label="Model">{agent.models.join(", ") || "—"}</Row>
      <Row label="Last active">{formatDate(agent.lastActiveAt)}</Row>
      <Row label="Health">{Math.round(agent.successRate)}% ok</Row>
      <Separator className="my-2" />
      <SectionTitle>Hierarchy</SectionTitle>
      <Row label="Parent">
        {parent ? (
          <button type="button" onClick={() => onOpenAgent?.(parent.id)} className="underline hover:text-foreground">
            {parent.name}
          </button>
        ) : (
          sub ? "—" : "Root agent"
        )}
      </Row>
      <Row label={sub ? "Sub-agents" : "Sub-agents"}>{children.length}</Row>
      {children.map((c) => (
        <AgentListRow key={c.id} agent={c} onOpen={onOpenAgent} />
      ))}
      {(agent.currentTaskId || verification.length > 0 || recoveryNotes) && (
        <>
          <Separator className="my-2" />
          <SectionTitle>Execution</SectionTitle>
          <Row label="Operation">
            {operation?.description ?? (agent.currentTaskId ? "queued" : "—")}
          </Row>
          {verification.length > 0 && (
            <Row label="Verification">{verification.some((v) => v.taskId) ? "Active" : "Active"}</Row>
          )}
          {recoveryNotes && <Row label="Recovery">{recoveryNotes}</Row>}
        </>
      )}
      <p className="mt-3 text-xs text-muted-foreground">Total cost ${agent.totalCost.toFixed(2)} · {allAgents.length} agents live</p>
    </>
  );
}

function OperationInspector({
  task,
  onOpenAgent,
}: {
  task?: TaskRuntime;
  onOpenAgent?: (id: string) => void;
}) {
  const runtime = useRuntime();
  const tempEdges = useTempEdges();
  if (!task || !runtime) return <p className="text-xs text-muted-foreground">Operation not found.</p>;
  const owner = task.ownerAgentId ? runtime.agents.find((a) => a.id === task.ownerAgentId) : undefined;
  const verification = tempEdges.filter((e) => e.kind === "verification" && (e.taskId === task.id || e.target === task.id));
  const delegation = tempEdges.filter((e) => e.kind === "delegation" && e.taskId === task.id);
  const statusVariant =
    task.status === "RUNNING"
      ? "info"
      : task.status === "FAILED"
      ? "destructive"
      : task.status === "WAITING"
      ? "warning"
      : task.status === "COMPLETED"
      ? "success"
      : "secondary";
  return (
    <>
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-sm font-semibold">{task.description}</span>
        <Badge variant={statusVariant} className="uppercase">{formatState(task.status)}</Badge>
      </div>
      <SectionTitle>Execution</SectionTitle>
      <Row label="Owner">
        {owner ? (
          <button type="button" onClick={() => onOpenAgent?.(owner.id)} className="underline hover:text-foreground">
            {owner.name}
          </button>
        ) : (
          "unassigned"
        )}
      </Row>
      <Row label="Mission">{task.missionId.slice(0, 10)}</Row>
      <Row label="Retries">{task.retryCount}/{task.maxRetries}</Row>
      <Row label="Started">{formatDate(task.timestamps.createdAt)}</Row>
      <Row label="Dependencies">{task.dependencies.length}</Row>
      <Row label="Cost">${task.cost.toFixed(2)}</Row>
      {delegation.length > 0 && (
        <>
          <Separator className="my-2" />
          <SectionTitle>Delegation</SectionTitle>
          <Row label="Delegated">{delegation.map((d) => d.label ?? "yes").join(", ")}</Row>
        </>
      )}
      {verification.length > 0 && (
        <>
          <Separator className="my-2" />
          <SectionTitle>Verification</SectionTitle>
          <Row label="Status">In progress</Row>
        </>
      )}
      <p className="mt-3 text-xs text-muted-foreground">
        Transient operation — removed from the live topology once complete.
      </p>
    </>
  );
}