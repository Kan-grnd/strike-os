import { Handle, Position, type NodeProps } from "@xyflow/react";
import { Badge } from "@/components/ui/badge";
import { Building2 } from "lucide-react";
import type { ColonyRuntime, TopologyBand } from "@/lib/runtime/types";
import type { TopologyNodeData } from "@/lib/runtime/selectors";
import { specialistLabel } from "@/lib/runtime/layout";
import { cn } from "@/lib/utils";

interface SpecialistNodeData extends TopologyNodeData<ColonyRuntime> {
  stats?: { total: number; active: number; waiting: number; errors: number };
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
  const band: TopologyBand = d.band ?? "specialist";
  const detail = band === "metadata";

  const elevation = cn(
    "relative max-w-48 rounded-xl bg-card px-3 py-2.5",
    band === "specialist" && "border border-foreground/15 shadow-md",
    band === "agents" && "border-2 border-foreground/20 shadow-lg",
    band === "operations" && "border-2 border-primary/30 shadow-lg",
    band === "metadata" && "border-2 border-primary/40 shadow-xl ring-1 ring-primary/20"
  );

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
      className={elevation}
    >
      <Handle type="target" position={Position.Top} id="in" />
      <Handle type="source" position={Position.Bottom} id="out" />
      <div className="flex items-center justify-between gap-3">
        <span className="flex items-center gap-1.5 text-sm font-semibold truncate">
          <Building2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
          {specialistLabel(entity)}
        </span>
        <Badge variant={COLONY_STATUS_VARIANT[entity.status] ?? "secondary"} className="uppercase">
          {entity.status === "ARCHIVED" ? "archived" : entity.status}
        </Badge>
      </div>
      <p className="mt-1 text-xs text-muted-foreground font-mono">
        {stats.total} agents · {stats.active} active
        {detail && (stats.waiting > 0 || stats.errors > 0) && (
          <>
            {stats.waiting > 0 && ` · ${stats.waiting} waiting`}
            {stats.errors > 0 && ` · ${stats.errors} errors`}
          </>
        )}
      </p>
    </div>
  );
}