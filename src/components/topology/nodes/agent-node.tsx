import { Handle, Position, type NodeProps } from "@xyflow/react";
import { Badge } from "@/components/ui/badge";
import type { AgentRuntime, TopologyBand } from "@/lib/runtime/types";
import type { TopologyNodeData } from "@/lib/runtime/selectors";
import { agentStatePresentation, formatDate } from "@/lib/runtime/presentation";
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
  const metadata = band === "metadata";
  const operational = band === "operations" || metadata;
  const attention = entity.runtimeState === "waiting_for_approval" || entity.runtimeState === "blocked";
  const small = nodeType === "subagent";

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`${nodeType === "subagent" ? "Sub-agent" : "Agent"} ${entity.name} — ${presenting.label}`}
      title={`${entity.name} — ${presenting.label}${entity.type ? ` (${entity.type})` : ""}; double-click to focus`}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          activate?.(id, nodeType);
        }
      }}
      className={cn(
        "relative rounded-lg border bg-card px-3 py-2 shadow-sm",
        small ? "min-w-36" : "min-w-44",
        attention && "ring-1 ring-warning/50"
      )}
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
          {small ? presenting.label.charAt(0) : presenting.label}
        </Badge>
      </div>
      {operational && (
        <p className={cn("mt-1 text-xs text-muted-foreground font-mono truncate", small && "hidden")}>
          {entity.type.toLowerCase()}
        </p>
      )}
      {data.operation && (
        <p className="mt-0.5 truncate text-xs text-muted-foreground" title={data.operation}>
          ↳ {data.operation}
        </p>
      )}
      {metadata && (
        <p className="mt-0.5 text-xs text-muted-foreground font-mono">
          {Math.round(entity.successRate)}% ok · {formatDate(entity.lastActiveAt)}
        </p>
      )}
    </div>
  );
}

export function AgentNode({ id, data }: NodeProps) {
  const d = data as unknown as AgentNodeData;
  return <AgentShell id={id} activate={d.activate} data={d} nodeType="agent" />;
}