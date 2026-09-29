import { Handle, Position, type NodeProps } from "@xyflow/react";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import type { BrainRuntime, SystemRuntime } from "@/lib/runtime/types";
import { HANDLE_IDS, type TopologyNodeData } from "@/lib/runtime/selectors";
import { brainStatePresentation } from "@/lib/runtime/presentation";
import { CardButton } from "./card-button";
import { ActionRow } from "./action-row";
import { SideHandles } from "./side-handles";

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
      className="node-list-in group relative w-64 cursor-pointer rounded-lg border border-border bg-card px-3 py-2 shadow-sm transition-colors hover:border-primary/50 hover:bg-accent/40"
    >
      <Handle type="source" position={Position.Bottom} id={HANDLE_IDS.out} />
      <SideHandles source />
      <div className="flex items-center justify-between gap-3">
        <span className="min-w-0 truncate text-sm font-bold tracking-tight">STRIKE BRAIN</span>
        <Badge variant={presenting.variant} className="shrink-0 gap-1.5">
          <Icon className="h-3 w-3" aria-hidden />
          {presenting.label}
        </Badge>
      </div>
      <Separator className="my-1.5" />
      <p className="font-mono text-[11px] leading-relaxed text-muted-foreground">
        {entity.activeCount}/{entity.agentCount} active, {entity.operationCount} operations,{" "}
        {entity.missionCount} mission{entity.missionCount === 1 ? "" : "s"}
      </p>
      <ActionRow className="mt-1.5 flex flex-nowrap items-center justify-end gap-1.5 overflow-hidden">
        <div className="flex flex-nowrap items-center gap-1.5">
          {territoryCount > 0 && (
            <CardButton
              variant="outline"
              size="sm"
              className="h-7 shrink-0 whitespace-nowrap px-1.5 text-xs"
              onClick={() => d.expandAll?.()}
              aria-expanded={allExpanded}
            >
              {allExpanded ? "Collapse all" : "Expand all"}
            </CardButton>
          )}
          <CardButton
            variant="ghost"
            size="sm"
            className="h-7 shrink-0 whitespace-nowrap px-2 text-xs"
            onClick={() => d.activate?.(id, "brain")}
          >
            Details
          </CardButton>
        </div>
      </ActionRow>
    </div>
  );
}