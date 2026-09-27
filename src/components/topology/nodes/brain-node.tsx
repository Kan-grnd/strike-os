import { Handle, Position, type NodeProps } from "@xyflow/react";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import type { BrainRuntime, SystemRuntime } from "@/lib/runtime/types";
import type { TopologyNodeData } from "@/lib/runtime/selectors";
import { brainStatePresentation } from "@/lib/runtime/presentation";
import { CardButton } from "./card-button";
import { ActionRow } from "./action-row";

interface BrainNodeData extends TopologyNodeData<BrainRuntime> {
  system?: SystemRuntime;
  territoryCount?: number;
  allExpanded?: boolean;
  expandAll?: () => void;
}

export function BrainNode({ id, data }: NodeProps) {
  const d = data as unknown as BrainNodeData;
  const entity = d.entity as BrainRuntime;
  const presenting = brainStatePresentation(entity.state);
  const Icon = presenting.icon;
  const territoryCount = d.territoryCount ?? 0;
  const allExpanded = d.allExpanded ?? false;

  return (
    /* Shell only — it contains real buttons, so it must not claim to be one. */
    <div
      title="STRIKE BRAIN — inspect the complete topology"
      className="node-list-in group relative w-72 cursor-pointer rounded-lg border border-border bg-card px-4 py-3 shadow-sm transition-colors hover:border-primary/50 hover:bg-accent/40"
    >
      <Handle type="source" position={Position.Bottom} id="out" />
      <div className="flex items-center justify-between gap-3">
        <span className="min-w-0 truncate text-base font-bold tracking-tight">STRIKE BRAIN</span>
        <Badge variant={presenting.variant} className="shrink-0 gap-1.5">
          <Icon className="h-3 w-3" aria-hidden />
          {presenting.label}
        </Badge>
      </div>
      <Separator className="my-2.5" />
      <p className="font-mono text-xs leading-relaxed text-muted-foreground">
        {entity.activeCount}/{entity.agentCount} active, {entity.operationCount} operations,{" "}
        {entity.missionCount} mission{entity.missionCount === 1 ? "" : "s"}
      </p>
      <ActionRow className="mt-2.5 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          {territoryCount > 0 && (
            <CardButton
              variant="outline"
              size="sm"
              className="h-8 px-2.5 text-xs"
              onClick={() => d.expandAll?.()}
              aria-expanded={allExpanded}
            >
              {allExpanded ? "Collapse all" : "Expand all"}
            </CardButton>
          )}
          <CardButton
            variant="ghost"
            size="sm"
            className="h-8 px-2.5 text-xs"
            onClick={() => d.activate?.(id, "brain")}
          >
            Details
          </CardButton>
        </div>
      </ActionRow>
    </div>
  );
}