"use client";

import { useMemo } from "react";
import { FunnelChart } from "@/components/charts/funnel-chart";
import { Empty, Panel } from "./panel";
import { SERIES, taskFunnel } from "./chart-data";

export function TaskFunnel({ tasks }: { tasks: any[] }) {
  const { stages, exits, total } = useMemo(() => taskFunnel(tasks), [tasks]);

  const colored = stages.map((s, i) => ({
    ...s,
    color: [SERIES.info, SERIES.primary, SERIES.success][i],
  }));

  return (
    <Panel title="Task pipeline" hint={`${total} task${total === 1 ? "" : "s"} · all time`}>
      {total === 0 ? (
        <Empty>No tasks in the pipeline yet</Empty>
      ) : (
        <div className="flex h-full flex-col">
          <div className="h-[240px] w-full">
            <FunnelChart
              data={colored}
              orientation="horizontal"
              layers={3}
              gap={6}
              showLabels
              showValues
              showPercentage
            />
          </div>
          <p className="mt-3 text-center font-mono text-[11px] text-muted-foreground">
            {exits > 0
              ? `${exits} task${exits === 1 ? "" : "s"} exited (failed or cancelled)`
              : "No failed or cancelled tasks"}
          </p>
        </div>
      )}
    </Panel>
  );
}
