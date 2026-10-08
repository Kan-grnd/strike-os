"use client";

import { Ban, ClipboardList, Clock, Play, TriangleAlert } from "lucide-react";
import { type NodeProps } from "@xyflow/react";
import type { AgentRuntime } from "@/lib/runtime/types";
import { type TopologyNodeData } from "@/lib/runtime/selectors";
import { agentStatePresentation } from "@/lib/runtime/presentation";
import { DetailsButton, NodeHandles, NodeShell, TasksChevron } from "./node-bits";
import {
  adjustToContrast,
  agentCharacter,
  avatarColors,
  miniGlowFor,
  rgbString,
  rgba,
  useNodePalette,
  type Rgb,
  type StatusTreatment,
} from "./node-palette";

export interface AgentNodeData extends TopologyNodeData<AgentRuntime> {
  operation?: string;
  expandedSub?: boolean;
  expandedOps?: boolean;
  subCount?: number;
  opCount?: number;
  toggle?: (id: string) => void;
}

/* Runtime state → one of the five specified treatments. The word stays
 * specific (Thinking, Delegating…) via the presentation map; the icon and
 * color follow the treatment so status is never color alone. Anything the
 * spec does not name (approval, done, paused…) reads as waiting. */
function agentTreatment(state: string): { treatment: StatusTreatment; icon: typeof Play } {
  if (state === "executing") return { treatment: "success", icon: Play };
  if (state === "failed") return { treatment: "danger", icon: TriangleAlert };
  if (state === "blocked") return { treatment: "warning", icon: Ban };
  if (
    state === "planning" ||
    state === "thinking" ||
    state === "delegating" ||
    state === "reviewing" ||
    state === "initializing" ||
    state === "retrying" ||
    state === "recovering"
  ) {
    return { treatment: "accent", icon: ClipboardList };
  }
  return { treatment: "muted", icon: Clock };
}

export type OrbExpression = "round" | "waiting" | "blocked" | "error";

function eyeGeometry(expression: OrbExpression): { w: number; h: number; radius: string } {
  if (expression === "waiting") return { w: 6, h: 3.5, radius: "0 0 6px 6px" };
  if (expression === "blocked") return { w: 7, h: 7, radius: "50%" };
  if (expression === "error") return { w: 7, h: 2.5, radius: "1px" };
  return { w: 5, h: 8, radius: "50%" };
}

/* Character accessory overlay on the 40x40 grid. Parts inside the sphere use
 * the eye color; accessories outside use the accent with a 1.5px surface
 * outline (paint-order stroke). Overflow is visible so antennae, hats and
 * headphone pads can leave the circle. */
function CharacterOverlay({
  character,
  eye,
  accent,
  surface,
  success,
}: {
  character: ReturnType<typeof agentCharacter>;
  eye: string;
  accent: string;
  surface: string;
  success: string;
}) {
  const out = {
    stroke: surface,
    strokeWidth: 1.5,
    paintOrder: "stroke" as const,
  };
  return (
    <svg
      aria-hidden
      viewBox="0 0 40 40"
      style={{ position: "absolute", inset: 0, overflow: "visible", pointerEvents: "none" }}
    >
      {character === "monocle" ? (
        <g stroke={eye} strokeWidth={1.6} fill="none">
          <circle cx={26} cy={20} r={6.5} />
          <path d="M30.6 24.8 Q33 29 32.5 34" strokeLinecap="round" />
        </g>
      ) : null}
      {character === "glasses" ? (
        <g stroke={eye} strokeWidth={1.6} fill="none">
          <circle cx={14} cy={20} r={6} />
          <circle cx={26} cy={20} r={6} />
          <path d="M19.4 19 Q20 18 20.6 19" />
        </g>
      ) : null}
      {character === "hardhat" ? (
        <g fill={accent} {...out}>
          <path d="M8 11 A12 12 0 0 1 32 11 Z" />
          <rect x={5} y={10} width={30} height={3.5} rx={1.75} />
          <rect x={18.5} y={-2} width={3} height={6} rx={1.5} />
        </g>
      ) : null}
      {character === "headphones" ? (
        <g>
          <path d="M-1 20 A21 21 0 0 1 41 20" fill="none" stroke={surface} strokeWidth={5} strokeLinecap="round" />
          <path d="M-1 20 A21 21 0 0 1 41 20" fill="none" stroke={accent} strokeWidth={2.6} strokeLinecap="round" />
          <rect x={-5} y={14} width={6.5} height={12} rx={3.2} fill={accent} {...out} />
          <rect x={38.5} y={14} width={6.5} height={12} rx={3.2} fill={accent} {...out} />
        </g>
      ) : null}
      {character === "antenna" ? (
        <g>
          <path d="M3.5 13 Q20 8.5 36.5 13" fill="none" stroke={eye} strokeWidth={1} opacity={0.4} />
          <path d="M3.5 27 Q20 31.5 36.5 27" fill="none" stroke={eye} strokeWidth={1} opacity={0.4} />
          <path d="M20 0 V-5" stroke={accent} strokeWidth={1.6} strokeLinecap="round" />
          <circle cx={20} cy={-6.5} r={2.4} fill={accent} {...out} />
        </g>
      ) : null}
      {character === "shield" ? (
        <g transform="translate(23 21) scale(0.75)">
          <path
            d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1 1 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"
            fill={accent}
            stroke={surface}
            strokeWidth={3}
            paintOrder="stroke"
          />
          <path d="m9 12 2 2 4-4" fill="none" stroke={surface} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" />
        </g>
      ) : null}
      {character === "sprout" ? (
        <g fill={success} {...out}>
          <path d="M20 0 Q19 -4 15 -5 Q15.5 -0.5 20 0Z" />
          <path d="M20 0 Q21 -4 25 -5 Q24.5 -0.5 20 0Z" />
        </g>
      ) : null}
      {character === "bowtie" ? (
        <g>
          <path d="M20 37 L12 33 L12 41 Z" fill={accent} {...out} />
          <path d="M20 37 L28 33 L28 41 Z" fill={accent} {...out} />
          <circle cx={20} cy={37} r={2.2} fill={accent} {...out} />
        </g>
      ) : null}
    </svg>
  );
}

/** 40px agent avatar: status-color sphere, contrast-picked eyes, character. */
export function AgentAvatar({
  base,
  surface,
  success,
  rawAccent,
  expression,
  blink,
  character,
}: {
  base: Rgb;
  surface: Rgb;
  success: Rgb;
  /** Raw theme accent: accessories use it (contrast-adjusted), never the
   *  sem-mixed status base. */
  rawAccent: Rgb;
  expression: OrbExpression;
  blink: boolean;
  character: ReturnType<typeof agentCharacter>;
}) {
  const { sphere, eye, rim, gradient } = avatarColors(base, surface);
  const eyeCss = rgbString(eye);
  const geo = eyeGeometry(expression);
  return (
    <span
      aria-hidden
      style={{
        position: "relative",
        width: 40,
        height: 40,
        minWidth: 40,
        flexShrink: 0,
        overflow: "visible",
        margin: "6px 3px 0 4px",
      }}
    >
      <span
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: "50%",
          background: gradient,
          boxShadow: `${miniGlowFor(base)}, inset 0 0 0 1px ${rim}`,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 7,
        }}
      >
        {[0, 1].map((i) => (
          <span
            key={i}
            className="t-motion"
            style={{
              width: geo.w,
              height: geo.h,
              borderRadius: geo.radius,
              background: eyeCss,
              animation: blink ? "t-blink 3.6s ease-in-out infinite" : undefined,
            }}
          />
        ))}
      </span>
      <CharacterOverlay
        character={character}
        eye={eyeCss}
        accent={rgbString(adjustToContrast(rawAccent, surface, 3.0))}
        surface={rgbString(surface)}
        success={rgbString(success)}
      />
    </span>
  );
}

export function AgentShell({
  id,
  activate,
  data,
  selected,
}: {
  id: string;
  activate?: (id: string, type: string) => void;
  data: AgentNodeData;
  selected?: boolean;
}) {
  const entity = data.entity as AgentRuntime;
  const presenting = agentStatePresentation(entity.runtimeState);
  const { treatment, icon: Icon } = agentTreatment(entity.runtimeState);
  const pal = useNodePalette();
  const treat = pal.treatments[treatment];

  const surfaceCss = rgbString(pal.surface);
  const textCss = rgbString(pal.surfaceText);
  const secondaryCss = rgbString(pal.secondaryText);
  const borderCss = rgbString(pal.border);
  const accentCss = rgbString(pal.tokens.accent);
  const wordCss = rgbString(treat.text);
  const graphicCss = rgbString(treat.graphic);

  const running = treatment === "success";
  const alert = treatment === "warning" || treatment === "danger";
  const expression: OrbExpression =
    treatment === "muted" ? "waiting" : treatment === "warning" ? "blocked" : treatment === "danger" ? "error" : "round";
  const description = data.operation ?? "";
  const reason = (entity as unknown as { reason?: string }).reason;
  const displayDesc = alert && reason ? reason : description;
  const characterOverride = (entity as unknown as { character?: string }).character;
  const label = `Agent ${entity.name}, ${presenting.label.toLowerCase()}${displayDesc ? `, ${displayDesc}` : ""}`;

  const subCount = data.subCount ?? 0;
  const opCount = data.opCount ?? 0;
  const taskCount = subCount + opCount;
  const tasksOpen = (data.expandedSub ?? false) || (data.expandedOps ?? false);

  return (
    <NodeShell
      label={label}
      width={220}
      radius="38px 14px 14px 38px"
      padding="11px 13px"
      minHeight={78}
      background={surfaceCss}
      border={borderCss}
      selected={selected}
      selectedBorder={accentCss}
      focusRing={accentCss}
      glow={pal.accentGlow(3, 0.28)}
    >
      <NodeHandles dot={surfaceCss} ring={secondaryCss} />
      <DetailsButton onActivate={() => activate?.(id, "agent")} dot={secondaryCss} fill={rgbString(pal.tokens.canvas)} />
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <AgentAvatar
          base={treat.base}
          surface={pal.surface}
          success={pal.treatments.success.graphic}
          rawAccent={pal.tokens.accent}
          expression={expression}
          blink={running || treatment === "accent"}
          character={agentCharacter(entity.name, characterOverride)}
        />
        <span style={{ minWidth: 0, flex: 1 }}>
          <span
            style={{
              display: "block",
              fontSize: 13.5,
              fontWeight: 600,
              lineHeight: 1.15,
              color: textCss,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
              paddingRight: 22,
            }}
            title={entity.name}
          >
            {entity.name}
          </span>
          <span
            style={{
              display: "flex",
              alignItems: "center",
              gap: 4,
              fontSize: 11.5,
              fontWeight: 600,
              lineHeight: 1.15,
              color: wordCss,
              marginTop: 2,
            }}
          >
            <Icon style={{ width: 12, height: 12 }} aria-hidden />
            {presenting.label}
          </span>
          <span
            style={{
              display: "block",
              fontSize: 12,
              lineHeight: 1.15,
              color: secondaryCss,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
              marginTop: 3,
              paddingRight: taskCount > 0 ? 26 : 0,
            }}
            title={displayDesc}
          >
            {displayDesc}
          </span>
        </span>
      </div>
      {taskCount > 0 ? (
        <TasksChevron
          open={tasksOpen}
          count={taskCount}
          onToggle={() => data.toggle?.(id)}
          dot={secondaryCss}
          style={{ right: 10, bottom: 8 }}
        />
      ) : null}
      {(running || alert) && (
        <span
          aria-hidden
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: "inherit",
            overflow: "hidden",
            pointerEvents: "none",
          }}
        >
          {running ? (
            <span style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 2, overflow: "hidden" }}>
              <span
                className="t-motion"
                style={{
                  position: "absolute",
                  top: 0,
                  bottom: 0,
                  left: 0,
                  width: "40%",
                  background: `linear-gradient(90deg, transparent, ${graphicCss}, transparent)`,
                  animation: "t-shimmer 1.8s linear infinite",
                }}
              />
            </span>
          ) : (
            <span
              style={{
                position: "absolute",
                left: 0,
                right: 0,
                bottom: 0,
                height: 3,
                background: graphicCss,
              }}
            />
          )}
        </span>
      )}
    </NodeShell>
  );
}

export function AgentNode({ id, data, selected }: NodeProps) {
  const d = data as unknown as AgentNodeData;
  return <AgentShell id={id} activate={d.activate} data={d} selected={selected} />;
}
