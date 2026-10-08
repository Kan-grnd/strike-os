"use client";

import { ChevronDown, ChevronUp, Code, Database, FlaskConical, Headset, Layers, ShieldCheck } from "lucide-react";
import { type NodeProps } from "@xyflow/react";
import type { ColonyRuntime } from "@/lib/runtime/types";
import { type TopologyNodeData } from "@/lib/runtime/selectors";
import { specialistLabel } from "@/lib/runtime/layout";
import { CardButton } from "./card-button";
import { DetailsButton, NodeHandles, NodeShell } from "./node-bits";
import {
  colonyIconKey,
  rgbString,
  rgba,
  useNodePalette,
} from "./node-palette";

const TAB_ICONS = { FlaskConical, Code, Headset, Database, ShieldCheck, Layers } as const;

/* Folder tab geometry — one source of truth for both the tab box and the
 * brain→colony anchor, so the two can never drift apart. The tab is 62x28 at
 * left -1 / top -27: it overhangs the body's square top-left corner, and its
 * own bottom edge lands 1px below the body's top border, which is why it
 * carries no bottom border — the two read as one folder. */
const TAB_LEFT = -1;
const TAB_WIDTH = 62;
const TAB_HEIGHT = 28;
const TAB_TOP = -27;

interface SpecialistNodeData extends TopologyNodeData<ColonyRuntime> {
  stats?: { total: number; active: number; waiting: number; errors: number };
  expanded?: boolean;
  toggle?: (id: string) => void;
}

/* Colony folder: 260px body (square top-left) with a 62x28 tab sitting 27px
 * above the body's top edge, so the tab overflows the box instead of inflating
 * it. The tab's own bottom edge lands 1px below the body's top border, which is
 * why the tab carries no bottom border: the two read as one folder. */
export function SpecialistNode({ id, data, selected }: NodeProps) {
  const d = data as unknown as SpecialistNodeData;
  const entity = d.entity as ColonyRuntime;
  const stats = d.stats ?? { total: 0, active: 0, waiting: 0, errors: 0 };
  const expanded = d.expanded ?? false;
  const pal = useNodePalette();

  const active = entity.status === "ACTIVE";
  const treat = pal.treatments[active ? "success" : "muted"];
  const statusWord = active ? "Active" : "Idle";
  const surfaceCss = rgbString(pal.surface);
  const textCss = rgbString(pal.surfaceText);
  const secondaryCss = rgbString(pal.secondaryText);
  const borderCss = rgbString(pal.border);
  const accentCss = rgbString(pal.tokens.accent);
  const name = specialistLabel(entity);
  const iconOverride = (entity as unknown as { icon?: string }).icon;
  const Icon = TAB_ICONS[colonyIconKey(name, iconOverride) as keyof typeof TAB_ICONS] ?? Layers;
  const tabIconCss = rgbString(pal.treatments.accent.graphic);

  const total = Math.max(0, stats.total);
  const on = Math.min(Math.max(0, stats.active), total);
  /* One segment per agent, always: the reference draws a real segment for every
   * agent rather than collapsing past twelve into a single filled bar, so a
   * large colony stays a countable read. */
  const segments = total > 0 ? Array.from({ length: total }, (_, i) => i < on) : [];

  return (
    <NodeShell
      label={`Colony ${name}, ${statusWord.toLowerCase()}, ${on} of ${total} agents`}
      width={260}
      radius="0 14px 14px 14px"
      padding="14px 14px 13px"
      background={surfaceCss}
      border={borderCss}
      selected={selected}
      selectedBorder={accentCss}
      selectedFilter={selected ? `drop-shadow(0 0 4px ${rgba(pal.tokens.accent, 0.28)})` : undefined}
      focusRing={accentCss}
    >
      {/* The brain→colony link lands on the body's top border at the horizontal
          centre, so the spoke drops straight into the card rather than
          angling off to the tab in the corner. */}
      <NodeHandles dot={surfaceCss} ring={secondaryCss} />
      <DetailsButton onActivate={() => d.activate?.(id, "specialist")} dot={secondaryCss} fill={rgbString(pal.tokens.canvas)} />
      <span
        aria-hidden
        style={{
          position: "absolute",
          top: TAB_TOP,
          left: TAB_LEFT,
          width: TAB_WIDTH,
          height: TAB_HEIGHT,
          boxSizing: "border-box",
          borderRadius: "12px 12px 0 0",
          background: surfaceCss,
          borderStyle: "solid",
          borderWidth: "1px 1px 0",
          borderColor: selected ? accentCss : borderCss,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Icon style={{ width: 16, height: 16, color: tabIconCss }} strokeWidth={1.75} />
      </span>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ minWidth: 0, flex: 1 }}>
          <span
            style={{
              display: "block",
              fontSize: 15,
              fontWeight: 600,
              letterSpacing: "0.1px",
              lineHeight: 1.15,
              color: textCss,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
            title={name}
          >
            {name}
          </span>
          <span
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              fontSize: 12,
              lineHeight: 1.15,
              color: secondaryCss,
              marginTop: 3,
            }}
          >
            <span
              aria-hidden
              style={{
                width: 7,
                height: 7,
                minWidth: 7,
                borderRadius: "50%",
                background: rgbString(treat.graphic),
              }}
            />
            <span style={{ fontWeight: 600, color: rgbString(treat.text) }}>{statusWord}</span>
            <span>
              · {on}/{total} agents
            </span>
          </span>
        </span>
        <CardButton
          aria-label={expanded ? "Collapse agents" : `Expand ${total} agents`}
          aria-expanded={expanded}
          title={expanded ? "Collapse agents" : `Expand ${total} agents`}
          onClick={() => d.toggle?.(id)}
          style={{
            width: 24,
            height: 24,
            minWidth: 24,
            padding: 0,
            borderRadius: "50%",
            borderWidth: 0.5,
            borderStyle: "solid",
            borderColor: secondaryCss,
            background: "transparent",
            color: secondaryCss,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            flexShrink: 0,
          }}
        >
          {expanded ? (
            <ChevronUp style={{ width: 12, height: 12 }} aria-hidden />
          ) : (
            <ChevronDown style={{ width: 12, height: 12 }} aria-hidden />
          )}
        </CardButton>
      </div>
      {total > 0 ? (
        <div
          role="img"
          aria-label={`${on} of ${total} agents active`}
          title={`${on} of ${total} agents active`}
          style={{ display: "flex", gap: 3, marginTop: 13 }}
        >
          {segments.map((lit, i) => (
            <span
              key={i}
              aria-hidden
              style={{
                flex: 1,
                height: 5,
                borderRadius: 2,
                background: lit ? rgbString(treat.graphic) : rgbString(pal.track),
              }}
            />
          ))}
        </div>
      ) : null}
    </NodeShell>
  );
}
