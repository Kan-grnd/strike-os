import * as React from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { Maximize2 } from "lucide-react";
import { AvatarOrb, type OrbPalette } from "@/components/ui/components-primitives-avatar";
import type { BrainRuntime, SystemRuntime } from "@/lib/runtime/types";
import { HANDLE_IDS, type TopologyNodeData } from "@/lib/runtime/selectors";
import { SideHandles } from "./side-handles";
import {
  coreRoleBase,
  getCoreOrbPalette,
  readNodeThemeTokens,
  rgbString,
  useNodeThemeVersion,
  FALLBACK_NODE_THEME,
  type CoreOrbRole,
} from "./node-palette";

interface BrainNodeData extends TopologyNodeData<BrainRuntime> {
  system?: SystemRuntime;
  territoryCount?: number;
  allExpanded?: boolean;
  expandAll?: () => void;
  glow?: "auto" | "none";
}

/** Brain state → core-sphere role, label and blink behavior. */
const ORB_ROLE: Record<string, { role: CoreOrbRole; label: string; blink: boolean }> = {
  working: { role: "working", label: "Working", blink: true },
  operational: { role: "active", label: "Active", blink: true },
  degraded: { role: "blocked", label: "Blocked", blink: false },
  critical: { role: "error", label: "Error", blink: false },
  offline: { role: "idle", label: "Idle", blink: false },
};

/** Per-state eye geometry (reference EYE map): w, h, radius; blink from ORB_ROLE. */
const EYE_GEOMETRY: Record<string, { w: number; h: number; radius: string }> = {
  working: { w: 11, h: 17, radius: "50%" },
  operational: { w: 11, h: 17, radius: "50%" },
  degraded: { w: 14, h: 14, radius: "50%" },
  critical: { w: 15, h: 4, radius: "3px" },
  offline: { w: 13, h: 7, radius: "0 0 12px 12px" },
};

/** Arc between two angles on the activity ring, in degrees (0 = +x, growing
 *  clockwise in SVG's y-down space). Reference `arc(100,100,90,a0,a1)`. */
function arcPath(cx: number, cy: number, r: number, a0Deg: number, a1Deg: number): string {
  const a0 = (a0Deg * Math.PI) / 180;
  const a1 = (a1Deg * Math.PI) / 180;
  const x0 = cx + r * Math.cos(a0);
  const y0 = cy + r * Math.sin(a0);
  const x1 = cx + r * Math.cos(a1);
  const y1 = cy + r * Math.sin(a1);
  return `M ${x0.toFixed(2)} ${y0.toFixed(2)} A ${r} ${r} 0 0 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`;
}

/** Segmented activity ring: exactly N arc segments (N = total agents) around
 *  the full 360 degrees at r=84 in the 200px canvas, each filled or
 *  track-coloured, with a real 4-degree gap at both ends of every segment and
 *  no base circle underneath. Filled count is the clamped active.
 *
 *  The 84px centerline hugs the 140px orb (70px radius) — about 11.5px of
 *  clearance once the 5px stroke is counted — while staying clear of the
 *  orb's 10px glow envelope, so the aura never washes the ring out.
 *
 *  The ring is drawn as explicit arc paths rather than dashed circles: a dash
 *  pattern cannot express a gap at both ends of a segment whose sweep is not a
 *  whole number of pathLength units, and mixing the two made every segment
 *  collapse into the same octant. */
const RING_R = 84;
const RING_GAP_DEG = 4;

function ActivityRing({ total, active, filled, empty }: { total: number; active: number; filled: string; empty: string }) {
  /* One segment per agent, and none at all when there are no agents: the
   *  ring is a census of the workforce, not a placeholder dial. Guarding
   *  with Math.max(1, …) would draw a lone full-circle arc for a brain
   *  that owns nothing, which reads as "1 of 1" at a glance. */
  const n = Math.max(0, total);
  const on = Math.min(Math.max(0, active), n);
  const sweep = n > 0 ? 360 / n : 0;
  return (
    <svg
      aria-hidden
      viewBox="0 0 200 200"
      style={{
        position: "absolute",
        left: 0,
        top: 0,
        width: 200,
        height: 200,
        pointerEvents: "none",
        overflow: "visible",
      }}
    >
      {Array.from({ length: n }, (_, i) => (
        <path
          key={i}
          d={arcPath(100, 100, RING_R, -90 + i * sweep + RING_GAP_DEG, -90 + (i + 1) * sweep - RING_GAP_DEG)}
          fill="none"
          stroke={i < on ? filled : empty}
          strokeWidth={5}
          strokeLinecap="round"
        />
      ))}
    </svg>
  );
}

export function BrainNode({ id, data }: NodeProps) {
  const d = data as unknown as BrainNodeData;
  const entity = d.entity as BrainRuntime;
  const status = ORB_ROLE[entity.state] ?? ORB_ROLE.working;
  const territoryCount = d.territoryCount ?? 0;
  const allExpanded = d.allExpanded ?? false;

  /* Live theme levels; recomputed on every theme change without a reload. */
  const themeVersion = useNodeThemeVersion();
  const glowMode = d.glow === "none" ? "none" : "auto";
  const core = React.useMemo(() => {
    const t = readNodeThemeTokens() ?? FALLBACK_NODE_THEME;
    const base = coreRoleBase(status.role, t.accent, t.canvas);
    return getCoreOrbPalette({ role: status.role, base, surface: t.surface, accent: t.accent, canvas: t.canvas, glowMode });
  }, [themeVersion, status.role, glowMode]);

  const palette: OrbPalette = React.useMemo(
    () => ({
      gradient: core.gradient,
      glow: core.shadow,
      eye: core.eye,
      badgeText: core.badgeText,
      contrast: 4.5,
    }),
    [core]
  );

  const total = Math.max(0, entity.agentCount ?? 0);
  const activeCount = Math.min(Math.max(0, entity.activeCount ?? 0), Math.max(1, total));

  const orbButton = (glyph: React.ReactNode, label: string, onClick: () => void, extra?: Record<string, unknown>) => (
    <button
      type="button"
      className="av-hit"
      title={label}
      aria-label={label}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      {...extra}
    >
      <span
        className="av-circle"
        style={{
          width: 22,
          height: 22,
          background: core.buttonFill,
          border: `0.5px solid ${core.buttonBorder}`,
          color: core.buttonIcon,
        }}
      >
        {glyph}
      </span>
    </button>
  );

  return (
    /* The sphere clips its own content; the handle and ring live on this
     * unclipped 200px wrapper so colony edges still start at the bottom. */
    <div className="node-list-in relative cursor-pointer" style={{ width: 200, height: 200 }}>
      <Handle
        type="source"
        position={Position.Bottom}
        id={HANDLE_IDS.out}
        style={{
          width: 9,
          height: 9,
          minWidth: 9,
          minHeight: 9,
          background: rgbString(core.dotFill),
          border: `1.5px solid ${rgbString(core.dotBorder)}`,
        }}
      />
      <SideHandles source />
      <ActivityRing
        total={total}
        active={activeCount}
        filled={rgbString(core.ringFilled)}
        empty={rgbString(core.ringEmpty)}
      />
      <div style={{ position: "absolute", left: 30, top: 30 }}>
        <AvatarOrb
          baseColor=""
          fallbackColor="#4f46e5"
          variant="content"
          size="xl"
          blink={status.blink}
          palette={palette}
          eyeGeometry={{ ...EYE_GEOMETRY[entity.state], gap: 18, marginBottom: 10 }}
          title="Strike Brain"
          aria-label={`Strike Brain, ${status.label.toLowerCase()}, ${activeCount} of ${total} agents active`}
        >
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
            <span
              role="img"
              aria-label={`${status.label}, ${activeCount} of ${total} agents active`}
              title={`${status.label} · ${activeCount}/${total} active`}
              style={{
                fontSize: 12,
                lineHeight: "16px",
                padding: "2px 10px",
                borderRadius: 999,
                fontWeight: 600,
                whiteSpace: "nowrap",
                background: core.badgeFill,
                color: core.badgeText,
              }}
            >
              {status.label}
            </span>
            <div style={{ fontSize: 14, lineHeight: "16px", fontWeight: 500, color: rgbString(core.ink) }}>
              <b style={{ fontWeight: 600 }}>
                {activeCount}/{total}
              </b>{" "}
              active
            </div>
            {territoryCount > 0 &&
              orbButton(<Maximize2 size={13} aria-hidden />, "Expand all", () => d.expandAll?.(), {
                "aria-expanded": allExpanded,
              } as Record<string, unknown>)}
          </div>
        </AvatarOrb>
      </div>
    </div>
  );
}
