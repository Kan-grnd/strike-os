"use client";

import * as React from "react";
import { Bar } from "@/components/charts/bar";
import { BarChart } from "@/components/charts/bar-chart";
import { BarXAxis } from "@/components/charts/bar-x-axis";
import { BarYAxis } from "@/components/charts/bar-y-axis";
import type { ChartStatus } from "@/components/charts/chart-phase";
import { Grid } from "@/components/charts/grid";
import { ChartTooltip } from "@/components/charts/tooltip";
import { Empty, Legend, Panel } from "./panel";
import {
  outcomeTotals,
  rangeLabel,
  SERIES,
  taskOutcomeSeries,
  type RangeKey,
} from "./chart-data";

const hourFmt = new Intl.DateTimeFormat("en-US", {
  hour: "numeric",
  hour12: false,
});
const dayFmt = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
});

function labelFor(d: Date, range: RangeKey): string {
  return range === "24h" ? `${hourFmt.format(d)}:00` : dayFmt.format(d);
}

export function TaskOutputBar({
  tasks,
  range,
  loading,
}: {
  tasks: any[];
  range: RangeKey;
  loading?: boolean;
}) {
  const series = React.useMemo(
    () => taskOutcomeSeries(tasks, range),
    [tasks, range],
  );
  const data = React.useMemo(
    () =>
      series.map((p) => ({
        label: labelFor(p.date, range),
        completed: p.completed,
        failed: p.failed,
      })),
    [series, range],
  );
  const { completed, failed } = outcomeTotals(series);
  const status: ChartStatus = loading ? "loading" : "ready";
  const empty = !loading && completed + failed === 0;

  return (
    <Panel
      title="Task output"
      hint={`${completed} done · ${failed} failed · ${rangeLabel(range)}`}
    >
      {empty ? (
        <Empty>No tasks completed or failed in this window</Empty>
      ) : (
        <>
          <BarChart
            data={data}
            xDataKey="label"
            stacked
            status={status}
            aspectRatio="16 / 6"
            margin={{ top: 16, right: 12, bottom: 28, left: 8 }}
          >
            <Grid horizontal vertical={false} numTicksRows={4} />
            <Bar dataKey="completed" fill={SERIES.success} />
            <Bar dataKey="failed" fill={SERIES.danger} />
            <BarXAxis maxLabels={range === "30d" ? 8 : 12} />
            <BarYAxis />
            <ChartTooltip />
          </BarChart>
          <Legend
            items={[
              { label: "Completed", value: completed, color: SERIES.success },
              { label: "Failed", value: failed, color: SERIES.danger },
            ]}
            columns="sm:grid-cols-2"
          />
        </>
      )}
    </Panel>
  );
}
