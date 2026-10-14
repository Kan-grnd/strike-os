"use client";

import * as React from "react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { SectionLabel } from "@/components/shared/page-header";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { cn, formatCost, formatRelativeTime } from "@/lib/utils";
import { ChevronRight, CircleDashed } from "lucide-react";
import {
  MISSION_STATUS_COLOR,
  HEALTH_COLOR,
  HEALTH_LABEL,
  missionProgress,
} from "@/lib/execution-meta";

const ACTIVE = (status: string) => status !== "COMPLETED" && status !== "CANCELLED";

export interface MissionHealthProps {
  missions: any[];
  isLoading?: boolean;
  error?: unknown;
}

export function MissionHealth({ missions, isLoading, error }: MissionHealthProps) {
  const active = React.useMemo(() => missions.filter((m) => ACTIVE(m.status)), [missions]);

  return (
    <section aria-label="Mission health" className="grid gap-3">
      <header className="flex items-center justify-between gap-3">
        <SectionLabel>Mission health</SectionLabel>
        <Link href="/missions" className="text-xs text-muted-foreground hover:text-foreground">
          All missions
        </Link>
      </header>

      {error ? (
        <Alert variant="destructive" className="rounded-xl">
          <AlertTitle>Could not load missions</AlertTitle>
          <AlertDescription>Retry, or open the missions list.</AlertDescription>
        </Alert>
      ) : isLoading ? (
        <Card className="divide-y rounded-xl">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex items-center gap-4 p-4">
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-2/5" />
                <Skeleton className="h-3 w-3/5" />
              </div>
              <Skeleton className="h-6 w-16 rounded-full" />
            </div>
          ))}
        </Card>
      ) : active.length === 0 ? (
        <Alert className="glass rounded-xl">
          <CircleDashed className="size-4 text-muted-foreground" aria-hidden />
          <AlertTitle>No active missions</AlertTitle>
          <AlertDescription>
            Nothing is running. <Link href="/missions/new" className="underline underline-offset-2">State your first mission</Link>.
          </AlertDescription>
        </Alert>
      ) : (
        <Card className="divide-y overflow-hidden rounded-xl">
          {active.map((m) => {
            const p = missionProgress(m);
            const showHealth = m.health && m.status !== "COMPLETED" && m.status !== "CANCELLED";
            return (
              <Link
                key={m.id}
                href={`/missions/${m.id}`}
                className="group flex items-center gap-4 p-4 transition-colors hover:bg-accent/40"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="truncate text-sm font-semibold">{m.goal || "Untitled mission"}</span>
                    <Badge className={MISSION_STATUS_COLOR[m.status] || "bg-muted text-muted-foreground"}>
                      {m.status}
                    </Badge>
                    {showHealth && (
                      <Badge
                        className={HEALTH_COLOR[m.health] || "bg-muted text-muted-foreground"}
                        title="Operational health — independent of the state label"
                      >
                        {HEALTH_LABEL[m.health] || m.health}
                      </Badge>
                    )}
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {p.total > 0 ? `${p.completed}/${p.total} tasks` : "no tasks yet"}
                    {p.active > 0 ? ` · ${p.active} in flight` : ""}
                    {m.totalCost ? ` · ${formatCost(m.totalCost)}` : ""}
                    {m.updatedAt ? ` · updated ${formatRelativeTime(m.updatedAt)}` : ""}
                  </p>
                </div>
                <ChevronRight
                  className={cn("size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5")}
                  aria-hidden
                />
              </Link>
            );
          })}
        </Card>
      )}
    </section>
  );
}
