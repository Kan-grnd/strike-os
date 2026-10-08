"use client";

import { Handle, Position } from "@xyflow/react";
import { ChevronDown, ChevronUp, Info } from "lucide-react";
import type { CSSProperties, ReactNode } from "react";
import { HANDLE_IDS } from "@/lib/runtime/selectors";
import { CardButton } from "./card-button";
import { SideHandles } from "./side-handles";

/* Shared bits for the custom topology node family: connection dots, the
 * hover Details button, and the focusable shell. All paint comes from the
 * node palette (theme levels + contrast-adjusted treatments); visibility of
 * handles and the Details button is pure CSS in topology-nodes.css
 * (hover, .selected, focus-within), so touch shows them when selected. */

const DOT = 7;

const dotStyle = (background: string, border: string): CSSProperties => ({
  width: DOT,
  height: DOT,
  minWidth: DOT,
  minHeight: DOT,
  background,
  border: "1.5px solid",
  borderColor: border,
  borderRadius: "50%",
  boxSizing: "border-box",
});

export function NodeHandles({
  dot,
  ring,
  source = true,
  x = "50%",
}: {
  dot: string;
  ring: string;
  source?: boolean;
  /** Horizontal anchor for the top/bottom pair (tickets sit at 60%). */
  x?: string;
}) {
  const place = (pos: "top" | "bottom"): CSSProperties => ({
    ...(pos === "top" ? { top: -4 } : { bottom: -4 }),
    left: x,
    transform: "translateX(-50%)",
  });
  return (
    <>
      <Handle type="target" position={Position.Top} id={HANDLE_IDS.in} className="t-handle" style={{ ...dotStyle(dot, ring), ...place("top") }} />
      {source ? (
        <Handle type="source" position={Position.Bottom} id={HANDLE_IDS.out} className="t-handle" style={{ ...dotStyle(dot, ring), ...place("bottom") }} />
      ) : (
        /* Operations are leaves: a bottom dot with no handle id keeps the
         * symmetric look without advertising an edge anchor. */
        <span aria-hidden className="t-handle" style={{ ...dotStyle(dot, ring), position: "absolute", ...place("bottom") }} />
      )}
      <SideHandles target source={source} />
    </>
  );
}

/** 22px round Details button, top right; visible on hover/selected/focus. */
export function DetailsButton({ onActivate, dot, fill }: { onActivate?: () => void; dot: string; fill: string }) {
  return (
    <CardButton
      aria-label="Details"
      title="Details"
      onClick={onActivate}
      className="t-details"
      style={{
        position: "absolute",
        top: 8,
        right: 10,
        width: 22,
        height: 22,
        minWidth: 22,
        padding: 0,
        borderRadius: "50%",
        borderWidth: 0.5,
        borderStyle: "solid",
        borderColor: dot,
        background: fill,
        color: dot,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: "pointer",
      }}
    >
      <Info style={{ width: 12, height: 12 }} aria-hidden />
    </CardButton>
  );
}

/** One 20px round tasks chevron per agent: it shows and hides all of the
 *  agent's task nodes — sub-agents and operations together. The count rides
 *  in the aria-label only, never as visible text. Positioned absolute by the
 *  caller (bottom right, inside existing padding, so it adds no row). */
export function TasksChevron({
  open,
  count,
  onToggle,
  dot,
  style,
}: {
  open: boolean;
  count: number;
  onToggle?: () => void;
  dot: string;
  style?: CSSProperties;
}) {
  const label = `${open ? "Hide" : "Show"} tasks (${count})`;
  return (
    <CardButton
      aria-label={label}
      aria-expanded={open}
      title={label}
      onClick={onToggle}
      style={{
        position: "absolute",
        width: 20,
        height: 20,
        minWidth: 20,
        padding: 0,
        borderRadius: "50%",
        borderWidth: 0.5,
        borderStyle: "solid",
        borderColor: dot,
        background: "transparent",
        color: dot,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: "pointer",
        ...style,
      }}
    >
      {open ? (
        <ChevronUp style={{ width: 12, height: 12 }} aria-hidden />
      ) : (
        <ChevronDown style={{ width: 12, height: 12 }} aria-hidden />
      )}
    </CardButton>
  );
}

export function NodeShell({
  label,
  width,
  radius,
  padding,
  background,
  border,
  selected,
  selectedBorder,
  selectedFilter,
  focusRing,
  glow,
  minHeight,
  children,
  extra,
}: {
  label: string;
  width: number;
  radius: number | string;
  padding: string;
  background: string;
  border: string;
  selected?: boolean;
  selectedBorder: string;
  /** Optional filter (e.g. drop-shadow) applied when selected. */
  selectedFilter?: string;
  focusRing: string;
  glow?: string;
  minHeight?: number;
  children: ReactNode;
  extra?: ReactNode;
}) {
  return (
    <div
      role="group"
      tabIndex={0}
      aria-label={label}
      className="tnode node-list-in"
      style={
        {
          position: "relative",
          width,
          borderRadius: radius,
          padding,
          background,
          border: "1px solid",
          borderColor: selected ? selectedBorder : border,
          boxShadow: selected && glow && !selectedFilter ? glow : undefined,
          filter: selected && selectedFilter ? selectedFilter : undefined,
          minHeight,
          boxSizing: "border-box",
          cursor: "pointer",
          outline: "none",
          fontSize: 13,
          "--t-focus": focusRing,
        } as CSSProperties
      }
    >
      {children}
      {extra}
    </div>
  );
}
