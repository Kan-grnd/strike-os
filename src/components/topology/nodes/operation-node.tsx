import { Handle, Position, type NodeProps } from "@xyflow/react";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Play } from "lucide-react";
import type { TaskRuntime } from "@/lib/runtime/types";
import { HANDLE_IDS, type TopologyNodeData } from "@/lib/runtime/selectors";
import { formatState } from "@/lib/runtime/presentation";
import { CardButton } from "./card-button";
import { ActionRow } from "./action-row";
import { SideHandles } from "./side-handles";

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
    /* Shell only — Details below is the real, focusable control. */
    <div
      title={`${entity.description} — inspect for details`}
      className="node-list-in group relative w-44 cursor-pointer rounded-lg border glass-node px-3 py-2 transition-colors hover:border-primary/50 hover:bg-accent/40"
    >
      <Handle type="target" position={Position.Top} id={HANDLE_IDS.in} />
      <SideHandles target />
      {/* The title owns the full row. It used to share a row with the status
        * badge, and at w-44 a "COMPLETED" badge plus gap-3 left the operation's
        * name only ~34px — too little to identify the operation at all. Status
        * and owner are metadata, so they share the line below instead, which
        * also keeps the card at the 104px the layout reserves. */}
      <span className="flex min-w-0 items-center gap-1.5">
        <Play className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
        <span className="truncate text-xs font-semibold" title={entity.description}>
          {entity.description}
        </span>
      </span>
      <Separator className="my-1.5" />
      <div className="flex items-center justify-between gap-2">
        <p
          className="min-w-0 truncate font-mono text-[11px] text-muted-foreground"
          title={d.ownerName ? `Owned by ${d.ownerName}` : "Operation"}
        >
          {d.ownerName ? `by ${d.ownerName}` : "operation"}
        </p>
        <Badge variant={STATUS_VARIANT[entity.status] ?? "secondary"} className="shrink-0">
          {entity.status === "RUNNING" ? "active" : formatState(entity.status)}
        </Badge>
      </div>
      <ActionRow className="mt-1.5 flex flex-nowrap justify-end overflow-hidden">
        <CardButton
          variant="ghost"
          size="sm"
          className="h-7 shrink-0 whitespace-nowrap px-2 text-xs"
          onClick={() => d.activate?.(id, "operation")}
        >
          Details
        </CardButton>
      </ActionRow>
    </div>
  );
}