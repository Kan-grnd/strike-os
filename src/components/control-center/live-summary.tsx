"use client";

import * as React from "react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { SectionLabel } from "@/components/shared/page-header";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { formatCost } from "@/lib/utils";

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-xl border bg-card/40 p-3">
      <div className="font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </div>
      <div className="mt-1 text-xl font-bold tabular-nums">{value}</div>
    </div>
  );
}

export interface LiveSummaryProps {
  activeAgents: number;
  totalAgents: number;
  runningTasks: number;
  operationsRunning: number;
  eventsRecent: number;
  costActive: number;
  completedMissions: number;
  isLoading?: boolean;
  error?: unknown;
}

export function LiveSummary({
  activeAgents,
  totalAgents,
  runningTasks,
  operationsRunning,
  eventsRecent,
  costActive,
  completedMissions,
  isLoading,
  error,
}: LiveSummaryProps) {
  return (
    <section aria-label="Live now" className="grid gap-3">
      <header className="flex items-center justify-between gap-3">
        <SectionLabel>Live now</SectionLabel>
        <Link href="/topology" className="text-xs text-muted-foreground hover:text-foreground">
          Live work flow
        </Link>
      </header>
      {error ? (
        <Alert variant="destructive" className="rounded-xl">
          <AlertTitle>Could not load live counts</AlertTitle>
          <AlertDescription>The workforce request failed — this is not sample data.</AlertDescription>
        </Alert>
      ) : isLoading ? (
        <Card className="grid grid-cols-2 gap-px overflow-hidden rounded-xl">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="p-3">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="mt-2 h-6 w-10" />
            </div>
          ))}
        </Card>
      ) : (
        <Card className="grid grid-cols-2 gap-3 rounded-xl p-3">
          <Stat label="Agents working" value={`${activeAgents}/${totalAgents}`} />
          <Stat label="Tasks running" value={runningTasks} />
          <Stat label="Operations in flight" value={operationsRunning} />
          <Stat label="Events (5m)" value={eventsRecent} />
          <Stat label="Cost (active)" value={formatCost(costActive)} />
          <Stat label="Completed" value={completedMissions} />
        </Card>
      )}
    </section>
  );
}
