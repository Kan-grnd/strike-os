"use client";

import { useMemo } from "react";
import { useChartStable } from "@/components/charts/chart-context";
import { cn } from "@/lib/utils";

interface YTicksLeftProps {
  count?: number;
}

interface YTicksRightProps {
  count?: number;
}

function clampTicks(v: number, max: number) {
  return Math.max(2, Math.min(max, Math.round(v)));
}

export function YTicksLeft({ count = 4 }: YTicksLeftProps) {
  const ctx = useChartStable() as any;
  const containerRef = ctx?.containerRef;
  const yScale = ctx?.yScale;
  const margin = ctx?.margin || { left: 0 };
  const ticks = useMemo(() => {
    if (!yScale?.domain) return [];
    const domain = yScale.domain();
    const min = domain[0] as number;
    const max = domain[1] as number;
    const c = clampTicks(count, 6);
    if (max <= min) return [];
    const step = (max - min) / (c - 1);
    return Array.from({ length: c }).map((_, i) => {
      const v = Math.round(min + i * step);
      return { v, y: yScale(v) };
    });
  }, [yScale, count]);

  if (!containerRef) return null;
  return (
    <div className="pointer-events-none absolute inset-0" ref={containerRef} aria-hidden>
      {ticks.map(({ v, y }: any) => (
        <div
          key={`ytl-${v}-${y}`}
          className={cn("absolute flex items-center pr-2 text-xs text-muted-foreground tabular-nums")}
          style={{ top: y - 8, left: margin.left - 68, width: 60 }}
        >
          <span className="w-full truncate text-right">{Math.abs(v) >= 1000 ? `${Math.round(v / 1000)}k` : v}</span>
        </div>
      ))}
    </div>
  );
}

export function YTicksRight({ count = 3 }: YTicksRightProps) {
  const ctx = useChartStable() as any;
  const containerRef = ctx?.containerRef;
  const yScales = ctx?.yScales;
  const margin = ctx?.margin || { left: 0, right: 0 };
  const yScaleR = yScales?.["right"] ?? yScales?.right;
  if (!yScaleR || !containerRef) return null;
  const ticks = useMemo(() => {
    const domain = yScaleR.domain();
    const min = domain[0] as number;
    const max = domain[1] as number;
    const c = clampTicks(count, 4);
    if (max <= min) return [];
    const step = (max - min) / (c - 1);
    return Array.from({ length: c }).map((_, i) => {
      const v = Math.round(min + i * step);
      return { v, y: yScaleR(v) };
    });
  }, [yScaleR, count]);

  return (
    <div className="pointer-events-none absolute inset-0" ref={containerRef} aria-hidden>
      {ticks.map(({ v, y }: any) => (
        <div
          key={`ytr-${v}-${y}`}
          className={cn("absolute flex items-center pl-2 text-xs text-muted-foreground tabular-nums")}
          style={{ top: y - 8, left: (margin.left + ((containerRef as any)?.current?.clientWidth ?? 0) - margin.left - margin.right), width: 60 }}
        >
          <span className="w-full truncate text-left">{v}</span>
        </div>
      ))}
    </div>
  );
}
