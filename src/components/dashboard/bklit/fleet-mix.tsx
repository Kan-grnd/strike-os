"use client";

import { useMemo } from "react";
import { PieChart } from "@/components/charts/pie-chart";
import { PieCenter } from "@/components/charts/pie-center";
import { PieSlice } from "@/components/charts/pie-slice";
import { Ring } from "@/components/charts/ring";
import { RingCenter } from "@/components/charts/ring-center";
import { RingChart } from "@/components/charts/ring-chart";
import { Panel } from "./panel";
import { fleetComposition, missionOutcomeRing } from "./chart-data";

const DONUT_SIZE = 116;

interface MixRow {
  label: string;
  value: number;
  color: string;
}

function MixColumn({
  title,
  chart,
  legend,
}: {
  title: string;
  chart: React.ReactNode;
  legend: MixRow[];
}) {
  return (
    <div className="flex min-w-0 flex-row items-center gap-3 sm:flex-col sm:items-center sm:gap-2">
      <div className="flex h-[116px] w-[116px] shrink-0 items-center justify-center">
        {chart}
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-1 sm:w-full sm:flex-none sm:items-center">
        <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          {title}
        </p>
        <div className="w-full space-y-1 sm:max-w-[220px]">
          {legend.map((row) => (
            <div key={row.label} className="flex min-w-0 items-center gap-2">
              <span
                className="h-1.5 w-2.5 shrink-0 rounded-[2px]"
                style={{ backgroundColor: row.color }}
              />
              <span className="truncate font-mono text-[11px] text-muted-foreground">
                {row.label}
              </span>
              <span className="ml-auto font-mono text-[11px] tabular-nums text-foreground">
                {row.value}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function NoData() {
  return (
    <span className="font-mono text-[11px] text-muted-foreground">No data</span>
  );
}

export function FleetMix({
  agents,
  missions,
}: {
  agents: any[];
  missions: any[];
}) {
  const composition = useMemo(() => fleetComposition(agents), [agents]);
  const outcomes = useMemo(() => missionOutcomeRing(missions), [missions]);

  return (
    <Panel
      title="Fleet mix"
      hint={`${agents.length} agents · ${missions.length} missions`}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <MixColumn
          title="Composition"
          legend={composition.map((d) => ({
            label: d.label,
            value: d.value,
            color: d.color ?? "var(--chart-1)",
          }))}
          chart={
            composition.length === 0 ? (
              <NoData />
            ) : (
              <PieChart
                data={composition}
                size={DONUT_SIZE}
                innerRadius={40}
                cornerRadius={4}
                padAngle={0.02}
              >
                {composition.map((_, i) => (
                  <PieSlice key={i} index={i} />
                ))}
                <PieCenter defaultLabel="agents" />
              </PieChart>
            )
          }
        />

        <MixColumn
          title="Outcomes"
          legend={outcomes.map((d) => ({
            label: d.label,
            value: d.value,
            color: d.color ?? "var(--chart-1)",
          }))}
          chart={
            missions.length === 0 ? (
              <NoData />
            ) : (
              <RingChart
                data={outcomes}
                size={DONUT_SIZE}
                strokeWidth={10}
                ringGap={6}
                baseInnerRadius={30}
              >
                {outcomes.map((d, i) => (
                  <Ring key={i} index={i} color={d.color} />
                ))}
                <RingCenter defaultLabel="missions" />
              </RingChart>
            )
          }
        />
      </div>
    </Panel>
  );
}
