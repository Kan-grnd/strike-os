"use client";

import type { EdgeProps } from "@xyflow/react";
import type { CSSProperties } from "react";

import "./topology-edge-flow.css";

export interface TopologyEdgeData {
  /** Focus dimmed this edge: fade the stroke and pause its flow. */
  dimmed?: boolean;
}

/** Dash pattern (and therefore loop period) of the flow overlay, in px. */
const FLOW_DASH = "10 14";
const FLOW_PERIOD = 24;
/** One dash-period loop per duration keeps the march at a calm, even speed. */
const FLOW_DURATION = 1.4;

/**
 * Straight ownership link (brain → colonies → workers → operations) with an
 * ambient flow toward the target. React Flow's default edge is already the
 * straight line between the two handle anchors, so this draws that segment
 * itself and adds a faint, same-width dashed overlay that marches source →
 * target; the base stroke stays clean underneath.
 */
export function TopologyEdge({ sourceX, sourceY, targetX, targetY, style, data }: EdgeProps) {
  const edge = data as TopologyEdgeData | undefined;
  const dimmed = Boolean(edge?.dimmed);
  const d = `M ${sourceX},${sourceY} L ${targetX},${targetY}`;
  const stroke = (style?.stroke as string | undefined) ?? "hsl(var(--muted-foreground) / 0.5)";
  const width = typeof style?.strokeWidth === "number" ? style.strokeWidth : 1.75;

  /* The period must carry px units or the keyframe's calc() is an invalid
   * length and the animation silently does nothing. */
  const flowStyle = {
    "--flow-period": `${FLOW_PERIOD}px`,
    "--flow-duration": `${FLOW_DURATION}s`,
  } as CSSProperties;
  const flowClass = dimmed ? "topology-edge-flow topology-edge-flow-paused" : "topology-edge-flow";

  return (
    <g opacity={dimmed ? 0.2 : 1}>
      <path
        d={d}
        fill="none"
        stroke={stroke}
        strokeWidth={width}
        strokeLinecap="round"
        className="react-flow__edge-path"
        style={{ stroke, strokeWidth: width }}
      />
      <path
        d={d}
        fill="none"
        stroke={stroke}
        strokeWidth={width}
        strokeLinecap="round"
        strokeDasharray={FLOW_DASH}
        opacity={0.35}
        className={flowClass}
        style={flowStyle}
      />
    </g>
  );
}
