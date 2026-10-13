"use client";

import { useState } from "react";
import useSWR from "swr";
import { motion } from "motion/react";
import { Card } from "@/components/ui/card";
import { PageHeader, SectionLabel, EASE } from "@/components/shared/page-header";
import { cn } from "@/lib/utils";
import { Gauge, Clock, TriangleAlert, CheckCircle2, Activity } from "lucide-react";

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
        <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.16em]">
          {label}
        </span>
      </div>
      <div className="mt-1 text-2xl font-bold tabular-nums">{value}</div>
    </div>
  );
}

export default function ObservabilityPerformancePage() {
  const [range, setRange] = useState("7d");
  const { data } = useSWR(`/api/observability/performance?range=${range}`, fetcher);
  const stats = data || {};

  const byAgent: any[] = stats.byAgent || [];

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Gauge}
        eyebrow="Observability"
        title="Performance"
        description="Agent, model, provider, and tool performance metrics."
        actions={
          <div className="inline-flex items-center gap-1 rounded-xl border bg-card p-1">
            {RANGES.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRange(r)}
                className={cn(
                  "relative rounded-xl px-3 py-1 text-sm font-medium transition-colors",
                  range === r ? "text-foreground" : "text-muted-foreground hover:text-foreground"
                )}
              >
                {range === r && (
                  <motion.span
                    layoutId="performance-range"
                    transition={{ type: "spring", stiffness: 400, damping: 32 }}
                    className="absolute inset-0 rounded-xl bg-muted"
                  />
                )}
                <span className="relative z-10">{r}</span>
              </button>
            ))}
          </div>
        }
      />

      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border bg-border lg:grid-cols-4">
        <Stat icon={Activity} label="Traces" value={stats.totalTraces || 0} />
        <Stat icon={Clock} label="Avg latency" value={`${stats.avgLatencyMs || 0}ms`} />
        <Stat
          icon={TriangleAlert}
          label="Error rate"
          value={stats.errorRate ? `${(stats.errorRate * 100).toFixed(1)}%` : "0%"}
        />
        <Stat icon={CheckCircle2} label="Completed" value={stats.completedTasks || 0} />
      </div>

      <section className="space-y-3">
        <SectionLabel>Performance · by agent</SectionLabel>
        {byAgent.length === 0 ? (
          <Card className="p-8 text-center text-sm text-muted-foreground">
            Per-agent metrics appear here once traces are recorded for the selected window.
          </Card>
        ) : (
          <Card className="divide-y p-2">
            {byAgent.map((agent: any, i: number) => (
              <motion.div
                key={agent.agent}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: Math.min(i * 0.03, 0.3), ease: EASE }}
                className="flex items-center justify-between gap-3 px-3 py-2.5 text-sm"
              >
                <span className="truncate font-mono">{agent.agent}</span>
                <span className="shrink-0 tabular-nums text-muted-foreground">
                  {agent.count} calls · {agent.avgLatencyMs}ms avg · $
                  {agent.totalCost?.toFixed(3)}
                </span>
              </motion.div>
            ))}
          </Card>
        )}
      </section>
    </div>
  );
}