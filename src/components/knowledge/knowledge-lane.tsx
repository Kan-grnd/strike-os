"use client";

import type { NodeProps } from "@xyflow/react";
import { cn } from "@/lib/utils";
import { typeTone, type LanePlacement } from "@/lib/knowledge-graph";

/**
 * A column zone — the architecture-diagram move of grouping a subsystem inside
 * a labelled boundary. Drawn behind the nodes, non-interactive (its wrapper is
 * `pointer-events-none`) so clicks fall through to the pane, and sized by the
 * layout rather than by its content so it never fights the measured nodes.
 */
export function KnowledgeLane({ data }: NodeProps) {
  const lane = data as unknown as LanePlacement;
  const tone = typeTone(lane.type);

  return (
    <div
      className="h-full w-full px-2 pt-1"
      style={{ width: lane.width, height: lane.height }}
    >
      <div className="flex items-center gap-1.5 opacity-85">
        <span
          className="h-1.5 w-1.5 rounded-full"
          style={{ background: tone }}
          aria-hidden
        />
        <span
          className="text-[10px] font-semibold uppercase tracking-[0.14em]"
          style={{ color: tone }}
        >
          {lane.label}
        </span>
        <span className="text-[10px] tabular-nums text-muted-foreground">
          {lane.count}
        </span>
      </div>
    </div>
  );
}
