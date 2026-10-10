"use client";

import { useEffect, useRef } from "react";

/**
 * Resolve a theme token to a canvas-usable color.
 *
 * Tokens like `--primary` are stored as bare HSL channels (e.g. `0 0% 9%`),
 * meant for `hsl(var(--x))` in CSS — assigning the raw value to
 * `ctx.fillStyle` is an invalid color (canvas keeps default black, invisible
 * on dark packs). A probe element + computed style always yields `rgb(...)`,
 * which canvas accepts everywhere. Resolved at draw time so theme switches
 * apply with no remount.
 */
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
  // Try 1: raw value as a full color (hex, oklch, ...).
  probeEl.style.color = SENTINEL;
  probeEl.style.color = raw;
  let resolved = getComputedStyle(probeEl).color;
  if (resolved !== SENTINEL) return resolved;
  // Try 2: bare HSL channels (e.g. `0 0% 9%`) wrapped in hsl().
  probeEl.style.color = SENTINEL;
  probeEl.style.color = `hsl(${raw})`;
  resolved = getComputedStyle(probeEl).color;
  return resolved !== SENTINEL ? resolved : fallback;
}

function getCssVar(name: string, fallback: string) {
  return resolveToken(name, fallback);
}

export function SphereCanvas({ className = "" }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);
  const pointsRef = useRef<Array<{ x: number; y: number; z: number; r: number; alpha: number }>>([]);

  useEffect(() => {
    const canvasEl = canvasRef.current;
    if (!canvasEl) return;
    const ctxEl = canvasEl.getContext("2d");
    if (!ctxEl) return;
    const canvas = canvasEl;
    const ctx = ctxEl;
    const mqReduce = window.matchMedia("(prefers-reduced-motion: reduce)");

    const points: Array<{ x: number; y: number; z: number; r: number; alpha: number }> = [];
    const count = 380;
    const golden = 2.399963229728653;
    for (let i = 0; i < count; i++) {
      const p = i / (count - 1 || 1);
      const v = 1 - p * 2;
      const theta = golden * i;
      const z = v;
      const rxy = Math.sqrt(Math.max(0, 1 - z * z));
      points.push({ x: rxy * Math.cos(theta), y: rxy * Math.sin(theta), z, r: 0, alpha: 0 });
    }
    pointsRef.current = points;

    let angle = 0;
    const tilt = 0.38;
    const dprCap = 2;

    function resize() {
      const rect = canvas.parentElement?.getBoundingClientRect();
      const w = rect?.width ?? canvas.clientWidth;
      const h = rect?.height ?? canvas.clientHeight;
      const dpr = Math.min(window.devicePixelRatio || 1, dprCap);
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      canvas.style.width = w + "px";
      canvas.style.height = h + "px";
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    resize();
    window.addEventListener("resize", resize);

    function draw(staticOnly = false) {
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      ctx.clearRect(0, 0, w, h);
      const cx = w / 2;
      const cy = h / 2;
      const scale = Math.min(w, h) * 0.42;
      const primary = getCssVar("--primary", "orange");
      const fg = getCssVar("--foreground", "white");
      const pts = pointsRef.current;
      for (let i = 0; i < pts.length; i++) {
        const pt = pts[i];
        let x = pt.x * Math.cos(angle) - pt.z * Math.sin(angle);
        let z2 = pt.x * Math.sin(angle) + pt.z * Math.cos(angle);
        let y = pt.y;
        const y2 = y * Math.cos(tilt) - z2 * Math.sin(tilt);
        const z3 = y * Math.sin(tilt) + z2 * Math.cos(tilt);
        const depth = (z3 + 1) / 2;
        const px = cx + x * scale;
        const py = cy + y2 * scale;
        const size = (0.6 + depth * 1.2);
        const alpha = 0.08 + depth * 0.55;
        ctx.beginPath();
        const color = i % 6 === 0 ? fg : primary;
        ctx.fillStyle = color;
        ctx.globalAlpha = alpha;
        ctx.arc(px, py, size, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
      if (!staticOnly) angle += 0.0035;
    }

    if (mqReduce.matches) {
      draw(true);
      return () => {
        window.removeEventListener("resize", resize);
        if (rafRef.current) cancelAnimationFrame(rafRef.current);
      };
    }

    function loop() {
      draw(false);
      rafRef.current = requestAnimationFrame(loop);
    }
    loop();

    return () => {
      window.removeEventListener("resize", resize);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className={className}
      aria-hidden
      role="presentation"
    />
  );
}
