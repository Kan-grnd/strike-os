import { Handle, Position, type NodeProps } from "@xyflow/react";
import { Badge } from "@/components/ui/badge";
import { Play } from "lucide-react";
import type { TaskRuntime } from "@/lib/runtime/types";
import type { TopologyNodeData } from "@/lib/runtime/selectors";
import { formatState } from "@/lib/runtime/presentation";
import { LevelBar, LevelTag, NodeButton } from "./node-parts";

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
      className="node-list-in group relative w-40 cursor-pointer rounded-lg border border-border bg-background/80 px-2.5 py-1.5 shadow-sm transition-colors hover:ring-1 hover:ring-primary/30"
    >
      <LevelBar level="op" />
      <Handle type="target" position={Position.Top} id="in" />
      <div className="flex items-center justify-between gap-2">
        <LevelTag level="op" />
        <Badge variant={STATUS_VARIANT[entity.status] ?? "secondary"} className="shrink-0 uppercase">
          {entity.status === "RUNNING" ? "active" : formatState(entity.status)}
        </Badge>
      </div>
      <div className="mt-1 flex min-w-0 items-center gap-1.5 text-xs font-semibold">
        <Play className="h-3 w-3 shrink-0 text-muted-foreground" aria-hidden />
        <span className="truncate">{entity.description}</span>
      </div>
      <div className="mt-1.5 flex justify-end">
        <NodeButton onClick={() => d.activate?.(id, "operation")}>Inspect</NodeButton>
      </div>
    </div>
  );
}