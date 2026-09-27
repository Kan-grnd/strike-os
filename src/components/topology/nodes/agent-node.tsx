import { Handle, Position, type NodeProps } from "@xyflow/react";
import { Badge } from "@/components/ui/badge";
import type { AgentRuntime, TopologyBand } from "@/lib/runtime/types";
import type { TopologyNodeData } from "@/lib/runtime/selectors";
import { agentStatePresentation } from "@/lib/runtime/presentation";
import { cn } from "@/lib/utils";

export interface AgentNodeData extends TopologyNodeData<AgentRuntime> {
  operation?: string;
}

interface AgentShellProps {
  id: string;
  activate?: (id: string, type: string) => void;
  data: AgentNodeData;
  nodeType: "agent" | "subagent";
}

export function AgentShell({ id, activate, data, nodeType }: AgentShellProps) {
  const entity = data.entity as AgentRuntime;
  const presenting = agentStatePresentation(entity.runtimeState);
  const Icon = presenting.icon;
  const band: TopologyBand = data.band ?? "agents";
  const attention = entity.runtimeState === "waiting_for_approval" || entity.runtimeState === "blocked";
  const small = nodeType === "subagent";

  const elevation = cn(
    "group relative rounded-lg bg-card px-3 py-2 shadow-sm",
    small ? "w-32" : "w-40",
    "cursor-pointer hover:ring-1 hover:ring-primary/30",
    attention && "ring-1 ring-warning/50",
    band === "agents" && "border border-foreground/15 shadow-md",
    band === "operations" && "border border-primary/40 shadow-lg",
    band === "metadata" && "border border-primary/50 shadow-xl ring-1 ring-primary/20"
  );

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`${nodeType === "subagent" ? "Sub-agent" : "Agent"} ${entity.name} — ${presenting.label}`}
      title={`${entity.name} — ${presenting.label}${entity.type ? ` (${entity.type})` : ""}; inspect for details`}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          activate?.(id, nodeType);
        }
      }}
      className={elevation}
    >
      <Handle type="target" position={Position.Top} id="in" />
      <Handle type="source" position={Position.Bottom} id="out" />
      <div className="flex items-center justify-between gap-2">
        <span className={cn("truncate font-semibold", small ? "text-xs" : "text-sm")}>
          {entity.name}
        </span>
        <Badge variant={presenting.variant} className="shrink-0 gap-1">
          <Icon
            className={cn("h-3 w-3", entity.runtimeState === "initializing" && "animate-spin")}
            aria-hidden
          />
          {small ? presenting.label.slice(0, 2).toUpperCase() : presenting.label}
        </Badge>
      </div>
      {data.operation && (
        <p className="mt-0.5 truncate text-xs text-muted-foreground" title={data.operation}>
          ↳ {data.operation}
        </p>
      )}
      <div className="mt-1.5 flex justify-end">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            activate?.(id, nodeType);
          }}
          onKeyDown={(e) => e.stopPropagation()}
          className="rounded-md border border-border bg-background/60 px-2 py-0.5 text-[11px] font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/40"
        >
          Inspect
        </button>
      </div>
    </div>
  );
}

export function AgentNode({ id, data }: NodeProps) {
  const d = data as unknown as AgentNodeData;
  return <AgentShell id={id} activate={d.activate} data={d} nodeType="agent" />;
}