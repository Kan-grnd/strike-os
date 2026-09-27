import { Handle, Position, type NodeProps } from "@xyflow/react";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Play } from "lucide-react";
import type { TaskRuntime } from "@/lib/runtime/types";
import type { TopologyNodeData } from "@/lib/runtime/selectors";
import { formatState } from "@/lib/runtime/presentation";
import { CardButton } from "./card-button";

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
      className="node-list-in group relative w-48 cursor-pointer rounded-lg border border-border bg-card px-4 py-3 shadow-sm transition-colors hover:border-primary/50 hover:bg-accent/40"
    >
      <Handle type="target" position={Position.Top} id="in" />
      <div className="flex items-center justify-between gap-3">
        <span className="flex min-w-0 items-center gap-1.5">
          <Play className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
          <span className="truncate text-xs font-semibold">{entity.description}</span>
        </span>
        <Badge variant={STATUS_VARIANT[entity.status] ?? "secondary"} className="shrink-0">
          {entity.status === "RUNNING" ? "active" : formatState(entity.status)}
        </Badge>
      </div>
      <Separator className="my-2" />
      <p className="truncate font-mono text-[11px] text-muted-foreground">
        {d.ownerName ? `by ${d.ownerName}` : "operation"}
      </p>
      <div className="mt-2 flex justify-end">
        <CardButton
          variant="ghost"
          size="sm"
          className="h-8 px-2.5 text-xs"
          onClick={() => d.activate?.(id, "operation")}
        >
          Details
        </CardButton>
      </div>
    </div>
  );
}