"use client";

import useSWR from "swr";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Zap, Target, ListChecks, Bot, Timer } from "lucide-react";
import { PageHeader, SectionLabel } from "@/components/shared/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { PageSkeleton } from "@/components/shared/page-skeleton";
import { ErrorState } from "@/components/shared/error-state";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

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
    <div className="min-w-0 bg-background p-4">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
        <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.16em]">
          {label}
        </span>
      </div>
      <div className="mt-1 truncate font-mono text-sm font-semibold">{value}</div>
    </div>
  );
}

export default function TraceDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const { data, error, isLoading, mutate } = useSWR(
    `/api/observability/traces/${params.id}`,
    fetcher
  );
  const trace = data?.trace;

  if (isLoading) {
    return <PageSkeleton kpis={0} rows={4} />;
  }

  if (error) {
    return (
      <div className="space-y-6">
        <PageHeader
          backHref="/activity/traces"
          backLabel="Traces"
          icon={Zap}
          eyebrow="Activity"
          title="Trace"
          description="Execution trace across missions, tasks, and agents."
        />
        <ErrorState
          title="Could not load this trace"
          description="The trace request failed. Retrying is safe."
          detail={error.message}
          onRetry={() => mutate()}
          secondary={
            <Button variant="outline" asChild>
              <a href="/activity/traces">Back to traces</a>
            </Button>
          }
        />
      </div>
    );
  }

  if (!trace) {
    return (
      <div className="space-y-6">
        <PageHeader
          backHref="/activity/traces"
          backLabel="Traces"
          icon={Zap}
          eyebrow="Activity"
          title="Trace"
          description="Execution trace across missions, tasks, and agents."
        />
        <EmptyState
          icon={Zap}
          title="Trace not found"
          description={`No trace exists with id ${params.id}.`}
        />
      </div>
    );
  }

  const events = (() => {
    try {
      return JSON.parse(trace.events || "[]") as any[];
    } catch {
      return [];
    }
  })();

  return (
    <div className="space-y-6">
      <PageHeader
        backHref="/activity/traces"
        backLabel="Traces"
        icon={Zap}
        eyebrow="Activity"
        title={
          <span className="flex items-center gap-2">
            Trace <span className="font-mono text-lg">{params.id.slice(0, 12)}</span>
            <Badge variant="outline" className="font-mono">
              {trace.status || "trace"}
            </Badge>
          </span>
        }
        description="Execution trace across missions, tasks, and agents."
      />

      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border bg-border lg:grid-cols-4">
        <Stat
          icon={Target}
          label="Mission"
          value={trace.missionId ? trace.missionId.slice(0, 8) : "—"}
        />
        <Stat
          icon={ListChecks}
          label="Task"
          value={trace.taskId ? trace.taskId.slice(0, 8) : "—"}
        />
        <Stat
          icon={Bot}
          label="Agent"
          value={trace.agentId ? trace.agentId.slice(0, 8) : "—"}
        />
        <Stat
          icon={Timer}
          label="Duration"
          value={trace.duration ? `${trace.duration}ms` : "—"}
        />
      </div>

      <section className="space-y-3">
        <SectionLabel>Events · {events.length}</SectionLabel>
        <Card className="divide-y p-2">
          {events.length ? (
            events.map((e, i) => (
              <div
                key={i}
                className="flex items-center gap-3 px-2 py-2 text-xs"
              >
                <Zap className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <span className="font-mono">{e.type || "event"}</span>
                <span className="ml-auto tabular-nums text-muted-foreground">
                  {new Date(e.timestamp || Date.now()).toLocaleTimeString()}
                </span>
              </div>
            ))
          ) : (
            <p className="px-2 py-6 text-center text-sm text-muted-foreground">
              No events recorded for this trace.
            </p>
          )}
        </Card>
      </section>
    </div>
  );
}