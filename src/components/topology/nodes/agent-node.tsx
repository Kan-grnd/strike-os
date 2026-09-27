import { Handle, Position, type NodeProps } from "@xyflow/react";
import { Badge } from "@/components/ui/badge";
import type { AgentRuntime } from "@/lib/runtime/types";
import type { TopologyNodeData } from "@/lib/runtime/selectors";
import { agentStatePresentation } from "@/lib/runtime/presentation";
import { cn } from "@/lib/utils";
import { ExpandToggleButton, LevelBar, LevelTag, NodeButton } from "./node-parts";

export interface AgentNodeData extends TopologyNodeData<AgentRuntime> {
  operation?: string;
  expanded?: boolean;
  subCount?: number;
  opCount?: number;
  toggle?: (id: string) => void;
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
  const attention =
    entity.runtimeState === "waiting_for_approval" || entity.runtimeState === "blocked";
  const small = nodeType === "subagent";
  const level = nodeType === "subagent" ? "sub" : "agent";
  const expandable = (data.subCount ?? 0) + (data.opCount ?? 0);
  const expanded = data.expanded ?? false;

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
      className={cn(
        "node-list-in group relative rounded-lg border border-foreground/15 bg-card px-3 py-2 shadow-sm",
        small ? "w-44" : "w-48",
        "cursor-pointer transition-colors hover:ring-1 hover:ring-primary/30",
        attention && "ring-1 ring-warning/50"
      )}
    >
      <LevelBar level={level} />
      <Handle type="target" position={Position.Top} id="in" />
      <Handle type="source" position={Position.Bottom} id="out" />
      <div className="flex items-center justify-between gap-2">
        <LevelTag level={level} />
        <Badge variant={presenting.variant} className="shrink-0 gap-1">
          <Icon
            className={cn("h-3 w-3", entity.runtimeState === "initializing" && "animate-spin")}
            aria-hidden
          />
          {small ? presenting.label.slice(0, 2).toUpperCase() : presenting.label}
        </Badge>
      </div>
      <div className="mt-1">
        <span className={cn("block truncate font-semibold", small ? "text-xs" : "text-sm")}>
          {entity.name}
        </span>
      </div>
      {data.operation && (
        <p className="mt-0.5 truncate text-xs text-muted-foreground" title={data.operation}>
          ↳ {data.operation}
        </p>
      )}
      <div className="mt-1.5 flex flex-wrap items-center justify-end gap-2">
        {expandable > 0 && (
          <ExpandToggleButton
            expanded={expanded}
            count={expandable}
            label="Expand"
            onToggle={() => data.toggle?.(id)}
          />
        )}
        <NodeButton onClick={() => activate?.(id, nodeType)}>Inspect</NodeButton>
      </div>
    </div>
  );
}

export function AgentNode({ id, data }: NodeProps) {
  const d = data as unknown as AgentNodeData;
  return <AgentShell id={id} activate={d.activate} data={d} nodeType="agent" />;
}