"use client";

import { EdgeText, type EdgeProps } from "@xyflow/react";
import type { CSSProperties } from "react";

import type { Pt } from "@/lib/knowledge-graph";

import "./knowledge-edge-flow.css";

export interface KnowledgeEdgeData {
  /** Ready-to-draw SVG path of the routed cubic, source port to 2px short. */
  d: string;
  /** Arrow tip: the target port, exactly on the card edge. */
  arrow: Pt;
  /** Tangent angle of the curve at the arrow, in radians. */
  arrowAngle: number;
  /** Midpoint of the drawn curve, for the focused-edge label. */
  labelAt: Pt;
  color: string;
  active: boolean;
  dimmed: boolean;
  label?: string;
  /** SVG dash pattern, e.g. "9 5". Absent means solid. */
  dashArray?: string;
  /** Line cap for the stroke; dotted links use round. */
  lineCap?: "round" | "butt" | "square";
  /** Stroke width override; defaults to 2.25 active / 1.5 resting. */
  strokeWidth?: number;
}

const ARROW_LENGTH = 12;
const ARROW_HALF = 4.5;

/** Dash pattern (and therefore loop period) of the solid-link flow overlay. */
const OVERLAY_DASH = "10 14";
const OVERLAY_PERIOD = 24;

/**
 * One full dash-period loop per duration, keyed by period. Because drift speed
 * is period / duration, tying duration to the period keeps every dash type
 * flowing at the same visible speed instead of length-dependent creep. Tuned
 * so the march reads clearly but stays calm.
 */
const FLOW_DURATION: Record<number, number> = {
  14: 1.1, // assigned_to "9 5"  -> ~13px/s
  5.5: 0.9, // manages "0.5 5"    -> ~6px/s
  24: 1.4, // solid overlay       -> ~17px/s
};

/** Sum of a dash pattern's on/off values: the offset that loops seamlessly. */
function dashPeriod(dashArray?: string): number {
  if (!dashArray) return 0;
  return dashArray
    .trim()
    .split(/\s+/)
    .reduce((sum, part) => sum + (Number(part) || 0), 0);
}

function flowDuration(period: number): number {
  return FLOW_DURATION[period] ?? 1.2;
}

/**
 * Draws the routed cubic exactly as the layout produced it and paints its own
 * arrowhead, so every line lands on its own port instead of the default
 * straight segment. The label appears only while the edge is focused, keeping
 * the resting graph free of text.
 */
export function KnowledgeEdge({ data }: EdgeProps) {
  const edge = data as unknown as KnowledgeEdgeData | undefined;
  if (!edge?.d) return null;

  const color = edge.color ?? "hsl(var(--muted-foreground))";
  const opacity = edge.dimmed ? 0.18 : 1;
  const width = edge.strokeWidth ?? (edge.active ? 2.25 : 1.5);

  /* Ambient flow: dashed links animate their own pattern; solid links keep a
   * clean base and carry the motion on a faint, same-width overlay. The period
   * must carry px units or the keyframe's calc() is an invalid length and the
   * animation silently does nothing. */
  const period = dashPeriod(edge.dashArray);
  const flowStyle = (p: number): CSSProperties =>
    ({
      "--flow-period": `${p}px`,
      "--flow-duration": `${flowDuration(p)}s`,
    }) as CSSProperties;
  const flowClass = edge.dimmed
    ? "knowledge-edge-flow knowledge-edge-flow-paused"
    : "knowledge-edge-flow";

  const tip = edge.arrow;
  const angle = edge.arrowAngle;
  const baseX = tip.x - Math.cos(angle) * ARROW_LENGTH;
  const baseY = tip.y - Math.sin(angle) * ARROW_LENGTH;
  const perpX = Math.cos(angle + Math.PI / 2);
  const perpY = Math.sin(angle + Math.PI / 2);
  const arrow = [
    `${tip.x},${tip.y}`,
    `${baseX + perpX * ARROW_HALF},${baseY + perpY * ARROW_HALF}`,
    `${baseX - perpX * ARROW_HALF},${baseY - perpY * ARROW_HALF}`,
  ].join(" ");

  return (
    <g opacity={opacity}>
      <path
        d={edge.d}
        fill="none"
        stroke={color}
        strokeWidth={width}
        strokeLinecap={edge.lineCap ?? "round"}
        strokeDasharray={edge.dashArray}
        className={period > 0 ? flowClass : undefined}
        style={period > 0 ? flowStyle(period) : undefined}
      />
      {period === 0 ? (
        <path
          d={edge.d}
          fill="none"
          stroke={color}
          strokeWidth={width}
          strokeLinecap="round"
          strokeDasharray={OVERLAY_DASH}
          opacity={0.35}
          className={flowClass}
          style={flowStyle(OVERLAY_PERIOD)}
        />
      ) : null}
      <polygon points={arrow} fill={color} />
      {edge.label ? (
        <EdgeText
          x={edge.labelAt.x}
          y={edge.labelAt.y}
          label={edge.label}
          labelStyle={{
            fill: color,
            fontSize: 12,
            fontFamily: "var(--font-sans)",
            fontWeight: 500,
          }}
          labelBgStyle={{ fill: "hsl(var(--background))", fillOpacity: 0.95 }}
          labelBgPadding={[6, 3]}
          labelBgBorderRadius={6}
        />
      ) : null}
    </g>
  );
}
