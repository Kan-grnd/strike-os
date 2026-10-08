"use client";

import type { CSSProperties } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { Boxes, Bot, CircleHelp, Database, Target } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  typeTone,
  type KnowledgeNode as KnowledgeNodeModel,
  type LayoutPort,
  type Side,
} from "@/lib/knowledge-graph";

const ICONS: Record<string, typeof Bot> = {
  colony: Boxes,
  agent: Bot,
  mission: Target,
  memory: Database,
};

const HANDLE_POSITION: Record<Side, Position> = {
  top: Position.Top,
  right: Position.Right,
  bottom: Position.Bottom,
  left: Position.Left,
};

/** Data carried on each React Flow knowledge node. */
export type KnowledgeNodeData = KnowledgeNodeModel & {
  /** Card width from the layout (170 sources, 140 agents). */
  width?: number;
  /** Card height from the layout (76 sources, 44 agents). Fixed — never grown. */
  height?: number;
  /** Attach points, one per incident line, positioned in card pixels. Ports on
   * a busy side may overflow past the card top/bottom; the dot marks the true
   * attach point the line was routed to. */
  ports?: LayoutPort[];
  /** On the focused path (the selected node and its immediate neighbours). */
  active?: boolean;
  /** Off the focused path while something else is focused. */
  dimmed?: boolean;
};

/**
 * One entity in the graph. Read-only: the card carries no controls so React
 * Flow owns the click and the keyboard focus, and the inspector carries every
 * action. Ports sit at the exact pixel offsets the layout routed to, so the
 * drawn lines meet the dots. Agent cards use a compact single-block layout to
 * fit the fixed 140x44 size; source cards keep the two-row layout.
 */
export function KnowledgeNode({ data, selected }: NodeProps) {
  const node = data as unknown as KnowledgeNodeData;
  const Icon = ICONS[node.type] ?? CircleHelp;
  const tone = typeTone(node.type);
  const compact = (node.height ?? 76) <= 48;
  const degreeTitle = `${node.degree} ${
    node.degree === 1 ? "relationship" : "relationships"
  }`;
  /* Card identity: missions carry a 2px amber border; colonies stay neutral
   * grey and agents teal via the rail and icon. Inline colours beat the hover
   * class, so resting mission cards keep their amber edge. */
  const borderColor = selected
    ? "hsl(var(--primary))"
    : node.active
      ? "hsl(var(--primary) / 0.6)"
      : node.type === "mission"
        ? "hsl(var(--warning))"
        : undefined;

  return (
    <div
      className={cn(
        "relative flex flex-col justify-center rounded-[8px] border glass-node px-2 pl-3 transition-[opacity,border-color,box-shadow]",
        compact ? "py-1" : "px-3 py-2",
        selected && "ring-2 ring-ring",
        !borderColor && !selected && !node.active && "hover:border-primary/50",
        node.dimmed && !selected && "opacity-40"
      )}
      style={{
        width: node.width ?? 170,
        height: node.height ?? 76,
        borderWidth: node.type === "mission" ? 2 : undefined,
        borderColor,
      }}
      aria-label={`${node.type} ${node.label}${
        node.subtitle ? `, ${node.subtitle}` : ""
      }, ${degreeTitle}`}
    >
      <span
        className="absolute left-0 top-0 h-full w-1 rounded-l-[8px]"
        style={{ background: tone }}
        aria-hidden
      />
      {(node.ports ?? []).map((p) => {
        const style: CSSProperties =
          p.side === "left" || p.side === "right"
            ? { top: p.offset }
            : { left: p.offset };
        return (
          <Handle
            key={p.id}
            id={p.id}
            type={p.role}
            position={HANDLE_POSITION[p.side]}
            isConnectable={false}
            className="!h-1.5 !w-1.5 !border-0 !bg-muted-foreground/60 !pointer-events-none"
            style={style}
            title={p.id}
          />
        );
      })}
      {compact ? (
        <>
          <div className="flex items-center gap-1.5">
            <Icon className="h-3 w-3 shrink-0" style={{ color: tone }} aria-hidden />
            <span
              className="min-w-0 flex-1 truncate text-xs font-medium"
              title={node.label}
            >
              {node.label}
            </span>
            <span
              className="shrink-0 text-[10px] tabular-nums text-muted-foreground"
              title={degreeTitle}
            >
              {node.degree}
            </span>
          </div>
          <div className="mt-0.5 truncate text-[9px] uppercase tracking-[0.12em] text-muted-foreground">
            {node.type}
          </div>
        </>
      ) : (
        <>
          <div className="flex items-center gap-2">
            <Icon className="h-3.5 w-3.5 shrink-0" style={{ color: tone }} aria-hidden />
            <span
              className="min-w-0 flex-1 truncate text-sm font-medium"
              title={node.label}
            >
              {node.label}
            </span>
            <span
              className="shrink-0 text-[11px] tabular-nums text-muted-foreground"
              title={degreeTitle}
            >
              {node.degree} {node.degree === 1 ? "link" : "links"}
            </span>
          </div>
          <div className="mt-0.5 flex items-center gap-2 text-[11px] text-muted-foreground">
            <span className="shrink-0 uppercase tracking-[0.12em]">{node.type}</span>
            {node.subtitle ? (
              <span
                className="min-w-0 truncate border-l border-border/70 pl-2"
                title={node.subtitle}
              >
                {node.subtitle.toLowerCase()}
              </span>
            ) : null}
          </div>
        </>
      )}
    </div>
  );
}
