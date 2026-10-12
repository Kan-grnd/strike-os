"use client";

import { Card } from "@/components/ui/card";
import { PieChart, PieSlice, PieCenter } from "@/components/charts";
import type { PieData } from "@/components/charts";
import { cn } from "@/lib/utils";
import type { FleetCounts } from "./adapter";

interface FleetDonutProps {
  fleet: FleetCounts;
}

const FLEET_COLORS: Record<string, string> = {
  executing: "var(--chart-1)",
  planning: "var(--chart-2)",
  waiting: "var(--chart-3)",
  blocked: "hsl(var(--destructive))",
  idle: "var(--chart-4)",
};

const LABELS: Record<string, string> = {
  executing: "Working",
  planning: "Planning",
  waiting: "Waiting",
  blocked: "Blocked",
  idle: "Idle",
};

export function FleetDonut({ fleet }: FleetDonutProps) {
  const items = (["executing", "planning", "waiting", "blocked", "idle"] as const).map((k) => ({
    key: k,
    label: LABELS[k],
    value: fleet[k],
    color: FLEET_COLORS[k],
  }));
  const nonZero = items.filter((i) => i.value > 0);
  const total = items.reduce((s, i) => s + i.value, 0);
  const data: PieData[] = nonZero.map((i) => ({ label: i.label, value: i.value, color: i.color }));

  return (
    <Card className="flex flex-col p-5 xl:col-span-4 rounded-2xl">
      <h2 className="text-lg font-semibold tracking-tight">Agents by state</h2>
      {total === 0 ? (
        <div className="flex flex-1 items-center justify-center text-xs text-muted-foreground">
          No agents yet.
        </div>
      ) : (
        <>
          <div className="flex flex-1 flex-wrap items-center justify-center gap-x-6 gap-y-4 py-4">
            <PieChart data={data} size={156} innerRadius={50} padAngle={0.04} cornerRadius={3}>
              {data.map((d, idx) => (
                <PieSlice key={idx} index={idx} color={d.color} />
              ))}
              <PieCenter defaultLabel="Agents" />
            </PieChart>
            <ul className="min-w-[8rem] flex-1 space-y-2.5 text-sm">
              {items.map((i) => {
                const pct = total === 0 ? 0 : Math.round((i.value / total) * 100);
                const isBlocked = i.key === "blocked" && i.value > 0;
                return (
                  <li key={i.key} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="size-2 rounded-full" style={{ background: i.color }} aria-hidden />
                      <span className={cn(isBlocked ? "font-medium text-destructive" : "text-foreground/90")}>
                        {i.label}
                      </span>
                    </div>
                    <div className="tabular-nums text-muted-foreground">
                      {pct}% · <span className="text-foreground/70">{i.value}</span>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        </>
      )}
    </Card>
  );
}
