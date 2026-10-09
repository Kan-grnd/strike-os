"use client";

import { useMemo } from "react";
import { Ring } from "@/components/charts/ring";
import { RingCenter } from "@/components/charts/ring-center";
import { RingChart } from "@/components/charts/ring-chart";
import { Empty, Legend, Panel } from "./panel";
import { missionOutcomeRing } from "./chart-data";

export function MissionOutcomesRing({ missions }: { missions: any[] }) {
  const data = useMemo(() => missionOutcomeRing(missions), [missions]);

  return (
    <Panel title="Mission outcomes" hint={`${missions.length} mission${missions.length === 1 ? "" : "s"}`}>
      {missions.length === 0 ? (
        <Empty>No missions have run yet</Empty>
      ) : (
        <div className="flex h-full flex-col">
          <div className="mx-auto w-full max-w-[200px]">
            <RingChart data={data} strokeWidth={13} ringGap={7} baseInnerRadius={52}>
              {data.map((d, i) => (
                <Ring key={i} index={i} color={d.color} />
              ))}
              <RingCenter defaultLabel="missions" />
            </RingChart>
          </div>
          <Legend
            items={data.map((d) => ({
              label: d.label,
              value: d.value,
              color: d.color ?? "var(--chart-1)",
            }))}
            columns="sm:grid-cols-3"
          />
        </div>
      )}
    </Panel>
  );
}
