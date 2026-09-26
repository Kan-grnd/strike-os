import { type NodeProps } from "@xyflow/react";
import { Check, X, Info } from "lucide-react";
import type { CompletionFlash, TopologyBand } from "@/lib/runtime/types";
import type { TopologyNodeData } from "@/lib/runtime/selectors";

export function FlashNode({ data }: NodeProps) {
  const d = data as unknown as TopologyNodeData<CompletionFlash>;
  const entity = d.entity as CompletionFlash;
  const band: TopologyBand = d.band ?? "operations";
  void band;
  const Icon = entity.kind === "success" ? Check : entity.kind === "error" ? X : Info;
  const tone =
    entity.kind === "success"
      ? "border-success/60 text-success"
      : entity.kind === "error"
      ? "border-destructive/60 text-destructive"
      : "border-info/60 text-info";

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={`Operation ${entity.kind}: ${entity.label}`}
      className={`pointer-events-none flex items-center gap-1 rounded-full border bg-background px-2 py-1 text-xs font-semibold ${tone} animate-pulse`}
    >
      <Icon className="h-3 w-3" aria-hidden />
      {entity.label}
    </div>
  );
}