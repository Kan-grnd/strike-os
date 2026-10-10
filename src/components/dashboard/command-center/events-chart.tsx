"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { AreaChart, Area, Grid, XAxis, ChartTooltip } from "@/components/charts";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type { TrendPoint } from "./adapter";
import type { DateRangeKey } from "@/lib/range";
import { ChartErrorBoundary } from "./chart-error-boundary";
import { YTicksLeft, YTicksRight } from "./y-ticks";

interface EventsChartProps {
  trend: Record<DateRangeKey, TrendPoint[]>;
  totalEvents: number;
  totalProblems: number;
}

export function EventsChart({ trend, totalEvents, totalProblems }: EventsChartProps) {
  const [range, setRange] = useState<DateRangeKey>("7d");
  const data = trend[range].map((p) => ({
    date: p.date,
    events: p.events,
    problems: p.problems,
  }));
  const isEmpty = data.length === 0;

  return (
    <Card className="flex flex-col p-5 xl:col-span-8 rounded-2xl border-border bg-card shadow-none">
      <header className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Events vs Problems</h2>
          <p className="text-xs text-muted-foreground">
            {totalEvents} events · {totalProblems} problems in this period
          </p>
        </div>
        <ToggleGroup type="single" value={range} onValueChange={(v) => v && setRange(v as DateRangeKey)} className="gap-1" aria-label="Time range">
          <ToggleGroupItem value="24h" className="h-7 !rounded-full !border px-3 text-[11px] data-[state=on]:bg-foreground data-[state=on]:text-background">24H</ToggleGroupItem>
          <ToggleGroupItem value="7d" className="h-7 !rounded-full !border px-3 text-[11px] data-[state=on]:bg-foreground data-[state=on]:text-background">7D</ToggleGroupItem>
          <ToggleGroupItem value="30d" className="h-7 !rounded-full !border px-3 text-[11px] data-[state=on]:bg-foreground data-[state=on]:text-background">30D</ToggleGroupItem>
          <ToggleGroupItem value="90d" className="h-7 !rounded-full !border px-3 text-[11px] data-[state=on]:bg-foreground data-[state=on]:text-background">90D</ToggleGroupItem>
        </ToggleGroup>
      </header>
      {isEmpty ? (
        <div className="flex min-h-64 items-center justify-center rounded-md border border-dashed text-xs text-muted-foreground">
          No events in this period
        </div>
      ) : (
        <ChartErrorBoundary>
          <div className="relative h-full min-h-64 w-full flex-1 drop-shadow-[0_0_14px_color-mix(in_oklab,var(--chart-1)_30%,transparent)]">
            <AreaChart data={data} xDataKey="date" className="h-full w-full" margin={{ top: 10, right: 60, bottom: 20, left: 60 }}>
              <Grid horizontal />
              <Area dataKey="events" fill="var(--chart-1)" stroke="var(--chart-1)" fillOpacity={0.35} strokeWidth={2.5} />
              <Area dataKey="problems" yAxisId="right" fillOpacity={0} stroke="hsl(var(--secondary))" strokeWidth={2} />
              <XAxis numTicks={5} />
              <ChartTooltip />
              <YTicksLeft count={4} />
              <YTicksRight count={3} />
            </AreaChart>
          </div>
        </ChartErrorBoundary>
      )}
      <footer className="mt-4 flex items-center justify-center gap-6 text-xs">
        <div className="flex items-center gap-2">
          <span className="size-2 rounded-full bg-primary" aria-hidden />
          <span>Events (left axis)</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="size-2 rounded-full bg-secondary" aria-hidden />
          <span>Problems (right axis)</span>
        </div>
      </footer>
    </Card>
  );
}
