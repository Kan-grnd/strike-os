import { Handle, Position, type NodeProps } from "@xyflow/react";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
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

/* Disclosure toggle. Two compactness decisions live here:
 *  1. The visible word is shortened ("Sub"/"Ops") so a worker with BOTH toggles
 *     plus Details still fits one line — a wrapped action row inflated the card
 *     from 104px to 161px and pushed every row below it down.
 *  2. No icon. The word already names the control, and at sub-agent width
 *     (w-56) the icon + its gap left only 7px of slack, enough to clip Details.
 * Full wording stays in the accessible name and the tooltip. */
function AgentToggle({
  expanded,
  count,
  label,
  short,
  onToggle,
}: {
  expanded: boolean;
  count: number;
  label: string;
  short: string;
  onToggle: () => void;
}) {
  const accessible = expanded ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()} (${count})`;
  return (
    <CardButton
      variant="outline"
      size="sm"
      className="h-7 shrink-0 gap-1 whitespace-nowrap px-1.5 text-xs"
      onClick={onToggle}
      aria-expanded={expanded}
      aria-label={accessible}
      title={accessible}
    >
      {expanded ? "Hide" : `${short} ${count}`}
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
    /* Not a button: the card holds real buttons (Details, Sub-agents,
     * Operations), and a role="button" wrapper would nest one interactive
     * element inside another and swallow their keyboard events. Clicking the
     * card body still works (React Flow owns that); keyboard users reach the
     * same inspector through the Details button. */
    <div
      title={`${entity.name} — ${presenting.label}${entity.type ? ` (${entity.type})` : ""}; inspect for details`}
      className={cn(
        "node-list-in group relative cursor-pointer rounded-lg border border-border bg-card px-3 py-2 shadow-sm transition-colors hover:border-primary/50 hover:bg-accent/40",
        small ? "w-56" : "w-60",
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
            className={cn("h-3 w-3", entity.runtimeState === "initializing" && "animate-spin motion-reduce:animate-none")}
            aria-hidden
          />
          {presenting.label}
        </Badge>
      </div>
      <Separator className="my-1.5" />
      {data.operation ? (
        <p className="truncate font-mono text-[11px] text-muted-foreground" title={data.operation}>
          {data.operation}
        </p>
      ) : null}
      {/* flex-nowrap is load-bearing: a wrapping action row grew the card by
        40px and overlapped the row below. */}
      <ActionRow className="mt-1.5 flex flex-nowrap items-center justify-end gap-1.5 overflow-hidden">
        {(data.subCount ?? 0) > 0 && (
          <AgentToggle
            expanded={expandedSub}
            count={data.subCount ?? 0}
            label="Sub-agents"
            short="Sub"
            onToggle={() => data.toggle?.(id, "sub")}
          />
        )}
        {(data.opCount ?? 0) > 0 && (
          <AgentToggle
            expanded={expandedOps}
            count={data.opCount ?? 0}
            label="Operations"
            short="Ops"
            onToggle={() => data.toggle?.(id, "ops")}
          />
        )}
        <CardButton
          variant="ghost"
          size="sm"
          className="h-7 shrink-0 whitespace-nowrap px-2 text-xs"
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