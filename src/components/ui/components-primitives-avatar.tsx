"use client";

import * as React from "react";

/* ------------------------------------------------------------------ *
 * Strike OS — orb sphere primitive.
 *
 * Ported from the Strike Brain sphere preview and extended for in-app use:
 * content mode renders the eyes as the first item of a centered stack with
 * arbitrary children below, and the whole sphere derives its palette from the
 * app's own theme tokens so it recolors with the active theme pack.
 * ------------------------------------------------------------------ */

export interface OrbPalette {
  /** Sphere fill. */
  gradient: string;
  /** Outer glow + inner hairline, used as box-shadow. */
  glow: string;
  /** Iris fill for each eye. */
  eye: string;
  /** Dark text color for the white status pill. */
  badgeText: string;
  /** Contrast ratio of the sphere's mid tone against white (>= 4.5). */
  contrast: number;
}

const WHITE: [number, number, number] = [255, 255, 255];
const BLACK: [number, number, number] = [0, 0, 0];
/** The status pill is 92% white; grade against near-white, not pure white. */
const BADGE_BG: [number, number, number] = [250, 250, 250];

function mix(
  a: [number, number, number],
  b: [number, number, number],
  t: number
): [number, number, number] {
  return [
    Math.round(a[0] + (b[0] - a[0]) * t),
    Math.round(a[1] + (b[1] - a[1]) * t),
    Math.round(a[2] + (b[2] - a[2]) * t),
  ];
}

/** Shared color math, also used by the topology node family. */
export { mix };
export type RgbTuple = [number, number, number];

function channelToLinear(v: number): number {
  const s = v / 255;
  return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
}

function luminance(c: [number, number, number]): number {
  return 0.2126 * channelToLinear(c[0]) + 0.7152 * channelToLinear(c[1]) + 0.0722 * channelToLinear(c[2]);
}

export { luminance };

function ratio(a: [number, number, number], b: [number, number, number]): number {
  const x = luminance(a);
  const y = luminance(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

export { ratio };

/** Darken `base` against `bg` in 3% steps until it clears 4.5:1 (cap 95%). */
function safe(
  base: [number, number, number],
  bg: [number, number, number]
): [number, number, number] {
  let k = 0;
  let c = base;
  while (ratio(c, bg) < 4.5 && k < 0.95) {
    k += 0.03;
    c = mix(base, BLACK, k);
  }
  return c;
}

function rgbString(c: [number, number, number]): string {
  return `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
}

export { rgbString };

function rgba(c: [number, number, number], a: number): string {
  return `rgba(${c[0]}, ${c[1]}, ${c[2]}, ${a})`;
}

export { rgba };

/** Static parser used during SSR / before the DOM is available. */
function parseStatic(value: string): [number, number, number] | null {
  const v = value.trim();
  const hex = v.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  if (hex) {
    let h = hex[1];
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
  }
  const fn = v.match(/^rgba?\(([^)]+)\)$/i);
  if (fn) {
    const parts = fn[1].split(/[,/\s]+/).filter(Boolean).slice(0, 3).map(Number);
    if (parts.length === 3 && parts.every((n) => Number.isFinite(n))) {
      return [parts[0], parts[1], parts[2]];
    }
  }
  return null;
}

/**
 * Resolve any CSS color — hex, rgb(), hsl(), oklch(), a named color, or raw
 * HSL channels like "222 47% 11%" — to RGB by handing it to the browser (a 1px
 * canvas), which normalizes every color space to sRGB for us.
 */
export function resolveToRgb(input?: string): [number, number, number] | null {
  if (!input) return null;
  const value = input.trim();
  if (!value) return null;
  if (typeof document === "undefined") return parseStatic(value);

  /* The app stores tokens as bare channels ("205 82% 55%"), consumed elsewhere
   * as hsl(var(--token)); wrap them so the browser can parse them. */
  const isRawChannels = /^[\d.]+(?:\s+[\d.]+%?){2}$/.test(value);
  const css = isRawChannels ? `hsl(${value})` : value;

  try {
    const canvas = document.createElement("canvas");
    canvas.width = 1;
    canvas.height = 1;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return parseStatic(value);
    const sentinel = "#123456";
    ctx.fillStyle = sentinel;
    ctx.fillStyle = css;
    /* An invalid assignment is ignored, leaving the sentinel in place. */
    if (ctx.fillStyle === sentinel && css.replace(/\s/g, "").toLowerCase() !== sentinel) {
      return null;
    }
    ctx.clearRect(0, 0, 1, 1);
    ctx.fillRect(0, 0, 1, 1);
    const d = ctx.getImageData(0, 0, 1, 1).data;
    return [d[0], d[1], d[2]];
  } catch {
    return null;
  }
}

/**
 * Pure palette builder. Takes the base color and returns the gradient, glow,
 * eye fill and pill text; the mid tone is darkened until it reaches 4.5:1
 * against white so white content on the sphere always passes contrast.
 */
export function getOrbPalette(baseColor: string): OrbPalette {
  const resolved = resolveToRgb(baseColor) ?? resolveToRgb("#4f46e5") ?? [79, 70, 229];
  const M = safe(resolved, WHITE);
  const core = mix(M, BLACK, 0.3);
  const soft = mix(M, WHITE, 0.25);
  const edge = mix(M, WHITE, 0.6);
  const badge = mix(safe(resolved, BADGE_BG), BLACK, 0.15);
  return {
    gradient: `radial-gradient(circle at 50% 42%, ${rgbString(core)} 0%, ${rgbString(M)} 58%, ${rgbString(soft)} 80%, ${rgbString(edge)} 100%)`,
    glow: `0 0 6px 0 ${rgba(resolved, 0.4)}, 0 0 24px 8px ${rgba(resolved, 0.2)}, inset 0 0 0 1px rgba(255,255,255,0.08)`,
    eye: `linear-gradient(135deg, #fff 0%, ${rgbString(mix(resolved, WHITE, 0.85))} 100%)`,
    badgeText: rgbString(badge),
    contrast: ratio(M, WHITE),
  };
}

/** Blink keyframes plus the reduced-motion opt-out keyed on the inline style. */
export const BLINK_KEYFRAMES = `
@keyframes av-blink{0%,88%,100%{transform:scaleY(1)}93%,97%{transform:scaleY(.07)}}
.av-eye{border-radius:50%}
.av-hit{background:transparent;border:0;padding:0;display:inline-flex;align-items:center;justify-content:center;width:32px;height:32px;cursor:pointer}
.av-circle{width:20px;height:20px;display:inline-flex;align-items:center;justify-content:center;border-radius:50%;background:rgba(255,255,255,.16);color:#fff;border:1px solid rgba(255,255,255,.4);transition:background .15s}
.av-hit:hover .av-circle{background:rgba(255,255,255,.3)}
@media (prefers-reduced-motion: reduce) { [style*="av-blink"] { animation: none !important; } }
`;

const SIZE_PX: Record<NonNullable<AvatarOrbProps["size"]>, number> = {
  sm: 40,
  md: 64,
  lg: 120,
  xl: 220,
};

/** The brain orb's canonical default — its 100% standard. Content mode ignores
 *  the named size scale entirely, so this constant IS the size: it is the
 *  promoted baseline. The orb-sphere is 140px inside a 200px ring canvas, or
 *  30px inset on all sides. Everything downstream measures against it. */
export const CONTENT_ORB_STANDARD_PX = 140;

export interface AvatarOrbProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "children"> {
  /** Theme token name ("--info"), CSS color, or raw HSL channels. */
  baseColor: string;
  /** Used while a token is missing/unparseable and during SSR. */
  fallbackColor?: string;
  variant?: "default" | "content";
  size?: "sm" | "md" | "lg" | "xl";
  /** Eyes blink on a slow loop. Defaults off; the node sets it per status. */
  blink?: boolean;
  /** Fully computed palette (e.g. the theme-driven core sphere). When
   *  provided, the internal token observer is skipped. */
  palette?: OrbPalette | null;
  /** Eyes ease toward the cursor. Defaults on in content mode. */
  followCursor?: boolean;
  /** Per-state eye geometry in content mode (reference EYE map). Defaults to
   *  the 10x16 round pair with a 20px gap and 16px below. */
  eyeGeometry?: { w: number; h: number; radius?: string; gap?: number; marginBottom?: number };
  children?: React.ReactNode;
}

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true
  );
}

/** Read a CSS custom property (raw channel string) off the document root. */
function readThemeColor(input: string): string {
  if (typeof document === "undefined") return "";
  if (!input.startsWith("--")) return input;
  return getComputedStyle(document.documentElement).getPropertyValue(input).trim();
}

export function AvatarOrb({
  baseColor,
  fallbackColor = "#4f46e5",
  variant = "default",
  size = "md",
  blink = false,
  followCursor,
  palette: providedPalette = null,
  eyeGeometry,
  children,
  className,
  style,
  onPointerDown,
  ...rest
}: AvatarOrbProps) {
  const isContent = variant === "content";
  const follow = followCursor ?? isContent;
  const px = isContent ? CONTENT_ORB_STANDARD_PX : SIZE_PX[size];
  const eye = isContent
    ? {
        w: 10,
        h: 16,
        radius: "50%",
        gap: 20,
        marginBottom: 16,
        ...eyeGeometry,
      }
    : { w: 9, h: 14, radius: "50%", gap: 15, marginBottom: 0 };

  const rootRef = React.useRef<HTMLDivElement>(null);
  const outerRef = React.useRef<HTMLDivElement>(null);
  const innerRef = React.useRef<HTMLDivElement>(null);

  const [autoPalette, setAutoPalette] = React.useState<OrbPalette>(() =>
    getOrbPalette(fallbackColor)
  );
  const palette = providedPalette ?? autoPalette;

  /* Re-read the token on mount and whenever the theme class/attribute or the
   * OS color scheme changes — no remount, no React state on the hot path.
   * Skipped when the caller injects a fully computed palette. */
  React.useEffect(() => {
    if (providedPalette) return;
    const compute = () =>
      setAutoPalette(getOrbPalette(readThemeColor(baseColor) || fallbackColor));
    compute();
    const observer = new MutationObserver(compute);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class", "data-theme"],
    });
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    media.addEventListener?.("change", compute);
    return () => {
      observer.disconnect();
      media.removeEventListener?.("change", compute);
    };
  }, [baseColor, fallbackColor, providedPalette]);

  /* Eyes ease toward the cursor. Current/target live in refs and the transform
   * is written straight to the node, so pointermove never re-renders React. */
  React.useEffect(() => {
    const outer = outerRef.current;
    const inner = innerRef.current;
    if (!outer || !inner || !follow || prefersReducedMotion()) return;

    let tx = 0;
    let ty = 0;
    let cx = 0;
    let cy = 0;
    let raf: number | null = null;

    const tick = () => {
      cx += (tx - cx) * 0.18;
      cy += (ty - cy) * 0.18;
      inner.style.transform = `translate(${cx.toFixed(2)}px, ${cy.toFixed(2)}px)`;
      if (Math.abs(tx - cx) > 0.05 || Math.abs(ty - cy) > 0.05) {
        raf = requestAnimationFrame(tick);
      } else {
        raf = null;
      }
    };
    const aim = (x: number, y: number) => {
      const r = outer.getBoundingClientRect();
      const dx = x - (r.left + r.width / 2);
      const dy = y - (r.top + r.height / 2);
      const d = Math.hypot(dx, dy) || 1;
      const k = Math.min(d / 160, 1);
      tx = (dx / d) * k * 6;
      ty = (dy / d) * k * 4;
      if (raf === null) raf = requestAnimationFrame(tick);
    };
    const rest = () => {
      tx = 0;
      ty = 0;
      if (raf === null) raf = requestAnimationFrame(tick);
    };
    const onMove = (e: PointerEvent) => {
      if (e.pointerType === "touch") return;
      aim(e.clientX, e.clientY);
    };
    window.addEventListener("pointermove", onMove);
    document.documentElement.addEventListener("mouseleave", rest);
    return () => {
      window.removeEventListener("pointermove", onMove);
      document.documentElement.removeEventListener("mouseleave", rest);
      if (raf !== null) cancelAnimationFrame(raf);
    };
  }, [follow]);

  /* Squish on press, unless the press started on a button. */
  const squish = isContent ? "scale(1.06,1.1)" : "scale(1.03,1.05)";
  const handleDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest("button")) return;
    if (rootRef.current) rootRef.current.style.transform = squish;
    onPointerDown?.(e);
  };
  const release = () => {
    if (rootRef.current) rootRef.current.style.transform = "scale(1)";
  };

  const rootStyle = {
    width: px,
    height: px,
    borderRadius: "50%",
    overflow: "hidden",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    /* Optical centering: the heavy eyes sit up top and the gradient core is at
     * 42%, so a mathematically centred stack reads high. A small top pad pulls
     * it down to where the eye expects the middle to be. */
    paddingTop: 0,
    boxSizing: "border-box",
    position: "relative",
    background: palette.gradient,
    boxShadow: palette.glow,
    transition: "transform .8s cubic-bezier(.34,1.56,.64,1)",
    "--orb-badge-text": palette.badgeText,
    ...style,
  } as React.CSSProperties;

  return (
    <div
      ref={rootRef}
      className={className}
      role="group"
      style={rootStyle}
      onPointerDown={handleDown}
      onPointerUp={release}
      onPointerLeave={release}
      onPointerCancel={release}
      {...rest}
    >
      <style>{BLINK_KEYFRAMES}</style>
      {/* Shine + grain overlays for standalone orbs. Content mode (the core
        // sphere) paints the bare gradient + shadow exactly like the reference:
        // no extra highlight, no vignette. */}
      {!isContent && (
        <div
          aria-hidden
          style={{
            position: "absolute",
            inset: 0,
            pointerEvents: "none",
            background: "radial-gradient(ellipse at 32% 20%, rgba(255,255,255,.45) 0%, transparent 55%)",
          }}
        />
      )}
      {!isContent && (
        <div
          aria-hidden
          style={{
            position: "absolute",
            inset: 0,
            pointerEvents: "none",
            background: "radial-gradient(circle at 62% 72%, rgba(0,0,0,.2) 0%, transparent 55%)",
          }}
        />
      )}
      <div
        style={{
          position: "relative",
          zIndex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
        }}
      >
        <div ref={outerRef} style={{ marginBottom: eye.marginBottom, height: isContent ? 16 : undefined, display: "flex", alignItems: "center" }}>
          <div ref={innerRef} style={{ display: "flex", gap: eye.gap }}>
            {[0, 60].map((delay, i) => (
              <span
                key={i}
                className="av-eye"
                style={{
                  width: eye.w,
                  height: eye.h,
                  borderRadius: eye.radius,
                  background: palette.eye,
                  animation: blink ? "av-blink 3.6s ease-in-out infinite" : "none",
                  animationDelay: delay ? `${delay}ms` : undefined,
                }}
              />
            ))}
          </div>
        </div>
        {children}
      </div>
    </div>
  );
}
