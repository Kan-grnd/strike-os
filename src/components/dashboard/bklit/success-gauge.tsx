"use client";

import { Gauge } from "@/components/charts/gauge";
import { Empty, Panel } from "./panel";
import { SERIES } from "./chart-data";

function bandColor(value: number): string {
  if (value >= 80) return SERIES.success;
  if (value >= 50) return SERIES.warning;
  return SERIES.danger;
}

export function SuccessGauge({
  value,
  completed,
  failed,
  loading,
}: {
  value: number | null;
  completed: number;
  failed: number;
  loading?: boolean;
}) {
  return (
    <Panel title="Task success" hint="terminal outcomes · window">
      {loading ? (
        <div className="h-[190px] w-full animate-pulse rounded-md bg-muted/40" />
      ) : value == null ? (
        <div className="flex h-full flex-col items-center justify-center gap-3">
          <Gauge
            value={0}
            centerValue={0}
            suffix="%"
            defaultLabel="no outcomes"
            activeFill="hsl(var(--muted-foreground))"
            inactiveFill="hsl(var(--muted))"
          />
          <p className="text-center font-mono text-[11px] text-muted-foreground">
            No tasks have reached a terminal state yet
          </p>
        </div>
      ) : (
        <div className="flex flex-col items-center">
          <Gauge
            value={value}
            centerValue={value}
            suffix="%"
            defaultLabel="success rate"
            activeFill={
              value >= 80
                ? SERIES.success
                : value >= 50
                  ? SERIES.warning
                  : SERIES.danger
            }
            inactiveFill="hsl(var(--muted))"
          />
          <div className="mt-3 flex w-full items-center justify-center gap-6">
            <div className="flex items-center gap-2">
              <span
                className="h-1.5 w-2.5 rounded-[2px]"
                style={{ backgroundColor: SERIES.success }}
              />
              <span className="font-mono text-[11px] text-muted-foreground">
                {completed} completed
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span
                className="h-1.5 w-2.5 rounded-[2px]"
                style={{ backgroundColor: SERIES.danger }}
              />
              <span className="font-mono text-[11px] text-muted-foreground">
                {failed} failed
              </span>
            </div>
          </div>
        </div>
      )}
    </Panel>
  );
}
