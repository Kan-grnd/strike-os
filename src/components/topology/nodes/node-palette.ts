"use client";

import * as React from "react";
import { mix, luminance, ratio, rgbString, rgba, resolveToRgb } from "../../ui/components-primitives-avatar";

/* ------------------------------------------------------------------ *
 * Topology node family — shared theme + contrast engine.
 *
 * All node colors derive from three theme levels (canvas = --background,
 * surface = --card, accent = --primary) plus the fixed status bases below,
 * using the same mix/luminance/ratio helpers as the core sphere. Every
 * function here is pure RGB math except the DOM readers, so the contrast
 * gate (scripts/check-node-contrast.ts) imports this module and evaluates
 * the exact colors the components paint — no browser needed.
 * ------------------------------------------------------------------ */

export type Rgb = [number, number, number];

export const WHITE: Rgb = [255, 255, 255];
export const NEAR_BLACK: Rgb = [16, 16, 16];
/** Near-black ink for the core sphere (#161616 per spec). */
export const NEAR_INK: Rgb = [22, 22, 22];
const BLACK: Rgb = [0, 0, 0];

/** Fixed status bases from the node-family spec. */
export const STATUS_BASE = {
  success: "#2a9d5f",
  warning: "#e27a2a",
  danger: "#e74668",
} as const;

export type StatusTreatment = "success" | "warning" | "danger" | "accent" | "assigned" | "muted";

/** Parse hex, rgb()/rgba(), hsl()/hsl channels ("210 80% 45%") to sRGB. */
export function parseCssColorToRgb(input: string): Rgb | null {
  const v = input.trim();
  if (!v) return null;
  const hex = v.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (hex) {
    let h = hex[1];
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  }
  const rgbFn = v.match(/^rgba?\(([^)]+)\)$/i);
  if (rgbFn) {
    const parts = rgbFn[1].split(/[,/\s]+/).filter(Boolean);
    if (parts.length >= 3) {
      const nums = parts.slice(0, 3).map((p) => {
        if (p.endsWith("%")) return (Number(p.slice(0, -1)) / 100) * 255;
        return Number(p);
      });
      if (nums.every((n) => Number.isFinite(n))) {
        return [Math.round(nums[0]), Math.round(nums[1]), Math.round(nums[2])];
      }
    }
    return null;
  }
  const hslFn = v.match(/^hsla?\(([^)]+)\)$/i);
  const channels = hslFn ? hslFn[1] : v;
  const hp = channels.split(/[,/\s]+/).filter(Boolean);
  if (hp.length === 3 && hp[1].endsWith("%") && hp[2].endsWith("%")) {
    const h = Number(hp[0].replace("deg", ""));
    const s = Number(hp[1].slice(0, -1)) / 100;
    const l = Number(hp[2].slice(0, -1)) / 100;
    if (Number.isFinite(h) && Number.isFinite(s) && Number.isFinite(l)) {
      return hslToRgb(((h % 360) + 360) % 360, s, l);
    }
  }
  return null;
}

export function hslToRgb(h: number, s: number, l: number): Rgb {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r = 0;
  let g = 0;
  let b = 0;
  if (h < 60) {
    r = c;
    g = x;
  } else if (h < 120) {
    r = x;
    g = c;
  } else if (h < 180) {
    g = c;
    b = x;
  } else if (h < 240) {
    g = x;
    b = c;
  } else if (h < 300) {
    r = x;
    b = c;
  } else {
    r = c;
    b = x;
  }
  return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)];
}

/** sRGB → OKLab chroma (0 = grey). Used for the "accent has chroma" rule. */
export function chroma(c: Rgb): number {
  const toLinear = (v: number): number => {
    const s = v / 255;
    return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  const r = toLinear(c[0]);
  const g = toLinear(c[1]);
  const b = toLinear(c[2]);
  const l = 0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b;
  const m = 0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b;
  const s = 0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b;
  const l_ = Math.cbrt(l);
  const m_ = Math.cbrt(m);
  const s_ = Math.cbrt(s);
  const a = 1.9779984951 * l_ - 2.428592205 * m_ + 0.4505937099 * s_;
  const bb = 0.0259040371 * l_ + 0.7827717662 * m_ - 0.808675766 * s_;
  return Math.sqrt(a * a + bb * bb);
}

/**
 * Nudge `fg` toward black, then toward white, until it clears `minRatio`
 * against `bg`. Returns the passing color, or the best extreme tried.
 */
export function adjustToContrast(fg: Rgb, bg: Rgb, minRatio: number): Rgb {
  if (ratio(fg, bg) >= minRatio) return fg;
  let best: Rgb = fg;
  let bestRatio = ratio(fg, bg);
  for (let k = 0.03; k <= 0.95; k += 0.03) {
    const c = mix(fg, BLACK, k);
    const r = ratio(c, bg);
    if (r > bestRatio) {
      best = c;
      bestRatio = r;
    }
    if (r >= minRatio) return c;
  }
  for (let k = 0.03; k <= 0.95; k += 0.03) {
    const c = mix(fg, WHITE, k);
    const r = ratio(c, bg);
    if (r > bestRatio) {
      best = c;
      bestRatio = r;
    }
    if (r >= minRatio) return c;
  }
  return best;
}

/** Whichever of white / near-black contrasts more against `bg`. */
export function pickTextOn(bg: Rgb): Rgb {
  return ratio(WHITE, bg) >= ratio(NEAR_BLACK, bg) ? WHITE : NEAR_BLACK;
}

export interface NodeThemeTokens {
  /** Level 1 base/canvas: --background. */
  canvas: Rgb;
  /** Level 2 surface: --card. */
  surface: Rgb;
  /** Level 3 accent: --primary. */
  accent: Rgb;
}

/** SSR-safe fallback (graphite values) used before the DOM is available. */
export const FALLBACK_NODE_THEME: NodeThemeTokens = {
  canvas: [23, 23, 23],
  surface: [33, 33, 33],
  accent: [232, 232, 232],
};

const TOKEN_NAMES = ["--background", "--card", "--primary"] as const;

/** Read the three theme levels off the document root. Null outside a browser. */
export function readNodeThemeTokens(): NodeThemeTokens | null {
  if (typeof document === "undefined") return null;
  const raw = TOKEN_NAMES.map((t) =>
    getComputedStyle(document.documentElement).getPropertyValue(t).trim()
  );
  const parsed = raw.map((v) => parseCssColorToRgb(v) ?? resolveToRgb(v));
  if (parsed.some((c) => !c)) return null;
  return { canvas: parsed[0]!, surface: parsed[1]!, accent: parsed[2]! };
}

export interface TreatmentColors {
  /** Display base (after the accent-chroma rule, if any). */
  base: Rgb;
  /** Body text in this treatment on the given surface (>= 4.5:1). */
  text: Rgb;
  /** Dots, bars, icons in this treatment on the given surface (>= 3:1). */
  graphic: Rgb;
}

/** One status treatment resolved against a background surface. */
export function buildTreatment(
  base: Rgb,
  bg: Rgb,
  accent: Rgb,
  opts: { chromaMix?: boolean } = {}
): TreatmentColors {
  const mixed = opts.chromaMix && chroma(accent) >= 0.12 ? mix(base, accent, 0.12) : base;
  return {
    base: mixed,
    text: adjustToContrast(mixed, bg, 4.5),
    graphic: adjustToContrast(mixed, bg, 3.0),
  };
}

export interface NodePalette {
  tokens: NodeThemeTokens;
  surface: Rgb;
  surfaceText: Rgb;
  secondaryText: Rgb;
  border: Rgb;
  accentGlow: (px: number, alpha: number) => string;
  /** Raw Level 3 accent (reference rule: no chroma fallback). */
  statusAccent: Rgb;
  /** Colony segmented-bar unfilled color: surface +18% accent, >= 1.6:1. */
  track: Rgb;
  /** Same track resolved against the ticket surface. */
  taskTrack: Rgb;
  /** Task/sub-agent card surface (surface mixed 45% toward canvas). */
  taskSurface: Rgb;
  taskText: Rgb;
  taskSecondary: Rgb;
  treatments: Record<StatusTreatment, TreatmentColors>;
  taskTreatments: Record<StatusTreatment, TreatmentColors>;
}

/** Accent treatment base: the raw Level 3 accent in every theme (reference
 *  rule — no chroma fallback). Pure. */
export function statusAccentFor(accent: Rgb): Rgb {
  return accent;
}

/** Track color: surface mixed 18% toward accent, nudged to >= 1.6:1. Pure. */
export function trackColorFor(surface: Rgb, accent: Rgb): Rgb {
  return adjustToContrast(mix(surface, accent, 0.18), surface, 1.6);
}

/** Activity-ring track: the same mix, held to >= 1.6:1 against the canvas
 *  the ring floats over. Pure. */
export function ringTrackFor(surface: Rgb, accent: Rgb, canvas: Rgb): Rgb {
  return adjustToContrast(mix(surface, accent, 0.18), canvas, 1.6);
}

/**
 * Core-sphere shadow: the reference hairline ring plus an aura rescaled to
 * stay inside the sphere→ring gap (the file's 20px/6px aura would cross the
 * ring). "none" is handled by the caller. Pure.
 */
export function coreShadowFor(m: Rgb, canvas: Rgb): string {
  const light = isLightCanvas(canvas);
  return (
    `0 0 6px 0 ${rgba(m, light ? 0.25 : 0.4)}, ` +
    `0 0 10px 1px ${rgba(m, light ? 0.12 : 0.18)}, ` +
    `inset 0 0 0 1px rgba(255,255,255,0.08)`
  );
}

/** Full node-family palette from three theme levels. Pure: gate uses this. */
export function buildNodePalette(t: NodeThemeTokens): NodePalette {
  const surfaceText = pickTextOn(t.surface);
  const secondaryText = mix(surfaceText, t.surface, 0.3);
  const border = mix(t.surface, t.accent, 0.22);
  const track = trackColorFor(t.surface, t.accent);
  const taskSurface = mix(t.surface, t.canvas, 0.45);
  const taskText = pickTextOn(taskSurface);
  const taskSecondary = mix(taskText, taskSurface, 0.3);
  const taskTrack = trackColorFor(taskSurface, t.accent);
  const hex = (s: string): Rgb => parseCssColorToRgb(s) ?? [0, 0, 0];
  const statusAccent = statusAccentFor(t.accent);
  const defs: Record<StatusTreatment, Rgb> = {
    success: hex(STATUS_BASE.success),
    warning: hex(STATUS_BASE.warning),
    danger: hex(STATUS_BASE.danger),
    accent: statusAccent,
    assigned: mix(statusAccent, t.canvas, 0.3),
    muted: mix(t.accent, t.canvas, 0.5),
  };
  const chromaMix = (k: StatusTreatment): boolean => k === "success" || k === "warning" || k === "danger";
  const treatments = {} as Record<StatusTreatment, TreatmentColors>;
  const taskTreatments = {} as Record<StatusTreatment, TreatmentColors>;
  (Object.keys(defs) as StatusTreatment[]).forEach((k) => {
    treatments[k] = buildTreatment(defs[k], t.surface, t.accent, { chromaMix: chromaMix(k) });
    taskTreatments[k] = buildTreatment(defs[k], taskSurface, t.accent, { chromaMix: chromaMix(k) });
  });
  return {
    tokens: t,
    surface: t.surface,
    surfaceText,
    secondaryText,
    border,
    accentGlow: (px: number, alpha: number) => `0 0 0 ${px}px ${rgba(t.accent, alpha)}`,
    statusAccent,
    track,
    taskTrack,
    taskSurface,
    taskText,
    taskSecondary,
    treatments,
    taskTreatments,
  };
}

/** Re-render tick for theme changes without a reload. */
export function useNodeThemeVersion(): number {
  const [v, setV] = React.useState(0);
  React.useEffect(() => {
    const bump = () => setV((x) => x + 1);
    bump();
    const observer = new MutationObserver(bump);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class", "data-theme"],
    });
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    media.addEventListener?.("change", bump);
    return () => {
      observer.disconnect();
      media.removeEventListener?.("change", bump);
    };
  }, []);
  return v;
}

/** Resolve the live palette (DOM) or the SSR fallback. */
export function useNodePalette(): NodePalette {
  const v = useNodeThemeVersion();
  return React.useMemo(() => buildNodePalette(readNodeThemeTokens() ?? FALLBACK_NODE_THEME), [v]);
}

/** sRGB chroma as specified for the core sphere: (max-min)/255. */
export function rgbChroma(c: Rgb): number {
  return (Math.max(c[0], c[1], c[2]) - Math.min(c[0], c[1], c[2])) / 255;
}

/** Canvas is light when its relative luminance is above 0.6. */
export function isLightCanvas(canvas: Rgb): boolean {
  return luminance(canvas) > 0.6;
}

export type CoreOrbRole = "working" | "idle" | "active" | "blocked" | "error";

export interface CoreOrbInput {
  role: CoreOrbRole;
  /** Role base color (working resolves to the accent before calling). */
  base: Rgb;
  /** Level 2 surface (currently only feeds the unfilled ring mix). */
  surface: Rgb;
  /** Level 3 accent. */
  accent: Rgb;
  /** Level 1 canvas. Defaults to surface when omitted. */
  canvas?: Rgb;
  /** "auto" paints the theme-driven glow, "none" paints no shadow at all. */
  glowMode?: "auto" | "none";
}

export interface CoreOrbPalette {
  /** Adjusted sphere base M (ink clears 4.5:1 against it). */
  m: Rgb;
  ink: Rgb;
  oppositeInk: Rgb;
  gradient: string;
  shadow: string;
  eye: string;
  badgeFill: string;
  badgeText: string;
  buttonFill: string;
  buttonIcon: string;
  buttonBorder: string;
  ringFilled: Rgb;
  ringEmpty: Rgb;
  dotFill: Rgb;
  dotBorder: Rgb;
  /** Glow alphas actually used (wider on dark canvases). */
  glowAlphas: [number, number];
  lightCanvas: boolean;
}

const CORE_SEMANTIC: Record<Exclude<CoreOrbRole, "working" | "idle">, string> = {
  active: "#2a9d5f",
  blocked: "#e27a2a",
  error: "#e74668",
};

export function coreRoleBase(role: CoreOrbRole, accent: Rgb, canvas: Rgb): Rgb {
  if (role === "working") return accent;
  if (role === "idle") return mix(accent, canvas, 0.45);
  return parseCssColorToRgb(CORE_SEMANTIC[role]) ?? [0, 0, 0];
}

/**
 * Pure core-sphere palette. Ink is white iff it clears 4.5:1 against M with
 * at least near-black's ratio, else near-black iff it clears, else the better
 * of the two with M pushed toward the opposite in 3% steps. Gradient stops,
 * glow, ring and button colors derive from the same M. Unit-tested per theme.
 */
export function getCoreOrbPalette(input: CoreOrbInput): CoreOrbPalette {
  const canvas = input.canvas ?? input.surface;
  const lightCanvas = isLightCanvas(canvas);
  let base = input.base;
  if ((input.role === "active" || input.role === "blocked" || input.role === "error") && rgbChroma(input.accent) >= 0.12) {
    base = mix(base, input.accent, 0.12);
  }
  const whiteOk = ratio(WHITE, base) >= 4.5 && ratio(WHITE, base) >= ratio(NEAR_INK, base);
  const darkOk = ratio(NEAR_INK, base) >= 4.5;
  const ink: Rgb = whiteOk ? WHITE : darkOk ? NEAR_INK : ratio(WHITE, base) >= ratio(NEAR_INK, base) ? WHITE : NEAR_INK;
  const oppositeInk: Rgb = ink === WHITE ? NEAR_INK : WHITE;
  // Push M toward the opposite of the ink until the ink clears 4.5:1.
  let m = base;
  const pushToward: Rgb = ink === WHITE ? BLACK : WHITE;
  for (let k = 0.03; k <= 1.0001 && ratio(ink, m) < 4.5; k += 0.03) {
    m = mix(base, pushToward, Math.min(1, k));
  }
  const gradient = ink === WHITE
    ? `radial-gradient(circle at 50% 42%, ${rgbString(mix(m, BLACK, 0.3))} 0%, ${rgbString(m)} 58%, ${rgbString(mix(m, WHITE, 0.25))} 80%, ${rgbString(mix(m, WHITE, 0.6))} 100%)`
    : `radial-gradient(circle at 50% 42%, ${rgbString(mix(m, WHITE, 0.25))} 0%, ${rgbString(m)} 58%, ${rgbString(mix(m, BLACK, 0.1))} 80%, ${rgbString(mix(m, BLACK, 0.28))} 100%)`;
  const glowAlphas: [number, number] = lightCanvas ? [0.25, 0.12] : [0.4, 0.18];
  /* Reference shadow shape with the aura rescaled to stay inside the
   * sphere→ring gap. "none" paints no shadow at all. */
  const shadow = input.glowMode === "none" ? "none" : coreShadowFor(m, canvas);
  const inkCss = rgbString(ink);
  const oppositeCss = rgbString(oppositeInk);
  const buttonFill = ink === WHITE ? "rgba(0,0,0,0.28)" : "rgba(255,255,255,0.4)";
  return {
    m,
    ink,
    oppositeInk,
    gradient,
    shadow,
    eye: inkCss,
    badgeFill: rgba(ink, 0.92),
    badgeText: oppositeCss,
    buttonFill,
    buttonIcon: inkCss,
    buttonBorder: rgba(ink, 0.5),
    ringFilled: adjustToContrast(base, canvas, 3.0),
    ringEmpty: ringTrackFor(input.surface, input.accent, canvas),
    dotFill: input.surface,
    dotBorder: input.accent,
    glowAlphas,
    lightCanvas,
  };
}

/** Sentence case for task statuses: "RUNNING" -> "Running". */
export function sentenceCase(s: string): string {
  const words = s.replace(/_/g, " ").toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

export interface AvatarColors {
  /** Sphere mid tone (reference ≥3:1 ink rule + 1.8:1 surface guard). */
  sphere: Rgb;
  /** Eyes: white or #161616 ink, whichever contrasts more (>= 3:1). */
  eye: Rgb;
  /** 1px inset rim: the eye ink at 35%. */
  rim: string;
  /** Sphere gradient in the reference's 60%/100% stops. */
  gradient: string;
}

/** Agent-avatar sphere (reference ≥3:1 ink rule, 60%/100% stops) with a
 *  surface guard: below 1.8:1 against the node surface the sphere is nudged
 *  toward the opposite of the surface luminance until it passes, otherwise it
 *  is untouched. Eyes stay >= 3:1. Pure: gate uses this. */
export function avatarColors(sphereBase: Rgb, surface: Rgb): AvatarColors {
  let base = sphereBase;
  if (ratio(base, surface) < 1.8) {
    const toward = luminance(surface) < 0.5 ? WHITE : BLACK;
    for (let k = 0.03; k <= 1.0001 && ratio(base, surface) < 1.8; k += 0.03) {
      base = mix(sphereBase, toward, Math.min(1, k));
    }
  }
  let m = base;
  const rw = ratio(m, WHITE);
  const rd = ratio(m, NEAR_INK);
  let ink: Rgb;
  if (rw >= 3 && rw >= rd) {
    ink = WHITE;
  } else if (rd >= 3) {
    ink = NEAR_INK;
  } else if (rw >= rd) {
    ink = WHITE;
    for (let k = 0.03; k <= 0.95 && ratio(m, WHITE) < 3; k += 0.03) m = mix(base, BLACK, Math.min(1, k));
  } else {
    ink = NEAR_INK;
    for (let k = 0.03; k <= 0.95 && ratio(m, NEAR_INK) < 3; k += 0.03) m = mix(base, WHITE, Math.min(1, k));
  }
  const core = ink === WHITE ? mix(m, BLACK, 0.3) : mix(m, WHITE, 0.25);
  const edge = ink === WHITE ? mix(m, WHITE, 0.5) : mix(m, BLACK, 0.25);
  return {
    sphere: m,
    eye: ink,
    rim: rgba(ink, 0.35),
    gradient: `radial-gradient(circle at 50% 42%, ${rgbString(core)} 0%, ${rgbString(m)} 60%, ${rgbString(edge)} 100%)`,
  };
}

/** Agent-avatar glow (reference): hairline ring plus a 12px aura at 35%. */
export function miniGlowFor(base: Rgb): string {
  return `0 0 0 1px rgba(255,255,255,0.06), 0 0 12px ${rgba(base, 0.35)}`;
}

/**
 * Sphere glow (legacy helper, kept for the gate): chromatic base gets a ring
 * plus aura, neutral bases an inset rim and soft drop. The core sphere paints
 * coreShadowFor instead.
 */
export function glowFor(base: Rgb, canvas: Rgb): string {
  const light = isLightCanvas(canvas);
  if (rgbChroma(base) >= 0.12) {
    return `0 0 0 1px rgba(255,255,255,0.08), 0 0 12px 1px ${rgba(base, light ? 0.16 : 0.28)}`;
  }
  return `inset 0 0 0 1px rgba(255,255,255,0.10), 0 8px 18px -10px ${rgba(BLACK, light ? 0.25 : 0.5)}`;
}

/** Colony tab icon key by colony name (case-insensitive); override wins. */
export function colonyIconKey(name: string, override?: string): string {
  if (override && /^[A-Za-z]+$/.test(override)) return override;
  const n = name.toLowerCase();
  if (n.includes("research") || n.includes("science")) return "FlaskConical";
  if (n.includes("engineering") || n.includes("dev") || n.includes("code")) return "Code";
  if (n.includes("support") || n.includes("help")) return "Headset";
  if (n.includes("data")) return "Database";
  if (n.includes("security")) return "ShieldCheck";
  return "Layers";
}

export type AgentCharacter = "monocle" | "antenna" | "glasses" | "hardhat" | "headphones" | "shield" | "sprout" | "bowtie";

/** Character overlay by role name (reference keys, case-insensitive); override
 *  wins. Unknown roles get sprout (odd code sum) or bow tie (even). */
export function agentCharacter(name: string, override?: string): AgentCharacter {
  const known: AgentCharacter[] = ["monocle", "antenna", "glasses", "hardhat", "headphones", "shield", "sprout", "bowtie"];
  if (override && (known as string[]).includes(override)) return override as AgentCharacter;
  const n = name.toLowerCase();
  if (n.includes("researcher")) return "monocle";
  if (n.includes("web analyst")) return "antenna";
  if (n.includes("source reviewer")) return "glasses";
  if (n.includes("architect")) return "hardhat";
  if (n.includes("coder")) return "headphones";
  if (n === "qa") return "shield";
  if (n.includes("translator")) return "sprout";
  if (n.includes("docs writer") || n.includes("writer")) return "glasses";
  let sum = 0;
  for (const ch of n) sum += ch.codePointAt(0) ?? 0;
  return sum % 2 === 1 ? "sprout" : "bowtie";
}

export { luminance, ratio, rgbString, rgba, mix, resolveToRgb };
