"use client";

import { useMemo } from "react";
import { PieChart } from "@/components/charts/pie-chart";
import { PieCenter } from "@/components/charts/pie-center";
import { PieSlice } from "@/components/charts/pie-slice";
import { Empty, Legend, Panel } from "./panel";
import { fleetComposition } from "./chart-data";

export function FleetCompositionPie({ agents }: { agents: any[] }) {
  const data = useMemo(() => fleetComposition(agents), [agents]);

  return (
    <Panel title="Fleet composition" hint={`${agents.length} agent${agents.length === 1 ? "" : "s"}`}>
      {data.length === 0 ? (
        <Empty>No agents in the fleet yet</Empty>
      ) : (
        <div className="flex h-full flex-col">
          <div className="mx-auto w-full max-w-[200px]">
            <PieChart data={data} innerRadius={54} cornerRadius={4} padAngle={0.02}>
              {data.map((_, i) => (
                <PieSlice key={i} index={i} />
              ))}
              <PieCenter defaultLabel="agents" />
            </PieChart>
          </div>
          <Legend
            items={data.map((d) => ({
              label: d.label,
              value: d.value,
              color: d.color ?? "var(--chart-1)",
            }))}
            columns="sm:grid-cols-2"
          />
        </div>
      )}
    </Panel>
  );
}
