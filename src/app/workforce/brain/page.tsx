"use client";

import useSWR from "swr";
import Link from "next/link";
import { Brain, Radio } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageHeader, SectionLabel } from "@/components/shared/page-header";
import { cn } from "@/lib/utils";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

interface BrainDecision {
  id: string;
  timestamp: string;
  state: string;
  decision: string | null;
  detail: string | null;
  missionId: string | null;
  taskId: string | null;
}

interface BrainResponse {
  state: string;
  detail: string | null;
  missionId: string | null;
  taskId: string | null;
  updatedAt: string;
  decisions: BrainDecision[];
}

const ACTIVITY: Record<
  string,
  { label: string; blurb: string; dot: string; chip: string; ring: string }
> = {
  idle: {
    label: "Idle",
    blurb: "No active orchestration — waiting for work.",
    dot: "bg-muted-foreground",
    chip: "bg-muted text-muted-foreground",
    ring: "border-border",
  },
  planning: {
    label: "Planning",
    blurb: "Decomposing a goal into executable steps.",
    dot: "bg-primary",
    chip: "bg-primary/10 text-primary",
    ring: "border-primary/40",
  },
  delegating: {
    label: "Delegating",
    blurb: "Opening a run and handing tasks to agents.",
    dot: "bg-primary",
    chip: "bg-primary/10 text-primary",
    ring: "border-primary/40",
  },
  supervising: {
    label: "Supervising",
    blurb: "Watching an agent execute a task.",
    dot: "bg-success",
    chip: "bg-success/10 text-success",
    ring: "border-success/40",
  },
  recovering: {
    label: "Recovering",
    blurb: "Retrying or escalating a failed task.",
    dot: "bg-destructive",
    chip: "bg-destructive/10 text-destructive",
    ring: "border-destructive/40",
  },
};

const FALLBACK = ACTIVITY.idle;

function activityOf(state: string) {
  return ACTIVITY[state] ?? FALLBACK;
}

function timeOf(iso: string) {
  try {
    return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  } catch {
    return "";
  }
}

export default function BrainPage() {
  const { data } = useSWR<BrainResponse>("/api/brain", fetcher, {
    refreshInterval: 3000,
    revalidateOnFocus: false,
  });

  const state = data?.state ?? "idle";
  const meta = activityOf(state);
  const decisions = data?.decisions ?? [];

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6">
      <PageHeader
        eyebrow="Workforce"
        title="Brain"
        icon={Brain}
        description="The orchestrator's live activity — what it is planning, delegating, and supervising right now."
      />

      <Card className={cn("border p-6", meta.ring)}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <span className="relative flex h-3 w-3">
                <span
                  className={cn(
                    "absolute inline-flex h-full w-full rounded-full opacity-60",
                    meta.dot,
                    state !== "idle" && "animate-ping"
                  )}
                />
                <span className={cn("relative inline-flex h-3 w-3 rounded-full", meta.dot)} />
              </span>
              <h2 className="text-2xl font-bold tracking-tight">{meta.label}</h2>
            </div>
            <p className="max-w-xl text-sm text-muted-foreground">{meta.blurb}</p>
          </div>
          <Badge className={meta.chip}>{state}</Badge>
        </div>

        <div className="mt-6 space-y-2 border-t pt-4 text-sm">
          {data?.detail ? (
            <p className="font-medium">{data.detail}</p>
          ) : (
            <p className="text-muted-foreground">No active goal.</p>
          )}
          <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-muted-foreground">
            {data?.updatedAt && <span>Updated {timeOf(data.updatedAt)}</span>}
            {data?.missionId && (
              <Link href={`/missions/${data.missionId}`} className="rounded hover:underline hover:text-foreground">
                Mission {data.missionId.slice(0, 8)}
              </Link>
            )}
          </div>
        </div>
      </Card>

      <div className="space-y-3">
        <SectionLabel>Recent decisions</SectionLabel>
        <Card className="divide-y">
          {decisions.length === 0 ? (
            <div className="flex items-center gap-2 p-6 text-sm text-muted-foreground">
              <Radio className="h-4 w-4" />
              No Brain activity recorded yet.
            </div>
          ) : (
            decisions.map((d) => {
              const m = activityOf(d.state);
              return (
                <div key={d.id} className="flex items-start gap-4 p-4">
                  <span className="w-20 shrink-0 font-mono text-xs text-muted-foreground">
                    {timeOf(d.timestamp)}
                  </span>
                  <Badge className={cn("shrink-0", m.chip)}>{d.state}</Badge>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{d.decision ?? m.label}</p>
                    {d.detail && (
                      <p className="truncate text-xs text-muted-foreground">{d.detail}</p>
                    )}
                  </div>
                  {d.missionId && (
                    <Link
                      href={`/missions/${d.missionId}`}
                      className="shrink-0 font-mono text-xs text-muted-foreground hover:text-foreground hover:underline"
                    >
                      {d.missionId.slice(0, 8)}
                    </Link>
                  )}
                </div>
              );
            })
          )}
        </Card>
      </div>
    </div>
  );
}
