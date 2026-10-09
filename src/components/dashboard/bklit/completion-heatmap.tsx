"use client";

import { useMemo } from "react";
import {
  HeatmapCells,
  HeatmapChart,
  HeatmapLegend,
  HeatmapTooltip,
  HeatmapXAxis,
  HeatmapYAxis,
} from "@/components/charts/heatmap";
import { Empty, Panel } from "./panel";
import { completionHeatmap } from "./chart-data";

const LEVEL_COLORS = [
  "var(--chart-scale-01)",
  "var(--chart-scale-02)",
  "var(--chart-scale-03)",
  "var(--chart-scale-04)",
  "var(--chart-scale-05)",
] as const;

export function CompletionHeatmap({ tasks }: { tasks: any[] }) {
  const { columns, total } = useMemo(() => completionHeatmap(tasks), [tasks]);

  return (
    <Panel
      title="Completion rhythm"
      hint={`${total} completion${total === 1 ? "" : "s"} · 6 months`}
    >
      {total === 0 ? (
        <Empty>No tasks completed in the last six months</Empty>
      ) : (
        <div className="flex h-full flex-col justify-center">
          <div className="h-[170px] w-full">
            <HeatmapChart
              data={columns}
              levelColors={LEVEL_COLORS}
              gap={3}
              weekStartDay={0}
            >
              <HeatmapCells cornerRadius={2} />
              <HeatmapYAxis tickFilter="odd" labelFormat="initial" />
              <HeatmapXAxis />
              <HeatmapTooltip />
              <HeatmapLegend
                align="end"
                className="hidden sm:flex"
                variant="swatches"
              />
            </HeatmapChart>
          </div>
        </div>
      )}
    </Panel>
  );
}
