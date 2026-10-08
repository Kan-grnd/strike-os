"use client";

import { useState } from "react";
import useSWR from "swr";
import { motion } from "motion/react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader, SectionLabel, EASE } from "@/components/shared/page-header";
import { cn } from "@/lib/utils";
import { TrendingUp, Receipt, Activity, CalendarRange } from "lucide-react";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

const RANGES = ["1h", "24h", "7d", "30d"];

function Stat({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="bg-background p-4">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
        <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em]">
          {label}
        </span>
      </div>
      <div className="mt-1 text-2xl font-bold tabular-nums">{value}</div>
    </div>
  );
}

export default function CostsPage() {
  const [range, setRange] = useState("7d");
  const { data } = useSWR(
    `/api/observability/costs?range=${range}&groupBy=model`,
    fetcher
  );

  const dimensions = data?.dimensions || {};
  const totalCost = data?.totalCost || 0;
  const entries = Object.entries(dimensions) as [string, any][];
  const maxCost = Math.max(1, ...entries.map(([, c]) => Number(c) || 0));

  return (
    <div className="space-y-6">
      <PageHeader
        icon={TrendingUp}
        eyebrow="Observability"
        title="Costs"
        description="Cost tracking by mission, agent, model, and provider."
        actions={
          <div className="inline-flex items-center gap-1 rounded-lg border bg-card p-1">
            {RANGES.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRange(r)}
                className={cn(
                  "relative rounded-md px-3 py-1 text-sm font-medium transition-colors",
                  range === r ? "text-foreground" : "text-muted-foreground hover:text-foreground"
                )}
              >
                {range === r && (
                  <motion.span
                    layoutId="costs-range"
                    transition={{ type: "spring", stiffness: 400, damping: 32 }}
                    className="absolute inset-0 rounded-md bg-muted"
                  />
                )}
                <span className="relative z-10">{r}</span>
              </button>
            ))}
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-px overflow-hidden rounded-xl border bg-border sm:grid-cols-3">
        <Stat icon={Receipt} label="Total cost" value={`$${totalCost.toFixed(4)}`} />
        <Stat icon={Activity} label="Trace count" value={data?.traceCount || 0} />
        <Stat icon={CalendarRange} label="Range" value={range} />
      </div>

      <section className="space-y-3">
        <SectionLabel>Cost breakdown · by model</SectionLabel>
        {entries.length === 0 ? (
          <EmptyState
            icon={Receipt}
            title="No cost data in this range"
            description="Costs appear here once traces record token usage for the selected window."
          />
        ) : (
          <Card className="divide-y p-2">
            {entries.map(([key, cost], i) => (
              <motion.div
                key={key}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: Math.min(i * 0.03, 0.3), ease: EASE }}
                className="px-3 py-2.5"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="truncate font-mono text-sm">{key}</span>
                  <Badge variant="outline" className="shrink-0 tabular-nums">
                    ${(cost || 0).toFixed(4)}
                  </Badge>
                </div>
                <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary/70"
                    style={{ width: `${((Number(cost) || 0) / maxCost) * 100}%` }}
                  />
                </div>
              </motion.div>
            ))}
          </Card>
        )}
      </section>
    </div>
  );
}