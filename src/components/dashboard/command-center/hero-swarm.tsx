"use client";

import * as React from "react";
import { useTheme } from "next-themes";
import { useReducedMotion } from "motion/react";
import { DotSwarm } from "dots-swarm";
import { THEME_PACKS } from "@/lib/theme-packs";

/** Relative luminance of a hex color, used to pick a contrasting swarm tint. */
function luminance(hex: string): number {
  const v = hex.replace("#", "");
  const full = v.length === 3 ? v.split("").map((c) => c + c).join("") : v;
  const n = parseInt(full, 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
}

/** True when the active pack paints a light background. */
function isLightTheme(theme: string | undefined): boolean {
  if (theme === "light") return true;
  if (theme === "dark") return false;
  const pack = THEME_PACKS.find((p) => p.id === theme);
  // Unknown/unhydrated themes fall back to the default pack, which is dark.
  return pack ? luminance(pack.bg) > 0.5 : false;
}

/**
 * Five floating planes of particles (layer-stack) for the Command Center
 * hero backdrop. Purely decorative: positioning, pointer-events and
 * assistive-tech hiding come from the parent wrapper. Mounted-gated (no
 * SSR canvas) so the particle pool never resets; tint follows the active
 * pack's primary token.
 */
export function HeroSwarm() {
  const { resolvedTheme } = useTheme();
  const prefersReduced = useReducedMotion();
  const [mounted, setMounted] = React.useState(false);
  const [color, setColor] = React.useState("#e9ebef");

  React.useEffect(() => {
    setMounted(true);
  }, []);

  // Tint the swarm with the active pack's primary token so it follows the
  // theme. Falls back to a luminance-checked neutral before resolving.
  React.useEffect(() => {
    const raw = getComputedStyle(document.documentElement).getPropertyValue("--primary").trim();
    setColor(raw ? `hsl(${raw})` : isLightTheme(resolvedTheme) ? "#4b5563" : "#e9ebef");
  }, [resolvedTheme]);

  if (!mounted) return null;
  return (
    <DotSwarm
      shape="layer-stack"
      count={900}
      color={color}
      spread={1.15}
      interactive={false}
      paused={prefersReduced === true}
      reducedMotion={prefersReduced === true}
      label="Layer stack particle animation"
      style={{ width: "100%", height: "100%" }}
    />
  );
}

export default HeroSwarm;
