"use client";

import * as React from "react";
import { useTheme } from "next-themes";
import { useReducedMotion } from "motion/react";
import { DotSwarm } from "dots-swarm";
import { THEME_PACKS } from "@/lib/theme-packs";

const MOBILE_QUERY = "(max-width: 640px)";

/** Relative luminance of a hex color, used to pick a contrasting halo tint. */
function luminance(hex: string): number {
  const v = hex.replace("#", "");
  const full =
    v.length === 3
      ? v
          .split("")
          .map((c) => c + c)
          .join("")
      : v;
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
 * A faded swarm of particles that reads as a three-orbit atom on the right
 * side of the Command deck hero. Purely decorative: it never intercepts pointer
 * events and is hidden from assistive tech. The swarm stays mounted once
 * hydrated so it can morph without its particle pool resetting.
 */
export function CommandDeckHalo() {
  const { resolvedTheme } = useTheme();
  const prefersReduced = useReducedMotion();
  const [mounted, setMounted] = React.useState(false);
  const [isMobile, setIsMobile] = React.useState(false);
  const [color, setColor] = React.useState("#e9ebef");

  React.useEffect(() => {
    setIsMobile(window.matchMedia(MOBILE_QUERY).matches);
    setMounted(true);
  }, []);

  // Tint the swarm with the active pack's primary token so it follows the
  // theme (Signal orange, accent overrides, monochrome packs). Falls back to a
  // luminance-checked neutral before the token resolves.
  React.useEffect(() => {
    const raw = getComputedStyle(document.documentElement)
      .getPropertyValue("--primary")
      .trim();
    setColor(raw ? `hsl(${raw})` : isLightTheme(resolvedTheme) ? "#4b5563" : "#e9ebef");
  }, [resolvedTheme]);

  return (
    <div
      aria-hidden="true"
      className={
        isMobile
          ? "pointer-events-none absolute -right-12 top-1/2 h-[300px] w-[260px] -translate-y-1/2 opacity-40"
          : "pointer-events-none absolute -right-8 top-1/2 h-[290px] w-[300px] max-w-[60%] -translate-y-1/2 opacity-50"
      }
      style={{
        maskImage: "linear-gradient(to right, transparent, #000 45%)",
        WebkitMaskImage: "linear-gradient(to right, transparent, #000 45%)",
      }}
    >
      {mounted && (
        <DotSwarm
          shape="atom"
          count={isMobile ? 420 : 1200}
          color={color}
          speed={1}
          dotSize={1.25}
          spread={isMobile ? 1.1 : 1.4}
          choreography="flow"
          interactive={false}
          paused={prefersReduced === true}
          reducedMotion={prefersReduced === true}
          label="Decorative atom particle animation"
          style={{ width: "100%", height: "100%" }}
        />
      )}
    </div>
  );
}
