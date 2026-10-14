"use client";

import * as React from "react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn, formatRelativeTime } from "@/lib/utils";
import { Network, Rocket } from "lucide-react";

export interface ControlHeaderProps {
  isStreaming: boolean;
  lastEventAt: Date | null;
  needsCount: number;
  activeMissions: number;
}

export function ControlHeader({ isStreaming, lastEventAt, needsCount, activeMissions }: ControlHeaderProps) {
  const statusText = isStreaming
    ? lastEventAt
      ? `Live · last event ${formatRelativeTime(lastEventAt)}`
      : "Live"
    : lastEventAt
      ? `Stale · last event ${formatRelativeTime(lastEventAt)}`
      : "No events yet";

  const dot = isStreaming ? "bg-success" : lastEventAt ? "bg-warning" : "bg-muted-foreground";

  return (
    <Card className="relative z-10 overflow-hidden rounded-xl p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
            <span aria-hidden className={cn("size-2 rounded-full", dot, isStreaming && "motion-safe:animate-pulse")} />
            <span>{statusText}</span>
          </div>
          <h1 className="mt-3 text-2xl font-bold tracking-tight md:text-3xl">Control Center</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {needsCount > 0
              ? `${needsCount} item${needsCount === 1 ? "" : "s"} need you`
              : "Your workforce is healthy — nothing needs you"}
            {activeMissions > 0 ? ` · ${activeMissions} active mission${activeMissions === 1 ? "" : "s"}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild className="rounded-full">
            <Link href="/missions/new">
              <Rocket className="mr-2 size-4" aria-hidden />
              Start a mission
            </Link>
          </Button>
          <Button asChild variant="outline" className="rounded-full">
            <Link href="/topology">
              <Network className="mr-2 size-4" aria-hidden />
              Live work flow
            </Link>
          </Button>
        </div>
      </div>
    </Card>
  );
}
