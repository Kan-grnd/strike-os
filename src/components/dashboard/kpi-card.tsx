"use client";

import * as React from "react";
import { motion, useMotionValue, useSpring } from "motion/react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

export function useCountUp(value: number, duration = 0.9) {
  const motionValue = useMotionValue(0);
  const spring = useSpring(motionValue, {
    duration,
    bounce: 0,
  });
  const [display, setDisplay] = React.useState(0);

  React.useEffect(() => {
    motionValue.set(value);
  }, [value, motionValue]);

  React.useEffect(() => {
    const unsub = spring.on("change", (latest) => {
      setDisplay(latest);
    });
    return unsub;
  }, [spring]);

  return display;
}

export interface KpiCardProps {
  label: string;
  value: number;
  suffix?: string;
  prefix?: string;
  caption: string;
  trend?: "up" | "down" | "neutral";
  trendLabel?: string;
  icon: React.ComponentType<{ className?: string }>;
  spark?: number[];
  index?: number;
  accent?: string;
}

export function KpiCard({
  label,
  value,
  suffix,
  prefix,
  caption,
  trend = "neutral",
  trendLabel,
  icon: Icon,
  spark,
  index = 0,
  accent,
}: KpiCardProps) {
  const display = useCountUp(value);
  const rounded = Math.round(display);
  const TrendIcon =
    trend === "up" ? TrendingUp : trend === "down" ? TrendingDown : Minus;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: index * 0.08, ease: [0.16, 1, 0.3, 1] }}
    >
      <Card className="group relative overflow-hidden p-5 transition-colors hover:border-ring/40">
        {accent && (
          <div
            aria-hidden
            className="pointer-events-none absolute -right-8 -top-8 h-28 w-28 rounded-full opacity-40 blur-2xl transition-opacity duration-500 group-hover:opacity-70"
            style={{ background: accent }}
          />
        )}
        <div className="relative flex items-start justify-between">
          <div className="space-y-3">
            <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              {label}
            </p>
            <div className="flex items-baseline gap-1">
              {prefix && (
                <span className="text-lg font-semibold text-muted-foreground">
                  {prefix}
                </span>
              )}
              <span className="font-mono text-3xl font-bold tabular-nums tracking-tight">
                {rounded}
              </span>
              {suffix && (
                <span className="text-lg font-semibold text-muted-foreground">
                  {suffix}
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground">{caption}</p>
          </div>
          <div className="rounded-lg bg-muted/70 p-2.5 transition-colors group-hover:bg-accent">
            <Icon className="h-5 w-5 text-muted-foreground group-hover:text-foreground" />
          </div>
        </div>

        <div className="relative mt-4 flex items-end justify-between gap-3">
          {spark && spark.length > 1 ? (
            <Spark data={spark} className="h-7 flex-1" />
          ) : (
            <span />
          )}
          <div
            className={cn(
              "flex items-center gap-1 font-mono text-[10px] tabular-nums",
              trend === "up" && "text-success",
              trend === "down" && "text-destructive",
              trend === "neutral" && "text-muted-foreground"
            )}
          >
            <TrendIcon className="h-3 w-3" aria-hidden />
            {trendLabel}
          </div>
        </div>
      </Card>
    </motion.div>
  );
}

export function Spark({
  data,
  className,
  stroke = "currentColor",
}: {
  data: number[];
  className?: string;
  stroke?: string;
}) {
  const W = 120;
  const H = 32;
  const peak = Math.max(1, ...data);
  const pts = data
    .map((v, i) => {
      const x = (i / (data.length - 1)) * W;
      const y = H - 3 - (v / peak) * (H - 6);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      className={cn("w-full", className)}
      aria-hidden
    >
      <polyline
        points={pts}
        fill="none"
        stroke={stroke}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}