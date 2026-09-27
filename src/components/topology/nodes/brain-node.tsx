import { Handle, Position, type NodeProps } from "@xyflow/react";
import { Badge } from "@/components/ui/badge";
import type { BrainRuntime, SystemRuntime } from "@/lib/runtime/types";
import type { TopologyNodeData } from "@/lib/runtime/selectors";
import { brainStatePresentation } from "@/lib/runtime/presentation";
import { LevelTag, NodeButton } from "./node-parts";

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
    <div
      role="button"
      tabIndex={0}
      aria-label={`Strike Brain — ${presenting.label}`}
      title="STRIKE BRAIN — inspect the complete topology"
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          d.activate?.(id, "brain");
        }
      }}
      className="node-list-in group relative min-w-56 cursor-pointer rounded-full border border-[hsl(var(--level-core))/60] bg-card px-7 py-3 text-center transition-colors hover:border-[hsl(var(--level-core))] glow-core"
    >
      <Handle type="source" position={Position.Bottom} id="out" />
      <div className="flex items-center justify-center gap-2">
        <LevelTag level="core" />
      </div>
      <div className="mt-1 flex items-center justify-between gap-4">
        <span className="text-base font-bold tracking-tight">
          STRIKE&nbsp;BRAIN
        </span>
        <Badge variant={presenting.variant} className="gap-1.5">
          <Icon className="h-3 w-3" aria-hidden />
          {presenting.label}
        </Badge>
      </div>
      <p className="mt-1.5 text-xs text-muted-foreground font-mono">
        {entity.activeCount}/{entity.agentCount} active · {entity.operationCount} operations ·{" "}
        {entity.missionCount} missions
      </p>
      <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
        {territoryCount > 0 && (
          <NodeButton
            active={!allExpanded}
            onClick={() => d.expandAll?.()}
            aria-expanded={allExpanded}
          >
            {allExpanded ? "Collapse all" : "Expand all"}
          </NodeButton>
        )}
        <NodeButton onClick={() => d.activate?.(id, "brain")}>Inspect</NodeButton>
      </div>
    </div>
  );
}