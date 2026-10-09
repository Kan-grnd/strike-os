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
 * A faded halo of particles that orbits in the right side of the Command deck
 * hero. Purely decorative: it never intercepts pointer events and is hidden
 * from assistive tech. The swarm stays mounted once hydrated so it can morph
 * without its particle pool resetting.
 */
export function CommandDeckHalo() {
  const { resolvedTheme } = useTheme();
  const prefersReduced = useReducedMotion();
  const [mounted, setMounted] = React.useState(false);
  const [isMobile, setIsMobile] = React.useState(false);

  React.useEffect(() => {
    setIsMobile(window.matchMedia(MOBILE_QUERY).matches);
    setMounted(true);
  }, []);

  const color = isLightTheme(resolvedTheme) ? "#4b5563" : "#e9ebef";

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-y-0 right-0 w-[46%] min-w-[280px] opacity-50"
      style={{
        maskImage: "linear-gradient(to right, transparent, #000 38%)",
        WebkitMaskImage: "linear-gradient(to right, transparent, #000 38%)",
      }}
    >
      {mounted && (
        <DotSwarm
          shape="halo"
          count={isMobile ? 420 : 900}
          color={color}
          speed={0.7}
          dotSize={1.25}
          spread={isMobile ? 0.75 : 0.9}
          choreography="flow"
          interactive={false}
          paused={prefersReduced === true}
          reducedMotion={prefersReduced === true}
          label="Decorative halo particle animation"
          style={{ width: "100%", height: "100%" }}
        />
      )}
    </div>
  );
}
