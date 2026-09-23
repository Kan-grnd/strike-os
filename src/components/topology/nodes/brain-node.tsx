import { Handle, Position, type NodeProps } from "@xyflow/react";
import { Badge } from "@/components/ui/badge";
import type { BrainRuntime, SystemRuntime, TopologyBand } from "@/lib/runtime/types";
import type { TopologyNodeData } from "@/lib/runtime/selectors";
import { brainStatePresentation } from "@/lib/runtime/presentation";

interface BrainNodeData extends TopologyNodeData<BrainRuntime> {
  system?: SystemRuntime;
}

export function BrainNode({ id, data }: NodeProps) {
  const d = data as unknown as BrainNodeData;
  const entity = d.entity as BrainRuntime;
  const presenting = brainStatePresentation(entity.state);
  const Icon = presenting.icon;
  const band: TopologyBand = d.band ?? "specialist";
  const detail = band === "metadata";

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`Strike Brain — ${presenting.label}`}
      title="STRIKE BRAIN — double-click to focus the complete topology"
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          d.activate?.(id, "brain");
        }
      }}
      className="relative min-w-64 rounded-2xl border-2 border-foreground/20 bg-card px-5 py-4 shadow-lg"
    >
      <Handle type="source" position={Position.Bottom} id="out" />
      <div className="flex items-center justify-between gap-4">
        <span className="text-lg font-bold tracking-tight">
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
      {detail && d.system && (
        <p className="mt-1 text-xs text-muted-foreground font-mono">
          {entity.waitingCount} waiting · {entity.errorCount} errors ·{" "}
          {d.system.memoryCount} memories · {d.system.mcpCount} MCP ·{" "}
          {d.system.providerCount} providers
        </p>
      )}
    </div>
  );
}