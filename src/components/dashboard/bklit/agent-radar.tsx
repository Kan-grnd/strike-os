"use client";

import { useMemo } from "react";
import { RadarArea } from "@/components/charts/radar-area";
import { RadarAxis } from "@/components/charts/radar-axis";
import { RadarChart } from "@/components/charts/radar-chart";
import { RadarGrid } from "@/components/charts/radar-grid";
import { RadarLabels } from "@/components/charts/radar-labels";
import { Empty, Legend, Panel } from "./panel";
import { agentRadar } from "./chart-data";

export function AgentRadar({
  agents,
  tasks,
  performance,
}: {
  agents: any[];
  tasks: any[];
  performance: { byAgent?: any[] } | undefined;
}) {
  const { eligible, data, metrics } = useMemo(
    () => agentRadar(agents, tasks, performance),
    [agents, tasks, performance],
  );

  return (
    <Panel title="Top agents" hint="volume · reliability · speed · economy">
      {!eligible ? (
        <Empty>
          Needs at least two agents with recorded trace activity
        </Empty>
      ) : (
        <div className="flex h-full flex-col">
          <div className="mx-auto w-full max-w-[240px]">
            <RadarChart data={data} metrics={metrics} levels={4}>
              <RadarGrid />
              <RadarAxis />
              <RadarLabels fontSize={10} />
              {data.map((d, i) => (
                <RadarArea key={i} index={i} color={d.color} />
              ))}
            </RadarChart>
          </div>
          <Legend
            items={data.map((d) => ({
              label: d.label,
              value: `${d.values.reliability ?? 0}%`,
              color: d.color ?? "var(--chart-1)",
            }))}
            columns="sm:grid-cols-2"
          />
        </div>
      )}
    </Panel>
  );
}
