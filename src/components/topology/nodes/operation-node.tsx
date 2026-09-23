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
  const metadata = band === "metadata";

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`Operation ${entity.description}`}
      title={`${entity.description}`}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          d.activate?.(id, "operation");
        }
      }}
      className="relative rounded-lg border border-border bg-background/80 px-3 py-2 shadow-sm min-w-44"
    >
      <Handle type="target" position={Position.Top} id="in" />
      <div className="flex items-center justify-between gap-2">
        <span className="flex min-w-0 items-center gap-1.5 text-xs font-semibold truncate">
          <Play className="h-3 w-3 shrink-0 text-muted-foreground" aria-hidden />
          <span className="truncate">{entity.description}</span>
        </span>
        <Badge variant={STATUS_VARIANT[entity.status] ?? "secondary"} className="shrink-0 uppercase">
          {entity.status === "RUNNING" ? "active" : formatState(entity.status).slice(0, 6)}
        </Badge>
      </div>
      {metadata && (
        <p className={cn("mt-1 text-xs text-muted-foreground font-mono truncate")}>
          {d.ownerName ? `${d.ownerName} · ` : ""}
          {entity.retryCount}/{entity.maxRetries} retries{" "}
          {entity.dependencies.length > 0 && `· ${entity.dependencies.length} deps`}
        </p>
      )}
    </div>
  );
}