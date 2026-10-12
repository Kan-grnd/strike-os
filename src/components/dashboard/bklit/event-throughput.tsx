"use client";

import * as React from "react";
import { Area } from "@/components/charts/area";
import { AreaChart } from "@/components/charts/area-chart";
import type { ChartStatus } from "@/components/charts/chart-phase";
import { Grid } from "@/components/charts/grid";
import { ChartTooltip } from "@/components/charts/tooltip";
import { XAxis } from "@/components/charts/x-axis";
import { Panel } from "./panel";
import {
  bucketEventsByTime,
  eventTotal,
  rangeLabel,
  SERIES,
  type RangeKey,
} from "./chart-data";

export function EventThroughput({
  events,
  range,
  loading,
}: {
  events: any[];
  range: RangeKey;
  loading?: boolean;
}) {
  const data = React.useMemo(
    () => bucketEventsByTime(events, range),
    [events, range],
  );
  const total = eventTotal(data);
  const status: ChartStatus = loading ? "loading" : "ready";

  return (
    <Panel
      title="Event throughput"
      hint={`${total} event${total === 1 ? "" : "s"} · ${rangeLabel(range)}`}
    >
      <AreaChart
        data={data}
        xDataKey="date"
        status={status}
        loadingLabel="Loading throughput"
        aspectRatio="16 / 6"
        margin={{ top: 16, right: 12, bottom: 4, left: 8 }}
      >
        <Grid fadeHorizontal horizontal vertical={false} numTicksRows={4} />
        <Area
          dataKey="events"
          fill={SERIES.primary}
          stroke={SERIES.primary}
          fillOpacity={0.28}
          dashFromIndex={data.length - 1}
        />
        <XAxis numTicks={range === "24h" ? 6 : 5} />
        <ChartTooltip />
      </AreaChart>
      {!loading && total === 0 && (
        <p className="-mt-2 text-center font-mono text-[11px] text-muted-foreground">
          No events in this window
        </p>
      )}
    </Panel>
  );
}
