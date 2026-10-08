"use client";

import { getBezierPath, type EdgeProps } from "@xyflow/react";
import { STRUCTURAL_EDGE_STROKE, edgePathD } from "@/lib/runtime/selectors";

/** Pronounced cubic bend; the default 0.25 reads almost straight at this scale. */
const CURVATURE = 0.5;

export interface TopologyEdgeData {
  /** Focus dimmed this edge: fade the stroke. */
  dimmed?: boolean;
  /** Lateral fan at the source end; 0 keeps the standard bend. */
  fanDx?: number;
}

/**
 * Structural ownership link (brain → colonies → workers → operations): one
 * curved path in the shared neutral ink, plus a single short bright dot that
 * marches along it so an active tree reads as flowing (the reference's
 * `flow-track` + `flow-dot` pair). Sibling colony curves fan out from the
 * shared brain handle so they never paint the same pixels. The dot rides the
 * theme accent but is deliberately thin and short — it reports traffic without
 * tinting the link. Live event links are React Flow defaults and carry their own
 * color and dash pattern on the canvas.
 */
export function TopologyEdge({ sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition, style, data }: EdgeProps) {
  const edge = data as TopologyEdgeData | undefined;
  const dimmed = Boolean(edge?.dimmed);
  const fanDx = typeof edge?.fanDx === "number" ? edge.fanDx : 0;
  const d =
    fanDx !== 0
      ? edgePathD(sourceX, sourceY, targetX, targetY, fanDx)
      : getBezierPath({
          sourceX,
          sourceY,
          sourcePosition,
          targetX,
          targetY,
          targetPosition,
          curvature: CURVATURE,
        })[0];
  const width = typeof style?.strokeWidth === "number" ? style.strokeWidth : 1;

  return (
    <>
      <path
        d={d}
        fill="none"
        stroke={STRUCTURAL_EDGE_STROKE}
        strokeWidth={width}
        strokeLinecap="round"
        opacity={dimmed ? 0.2 : 1}
        className="react-flow__edge-path"
        style={{ stroke: STRUCTURAL_EDGE_STROKE, strokeWidth: width }}
      />
      {!dimmed && (
        <path
          d={d}
          fill="none"
          stroke="hsl(var(--primary))"
          strokeWidth={2.4}
          strokeLinecap="round"
          strokeDasharray="3 220"
          className="t-traffic"
          style={{
            stroke: "hsl(var(--primary))",
            strokeWidth: 2.4,
            strokeDasharray: "3 220",
            animation: "t-traffic 2.6s linear infinite",
          }}
        />
      )}
    </>
  );
}
