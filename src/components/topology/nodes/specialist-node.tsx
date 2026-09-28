import { Handle, Position, type NodeProps } from "@xyflow/react";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Building2 } from "lucide-react";
import type { ColonyRuntime } from "@/lib/runtime/types";
import type { TopologyNodeData } from "@/lib/runtime/selectors";
import { specialistLabel } from "@/lib/runtime/layout";
import { CardButton } from "./card-button";
import { ActionRow } from "./action-row";

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
    /* Shell only — the expand toggle and Details below are real buttons. */
    <div
      title={entity.name}
      className="node-list-in group relative w-60 cursor-pointer rounded-lg border border-border bg-card px-3 py-2 shadow-sm transition-colors hover:border-primary/50 hover:bg-accent/40"
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
      <Separator className="my-1.5" />
      <p className="font-mono text-[11px] text-muted-foreground">
        {stats.total} agents, {stats.active} active
      </p>
      <ActionRow className="mt-1.5 flex flex-nowrap items-center justify-end gap-1.5 overflow-hidden">
        {stats.total > 0 && (
          <CardButton
            variant="outline"
            size="sm"
            className="h-7 shrink-0 gap-1 whitespace-nowrap px-1.5 text-xs"
            onClick={() => d.toggle?.(id)}
            aria-expanded={expanded}
            aria-label={expanded ? "Hide agents" : `Show ${stats.total} agents`}
            title={expanded ? "Hide agents" : `Show ${stats.total} agents`}
          >
            {expanded ? "Hide" : `Agents ${stats.total}`}
          </CardButton>
        )}
        <CardButton
          variant="ghost"
          size="sm"
          className="h-7 shrink-0 whitespace-nowrap px-2 text-xs"
          onClick={() => d.activate?.(id, "specialist")}
        >
          Details
        </CardButton>
      </ActionRow>
    </div>
  );
}