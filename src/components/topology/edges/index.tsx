"use client";
import React from "react";
import { BaseEdge, EdgeProps, getBezierPath } from "@xyflow/react";
import { edgeMeta, EDGE_META } from "@/lib/topology";
import type { SignalPacket } from "./signals";

/**
 * Custom edge renderer — relationship type drives color/dash; live signal
 * packets ride the edge path via SVG <animateMotion> (native, no rAF).
 *
 * Idle edges are fully static; motion happens only as packets:
 *   - moving packet  → one <circle r=3> + <animateMotion path=…> per packet
 *   - reduced motion → plain static dot at the edge midpoint (SMIL can't be
 *     frozen by CSS, so the hook already flagged these as "static")
 *   - pulse edges    → node-pulse fallback for a signal whose ideal edge is
 *     hidden/missing in the current mode (self-loop, renders a ring at the node)
 */
export function TopologyEdge(props: EdgeProps) {
  const { sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, type, markerEnd, data } = props;
  const meta = edgeMeta(type ?? "belongs_to");

  const signals: SignalPacket[] = (data?.signals as SignalPacket[] | undefined) ?? [];

  // Backwards edges (target sits left of source) balloon into giant loops with a
  // bezier — draw a vertical step instead so they stay tight and readable.
  const backward = targetX < sourceX - 40;
  const path = backward
    ? stepPath(sourceX, sourceY, targetX, targetY)
    : getBezierPath({ sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition })[0];

  const showLabel = type === "blocked_by" || type === "depends_on";

  if (data?.pulse === true) {
    return (
      <>
        {signals.map((s) =>
          s.motion === "static" ? (
            <circle key={s.id} cx={sourceX} cy={sourceY} r={3} fill={s.color} className="topo-signal-dot" />
          ) : (
            <circle
              key={s.id}
              cx={sourceX}
              cy={sourceY}
              r={3.5}
              fill={s.color}
              className="topo-node-pulse"
              style={{ "--signal-color": s.color } as React.CSSProperties}
            />
          )
        )}
      </>
    );
  }

  return (
    <>
      <BaseEdge
        id={props.id}
        path={path}
        markerEnd={markerEnd}
        style={{
          stroke: meta.color,
          strokeWidth: type === "blocked_by" ? 1.6 : 1.2,
          strokeDasharray: meta.dash,
          filter: type === "blocked_by" ? "drop-shadow(0 0 4px rgba(244,63,94,0.6))" : undefined,
        }}
      />
      {showLabel && (
        <text
          x={(sourceX + targetX) / 2}
          y={Math.min(sourceY, targetY) - ((Math.max(sourceY, targetY) - Math.min(sourceY, targetY)) > 40 ? 0 : 6)}
          fill="#f1f5f9"
          fontSize={9}
          fontFamily="var(--font-mono)"
          textAnchor="middle"
          style={{ pointerEvents: "none" }}
        >
          {meta.label}
        </text>
      )}
      {signals.map((s) =>
        s.motion === "static" ? (
          <circle
            key={s.id}
            cx={(sourceX + targetX) / 2}
            cy={(sourceY + targetY) / 2}
            r={3}
            fill={s.color}
            className="topo-signal-dot"
          />
        ) : (
          <circle key={s.id} r={3} fill={s.color} className="topo-signal" style={{ filter: `drop-shadow(0 0 3px ${s.color})` }}>
            <animateMotion
              dur={`${s.ttlMs}ms`}
              path={
                s.forward
                  ? path
                  : backward
                  ? stepPath(targetX, targetY, sourceX, sourceY)
                  : getBezierPath({ sourceX: targetX, sourceY: targetY, targetX: sourceX, targetY: sourceY, sourcePosition: targetPosition, targetPosition: sourcePosition })[0]
              }
            />
          </circle>
        )
      )}
    </>
  );
}

/** Orthogonal step: horizontal → vertical middle → horizontal. No giant loops. */
function stepPath(sx: number, sy: number, tx: number, ty: number): string {
  const mx = (sx + tx) / 2;
  return `M ${sx},${sy} H ${mx} V ${ty} H ${tx}`;
}

export const edgeTypes = {
  default: TopologyEdge,
  // Every relationship type renders through TopologyEdge (which styles by the
  // edge's own `type` prop). Registering them all keeps React Flow from
  // warning + falling back on every render; derived from EDGE_META so future
  // types are covered automatically.
  ...Object.fromEntries(Object.keys(EDGE_META).map((t) => [t, TopologyEdge])),
};

export const edgeTypeLabels: Record<string, string> = Object.fromEntries(
  Object.entries(EDGE_META).map(([k, v]) => [k, v.label])
);

export default edgeTypes;