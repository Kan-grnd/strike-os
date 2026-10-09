"use client";

import { useMemo } from "react";
import { Ring } from "@/components/charts/ring";
import { RingCenter } from "@/components/charts/ring-center";
import { RingChart } from "@/components/charts/ring-chart";
import { Empty, Legend, Panel } from "./panel";
import { fleetCapacityRing } from "./chart-data";

export function FleetCapacityRing({
  total,
  active,
}: {
  total: number;
  active: number;
}) {
  const data = useMemo(() => fleetCapacityRing(total, active), [total, active]);
  const pct = total > 0 ? Math.round((active / total) * 100) : 0;

  return (
    <Panel title="Fleet capacity" hint={`${pct}% active`}>
      {total === 0 ? (
        <Empty>No agents in the fleet yet</Empty>
      ) : (
        <div className="flex h-full flex-col">
          <div className="mx-auto w-full max-w-[200px]">
            <RingChart data={data} strokeWidth={13} ringGap={7} baseInnerRadius={52}>
              {data.map((d, i) => (
                <Ring key={i} index={i} color={d.color} />
              ))}
              <RingCenter defaultLabel="in fleet" />
            </RingChart>
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
