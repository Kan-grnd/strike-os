"use client";

import type { CSSProperties, ReactNode } from "react";
import { DetailsButton, NodeHandles, NodeShell } from "./node-bits";
import { rgbString, rgba, useNodePalette, type StatusTreatment } from "./node-palette";

/* Ticket card shared by task and sub-agent nodes: 200px, lower in the
 * hierarchy (surface mixed toward canvas). A 9px status dot on the left is
 * separated from the text by a dashed divider with canvas bites cut into the
 * top and bottom borders (each bite keeps a 1px border and is clipped to the
 * inner half). Every dot carries a static 3px halo at 30%; the active dot
 * breathes it out to 6px. */

export function CompactShell({
  id,
  label,
  title,
  caption,
  treatment,
  pulse,
  toggles,
  activateKind,
  onActivate,
  selected,
  dotFromTop = 4,
}: {
  id: string;
  label: string;
  title: string;
  caption: ReactNode;
  treatment: StatusTreatment;
  pulse: boolean;
  toggles?: ReactNode;
  activateKind: string;
  onActivate?: (id: string, type: string) => void;
  selected?: boolean;
  dotFromTop?: number;
}) {
  const pal = useNodePalette();
  const treat = pal.taskTreatments[treatment];

  const bgCss = rgbString(pal.taskSurface);
  const textCss = rgbString(pal.taskText);
  const borderCss = rgbString(pal.border);
  const canvasCss = rgbString(pal.tokens.canvas);
  const accentCss = rgbString(pal.tokens.accent);
  const dotCss = rgbString(treat.graphic);
  const haloCss = rgba(treat.base, 0.3);
  /* Every status reads as a filled dot with a static halo; only the active dot
   * breathes. Waiting stays distinguishable by colour, weight and the lack of
   * motion rather than by an empty ring. */

  const notch: CSSProperties = {
    position: "absolute",
    left: 23,
    width: 10,
    height: 10,
    boxSizing: "border-box",
    borderRadius: "50%",
    background: canvasCss,
    border: `1px solid ${borderCss}`,
  };

  return (
    <NodeShell
      label={label}
      width={200}
      minHeight={75}
      radius="6px 14px 14px 6px"
      padding="10px 12px"
      background={bgCss}
      border={borderCss}
      selected={selected}
      selectedBorder={accentCss}
      focusRing={accentCss}
      glow={pal.accentGlow(3, 0.28)}
    >
      <NodeHandles dot={rgbString(pal.tokens.canvas)} ring={rgbString(pal.taskSecondary)} x="60%" />
      <DetailsButton onActivate={() => onActivate?.(id, activateKind)} dot={rgbString(pal.taskSecondary)} fill={canvasCss} />
<span aria-hidden style={{ ...notch, top: -5, clipPath: "inset(50% 0 0 0)" }} />
      <span aria-hidden style={{ ...notch, bottom: -5, clipPath: "inset(0 0 50% 0)" }} />
      <div style={{ display: "flex" }}>
        <span aria-hidden style={{ position: "relative", width: 9, minWidth: 9, height: 9, marginTop: dotFromTop }}>
          <span
            className={pulse ? "t-motion" : undefined}
            style={
              {
                position: "absolute",
                inset: 0,
                borderRadius: "50%",
                background: dotCss,
                boxShadow: `0 0 0 3px ${haloCss}`,
                animation: pulse ? "t-halo-spread 1.8s ease-in-out infinite" : undefined,
                "--t-halo": haloCss,
              } as CSSProperties
            }
          />
        </span>
        <span aria-hidden style={{ alignSelf: "stretch", borderLeft: `1px dashed ${borderCss}`, marginLeft: 7, marginRight: 10 }} />
        <span style={{ minWidth: 0, flex: 1 }}>
          <span
            className="t-clamp2"
            style={{ fontSize: 12.5, fontWeight: 600, lineHeight: 1.35, color: textCss, paddingRight: 22 }}
            title={title}
          >
            {title}
          </span>
          <span
            style={{
              display: "block",
              fontSize: 12,
              lineHeight: 1.15,
              color: rgbString(pal.taskSecondary),
              marginTop: 5,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
              paddingRight: toggles ? 26 : 0,
            }}
          >
            {caption}
          </span>
        </span>
      </div>
      {toggles}
    </NodeShell>
  );
}
