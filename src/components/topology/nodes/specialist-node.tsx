import { Handle, Position, type NodeProps } from "@xyflow/react";
import { Badge } from "@/components/ui/badge";
import { Building2 } from "lucide-react";
import type { ColonyRuntime } from "@/lib/runtime/types";
import type { TopologyNodeData } from "@/lib/runtime/selectors";
import { specialistLabel } from "@/lib/runtime/layout";
import { cn } from "@/lib/utils";
import { ExpandToggleButton, LevelBar, LevelTag, NodeButton } from "./node-parts";

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
      className={cn(
        "node-list-in group relative max-w-48 cursor-pointer rounded-xl border border-foreground/15 bg-card px-3 py-2.5 shadow-md transition-colors hover:ring-1 hover:ring-primary/30"
      )}
    >
      <LevelBar level="territory" />
      <Handle type="target" position={Position.Top} id="in" />
      <Handle type="source" position={Position.Bottom} id="out" />
      <div className="flex items-center justify-between gap-2">
        <LevelTag level="territory" />
        <Badge variant={COLONY_STATUS_VARIANT[entity.status] ?? "secondary"} className="uppercase">
          {entity.status === "ARCHIVED" ? "archived" : entity.status}
        </Badge>
      </div>
      <div className="mt-1 flex items-center gap-1.5">
        <Building2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
        <span className="truncate text-sm font-semibold">{specialistLabel(entity)}</span>
      </div>
      <p className="mt-1 text-xs text-muted-foreground font-mono">
        {stats.total} agents · {stats.active} active
      </p>
      <div className="mt-2 flex flex-wrap items-center justify-end gap-2">
        {stats.total > 0 && (
          <ExpandToggleButton
            expanded={!!d.expanded}
            count={stats.total}
            label="Agents"
            onToggle={() => d.toggle?.(id)}
          />
        )}
        <NodeButton onClick={() => d.activate?.(id, "specialist")}>Inspect</NodeButton>
      </div>
    </div>
  );
}