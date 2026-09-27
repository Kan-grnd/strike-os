import { Handle, Position, type NodeProps } from "@xyflow/react";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Building2, FoldVertical, Plus } from "lucide-react";
import type { ColonyRuntime } from "@/lib/runtime/types";
import type { TopologyNodeData } from "@/lib/runtime/selectors";
import { specialistLabel } from "@/lib/runtime/layout";
import { CardButton } from "./card-button";

interface SpecialistNodeData extends TopologyNodeData<ColonyRuntime> {
  stats?: { total: number; active: number; waiting: number; errors: number };
  expanded?: boolean;
  toggle?: (id: string) => void;
}

const COLONY_STATUS_VARIANT: Record<string, "success" | "warning" | "secondary" | "destructive"> = {
  ACTIVE: "success",
  PAUSED: "warning",
  STOPPED: "secondary",
  FAILED: "destructive",
  ARCHIVED: "secondary",
};

export function SpecialistNode({ id, data }: NodeProps) {
  const d = data as unknown as SpecialistNodeData;
  const entity = d.entity as ColonyRuntime;
  const stats = d.stats ?? { total: 0, active: 0, waiting: 0, errors: 0 };
  const expanded = d.expanded ?? false;

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`Territory ${entity.name} — ${stats.total} agents, ${stats.active} active`}
      title={entity.name}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          d.activate?.(id, "specialist");
        }
      }}
      className="node-list-in group relative w-64 cursor-pointer rounded-lg border border-border bg-card px-4 py-3 shadow-sm transition-colors hover:border-primary/50 hover:bg-accent/40"
    >
      <Handle type="target" position={Position.Top} id="in" />
      <Handle type="source" position={Position.Bottom} id="out" />
      <div className="flex items-center justify-between gap-3">
        <span className="flex min-w-0 items-center gap-1.5">
          <Building2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
          <span className="truncate text-sm font-semibold">{specialistLabel(entity)}</span>
        </span>
        <Badge variant={COLONY_STATUS_VARIANT[entity.status] ?? "secondary"} className="shrink-0 capitalize">
          {entity.status.toLowerCase()}
        </Badge>
      </div>
      <Separator className="my-2" />
      <p className="font-mono text-xs text-muted-foreground">
        {stats.total} agents, {stats.active} active
      </p>
      <div className="mt-2 flex flex-wrap items-center justify-end gap-2">
        {stats.total > 0 && (
          <CardButton
            variant="outline"
            size="sm"
            className="h-8 px-2.5 text-xs"
            onClick={() => d.toggle?.(id)}
            aria-expanded={expanded}
          >
            {expanded ? <FoldVertical className="h-3.5 w-3.5" aria-hidden /> : <Plus className="h-3.5 w-3.5" aria-hidden />}
            {expanded ? "Hide" : `Show agents (${stats.total})`}
          </CardButton>
        )}
        <CardButton
          variant="ghost"
          size="sm"
          className="h-8 px-2.5 text-xs"
          onClick={() => d.activate?.(id, "specialist")}
        >
          Details
        </CardButton>
      </div>
    </div>
  );
}