import { Handle, Position, type NodeProps } from "@xyflow/react";
import { Badge } from "@/components/ui/badge";
import { Play } from "lucide-react";
import type { TaskRuntime, TopologyBand } from "@/lib/runtime/types";
import type { TopologyNodeData } from "@/lib/runtime/selectors";
import { formatState } from "@/lib/runtime/presentation";
import { cn } from "@/lib/utils";

interface OperationNodeData extends TopologyNodeData<TaskRuntime> {
  ownerName?: string;
}

const STATUS_VARIANT: Record<string, "success" | "warning" | "info" | "destructive" | "secondary"> = {
  QUEUED: "secondary",
  ASSIGNED: "info",
  RUNNING: "info",
  WAITING: "warning",
  COMPLETED: "success",
  FAILED: "destructive",
  CANCELLED: "secondary",
};

export function OperationNode({ id, data }: NodeProps) {
  const d = data as unknown as OperationNodeData;
  const entity = d.entity as TaskRuntime;
  const band: TopologyBand = d.band ?? "operations";

  const elevation = cn(
    "group relative rounded-lg border border-border bg-background/80 px-2.5 py-1.5 shadow-sm w-40",
    "cursor-pointer hover:ring-1 hover:ring-primary/30",
    band === "operations" && "border-border shadow-md",
    band === "metadata" && "border-primary/40 shadow-lg ring-1 ring-primary/20"
  );

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`Operation ${entity.description}`}
      title={`${entity.description} — inspect for details`}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          d.activate?.(id, "operation");
        }
      }}
      className={elevation}
    >
      <Handle type="target" position={Position.Top} id="in" />
      <div className="flex items-center justify-between gap-2">
        <span className="flex min-w-0 items-center gap-1.5 text-xs font-semibold truncate">
          <Play className="h-3 w-3 shrink-0 text-muted-foreground" aria-hidden />
          <span className="truncate">{entity.description}</span>
        </span>
        <Badge variant={STATUS_VARIANT[entity.status] ?? "secondary"} className="shrink-0 uppercase">
          {entity.status === "RUNNING" ? "active" : formatState(entity.status)}
        </Badge>
      </div>
      <div className="mt-1.5 flex justify-end">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            d.activate?.(id, "operation");
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