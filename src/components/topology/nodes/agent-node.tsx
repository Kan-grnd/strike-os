import { Handle, Position, type NodeProps } from "@xyflow/react";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { FoldVertical, Plus } from "lucide-react";
import type { AgentRuntime } from "@/lib/runtime/types";
import type { TopologyNodeData } from "@/lib/runtime/selectors";
import { agentStatePresentation } from "@/lib/runtime/presentation";
import { cn } from "@/lib/utils";
import { CardButton } from "./card-button";
import { ActionRow } from "./action-row";

export interface AgentNodeData extends TopologyNodeData<AgentRuntime> {
  operation?: string;
  expandedSub?: boolean;
  expandedOps?: boolean;
  subCount?: number;
  opCount?: number;
  toggle?: (id: string, dim?: "sub" | "ops") => void;
}

interface AgentShellProps {
  id: string;
  activate?: (id: string, type: string) => void;
  data: AgentNodeData;
  nodeType: "agent" | "subagent";
}

function AgentToggle({
  expanded,
  count,
  label,
  onToggle,
}: {
  expanded: boolean;
  count: number;
  label: string;
  onToggle: () => void;
}) {
  const Icon = expanded ? FoldVertical : Plus;
  return (
    <CardButton
      variant="outline"
      size="sm"
      className="h-8 px-2.5 text-xs"
      onClick={onToggle}
      aria-expanded={expanded}
    >
      <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden />
      {expanded ? "Hide" : `${label} (${count})`}
    </CardButton>
  );
}

export function AgentShell({ id, activate, data, nodeType }: AgentShellProps) {
  const entity = data.entity as AgentRuntime;
  const presenting = agentStatePresentation(entity.runtimeState);
  const Icon = presenting.icon;
  const attention =
    entity.runtimeState === "waiting_for_approval" || entity.runtimeState === "blocked";
  const small = nodeType === "subagent";
  const expandedSub = data.expandedSub ?? false;
  const expandedOps = data.expandedOps ?? false;

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
        "node-list-in group relative cursor-pointer rounded-lg border border-border bg-card px-4 py-3 shadow-sm transition-colors hover:border-primary/50 hover:bg-accent/40 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
        small ? "w-60" : "w-64",
        attention && "ring-1 ring-warning/50"
      )}
    >
      <Handle type="target" position={Position.Top} id="in" />
      <Handle type="source" position={Position.Bottom} id="out" />
      <div className="flex items-center justify-between gap-3">
        <span className={cn("min-w-0 truncate font-semibold", small ? "text-xs" : "text-sm")}>
          {entity.name}
        </span>
        <Badge variant={presenting.variant} className="shrink-0 gap-1">
          <Icon
            className={cn("h-3 w-3", entity.runtimeState === "initializing" && "animate-spin")}
            aria-hidden
          />
          {presenting.label}
        </Badge>
      </div>
      <Separator className="my-2" />
      {data.operation ? (
        <p className="truncate font-mono text-xs text-muted-foreground" title={data.operation}>
          {data.operation}
        </p>
      ) : null}
      <ActionRow className="mt-2 flex flex-wrap items-center justify-end gap-2">
        {(data.subCount ?? 0) > 0 && (
          <AgentToggle
            expanded={expandedSub}
            count={data.subCount ?? 0}
            label="Sub-agents"
            onToggle={() => data.toggle?.(id, "sub")}
          />
        )}
        {(data.opCount ?? 0) > 0 && (
          <AgentToggle
            expanded={expandedOps}
            count={data.opCount ?? 0}
            label="Operations"
            onToggle={() => data.toggle?.(id, "ops")}
          />
        )}
        <CardButton
          variant="ghost"
          size="sm"
          className="h-8 px-2.5 text-xs"
          onClick={() => activate?.(id, nodeType)}
        >
          Details
        </CardButton>
      </ActionRow>
    </div>
  );
}

export function AgentNode({ id, data }: NodeProps) {
  const d = data as unknown as AgentNodeData;
  return <AgentShell id={id} activate={d.activate} data={d} nodeType="agent" />;
}