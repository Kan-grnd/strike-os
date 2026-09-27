import { Handle, Position, type NodeProps } from "@xyflow/react";
import { Badge } from "@/components/ui/badge";
import type { BrainRuntime, SystemRuntime, TopologyBand } from "@/lib/runtime/types";
import type { TopologyNodeData } from "@/lib/runtime/selectors";
import { brainStatePresentation } from "@/lib/runtime/presentation";
import { cn } from "@/lib/utils";

interface BrainNodeData extends TopologyNodeData<BrainRuntime> {
  system?: SystemRuntime;
}

export function BrainNode({ id, data }: NodeProps) {
  const d = data as unknown as BrainNodeData;
  const entity = d.entity as BrainRuntime;
  const presenting = brainStatePresentation(entity.state);
  const Icon = presenting.icon;
  const band: TopologyBand = d.band ?? "specialist";

  const elevation = cn(
    "group relative min-w-52 rounded-2xl bg-card px-4 py-3",
    "cursor-pointer hover:ring-1 hover:ring-primary/30",
    band === "specialist" && "border border-foreground/15 shadow-md",
    band === "agents" && "border border-foreground/30 shadow-lg",
    band === "operations" && "border border-primary/40 shadow-lg",
    band === "metadata" && "border border-primary/50 shadow-xl ring-1 ring-primary/20"
  );

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
      className={elevation}
    >
      <Handle type="source" position={Position.Bottom} id="out" />
      <div className="flex items-center justify-between gap-4">
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
      <div className="mt-2 flex justify-end">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            d.activate?.(id, "brain");
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