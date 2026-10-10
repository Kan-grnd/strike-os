"use client";

import { useEffect, useRef } from "react";

/**
 * Decorative dot-grid sphere for panel backdrops (e.g. the Command Center hero).
 *
 * Adapted from a fullscreen demo component for embedded use:
 * - transparent (no backdrop fill), sized to its own box, DPR-aware;
 * - dot color defaults to the live `--primary` theme token (explicit
 *   `dotColor` prop overrides), re-resolved when the pack switches;
 * - `followMouse` tracks the pointer over the parent panel via its own
 *   listeners (the canvas itself is pointer-events-none); the slow
 *   serpentine drift resumes after 4s idle or on leave;
 * - reduced-motion renders a single static frame.
 */

interface DotSphereProps {
  dotGap?: number;
  /** Absolute sphere radius in px. Defaults to 42% of the box's short side. */
  sphereRadius?: number;
  dotRadiusMax?: number;
  /** Sway rate multiplier (1 = default pace, one full sweep ≈ 60s). */
  speed?: number;
  /** Explicit dot color. Defaults to the live `--primary` token. */
  dotColor?: string;
  dotToken?: string;
  followMouse?: boolean;
  className?: string;
}

/* Resolve a theme token to a canvas-usable color. Tokens are bare HSL
 * channels (e.g. `--primary: 0 0% 9%`), so the raw value is an invalid
 * fillStyle — the probe normalizes through computed style to `rgb(...)`. */
let probeEl: HTMLDivElement | null = null;
const SENTINEL = "rgb(1, 2, 3)";
function resolveToken(name: string, fallback: string) {
  if (typeof window === "undefined") return fallback;
  const raw = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  if (!raw) return fallback;
  if (!probeEl) {
    probeEl = document.createElement("div");
    probeEl.style.position = "absolute";
    probeEl.style.visibility = "hidden";
    probeEl.style.pointerEvents = "none";
    document.body.appendChild(probeEl);
  }
  probeEl.style.color = SENTINEL;
  probeEl.style.color = raw;
  let resolved = getComputedStyle(probeEl).color;
  if (resolved !== SENTINEL) return resolved;
  probeEl.style.color = SENTINEL;
  probeEl.style.color = `hsl(${raw})`;
  resolved = getComputedStyle(probeEl).color;
  return resolved !== SENTINEL ? resolved : fallback;
}

export function DotSphere({
  dotGap = 14,
  sphereRadius,
  dotRadiusMax = 2.5,
  speed = 0.35,
  dotColor,
  dotToken = "--primary",
  followMouse = false,
  className = "",
}: DotSphereProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const propsRef = useRef({ dotGap, sphereRadius, dotRadiusMax, speed, dotColor, dotToken, followMouse });
  propsRef.current = { dotGap, sphereRadius, dotRadiusMax, speed, dotColor, dotToken, followMouse };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const el: HTMLCanvasElement = canvas;
    const ctx = el.getContext("2d");
    if (!ctx) return;
    const g: CanvasRenderingContext2D = ctx;

    const mqReduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    const dprCap = 2;
    let raf = 0;
    let w = 0;
    let h = 0;
    let radius = 200;
    let circleX = 0;
    let circleY = 0;
    let startX = 0;
    let startY = 0;
    let centerX = 0;
    let centerY = 0;
    let hasMouse = false;
    let dot = propsRef.current.dotColor ?? resolveToken(propsRef.current.dotToken, "white");
    // Serpentine phase: incommensurate x/y weave, one full sweep ≈ 60s.
    let phase = Math.random() * Math.PI * 2;
    let lastMove = 0;

    function measure() {
      const p = propsRef.current;
      const rect = el.getBoundingClientRect();
      w = Math.max(1, Math.floor(rect.width));
      h = Math.max(1, Math.floor(rect.height));
      const dpr = Math.min(window.devicePixelRatio || 1, dprCap);
      el.width = Math.floor(w * dpr);
      el.height = Math.floor(h * dpr);
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      radius = p.sphereRadius ?? Math.min(w, h) * 0.42;
      circleX = Math.floor(w / p.dotGap) + 2;
      circleY = Math.floor(h / p.dotGap) + 1;
      startX = Math.round((w - (circleX - 1) * p.dotGap) / 2);
      startY = Math.round((h - (circleY - 1) * p.dotGap) / 2);
      if (!hasMouse) {
        centerX = w / 2;
        centerY = h / 2;
      }
    }

    function drawDots() {
      const p = propsRef.current;
      g.clearRect(0, 0, w, h);
      for (let i = 0; i < circleX; i++) {
        for (let j = 0; j < circleY; j++) {
          const gapX = j % 2 === 0 ? -p.dotGap / 2 : 0;
          const x = startX + gapX + i * p.dotGap;
          const y = startY + j * p.dotGap;
          const dx = x - centerX;
          const dy = y - centerY;
          const distance = Math.sqrt(dx * dx + dy * dy);
          if (distance > radius) continue;
          const alpha = 1 - distance / radius;
          const r = p.dotRadiusMax * alpha;
          if (r <= 0.15) continue;
          g.save();
          g.globalAlpha = alpha;
          g.beginPath();
          g.fillStyle = dot;
          g.arc(x, y, r, 0, 2 * Math.PI, false);
          g.fill();
          g.closePath();
          g.restore();
        }
      }
      g.globalAlpha = 1;
    }

    function sway() {
      const p = propsRef.current;
      phase += 0.0016 * (p.speed / 0.35);
      centerX = w * (0.5 + 0.42 * Math.sin(phase));
      centerY = h * (0.5 + 0.38 * Math.sin(phase * 2 + 1.3));
    }

    function frame() {
      const idle = performance.now() - lastMove;
      if (!hasMouse || idle > 4000) sway();
      drawDots();
      raf = requestAnimationFrame(frame);
    }

    const host = el.parentElement;
    const onMouseMove = (e: MouseEvent) => {
      if (!propsRef.current.followMouse) return;
      const rect = el.getBoundingClientRect();
      centerX = e.clientX - rect.left;
      centerY = e.clientY - rect.top;
      hasMouse = true;
      lastMove = performance.now();
    };
    const onMouseLeave = () => {
      hasMouse = false;
    };

    measure();
    if (mqReduce.matches) {
      drawDots();
    } else {
      raf = requestAnimationFrame(frame);
    }

    host?.addEventListener("mousemove", onMouseMove);
    host?.addEventListener("mouseleave", onMouseLeave);
    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined" && host) {
      ro = new ResizeObserver(() => {
        measure();
        if (mqReduce.matches) drawDots();
      });
      ro.observe(host);
    } else {
      window.addEventListener("resize", measure);
    }
    // Re-resolve the dot color when the theme pack switches.
    const mo = new MutationObserver(() => {
      if (!propsRef.current.dotColor) {
        dot = resolveToken(propsRef.current.dotToken, "white");
        if (mqReduce.matches) drawDots();
      }
    });
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });

    return () => {
      cancelAnimationFrame(raf);
      host?.removeEventListener("mousemove", onMouseMove);
      host?.removeEventListener("mouseleave", onMouseLeave);
      ro?.disconnect();
      window.removeEventListener("resize", measure);
      mo.disconnect();
    };
  }, []);

  return <canvas ref={canvasRef} className={className} aria-hidden role="presentation" />;
}

export default DotSphere;
