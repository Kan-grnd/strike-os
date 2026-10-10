"use client";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Rocket, Network } from "lucide-react";
import Link from "next/link";
import { SphereCanvas } from "./sphere-canvas";

interface HeroProps {
  isStreaming: boolean;
  stale: boolean;
  lastEventAgo?: string;
  activeAgents: number;
  activeMissions: number;
  needsYou: number;
  actionsCount: number;
}

export function Hero({
  isStreaming,
  stale,
  lastEventAgo,
  activeAgents,
  activeMissions,
  needsYou,
  actionsCount,
}: HeroProps) {
  const dotClass = stale
    ? "bg-destructive"
    : actionsCount > 0
    ? "bg-warning"
    : "bg-success";
  const pulse = isStreaming ? "motion-safe:animate-pulse" : "";
  const statusText = lastEventAgo ? `System online · ${lastEventAgo}` : "System online · LIVE";

  return (
    <Card className="relative z-10 overflow-hidden p-6 md:p-8 rounded-2xl border-border bg-card shadow-none">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-y-0 left-0 w-[45%] bg-[linear-gradient(to_right,color-mix(in_oklab,var(--secondary)_55%,transparent)_0%,transparent_100%)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-y-0 right-0 hidden w-[42%] md:block motion-safe:animate-[cc-orb-breathe_7s_ease-in-out_infinite_alternate]"
      >
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_55%_at_62%_50%,color-mix(in_oklab,var(--primary)_30%,transparent),transparent)] blur-2xl" />
      </div>
      <SphereCanvas className="pointer-events-none absolute inset-y-0 right-0 h-full w-[42%] hidden md:block [mask-image:linear-gradient(to_right,transparent,black_45%)]" />
      <div className="relative z-10">
        <div className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
          <span className={cn("size-2 rounded-full", dotClass, pulse)} aria-hidden />
          <span>{statusText}</span>
        </div>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight md:text-4xl">
          Your AI workforce, at a glance
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {activeAgents} agent{activeAgents === 1 ? "" : "s"} active across {activeMissions} running mission
          {activeMissions === 1 ? "" : "s"} ·{" "}
          {needsYou > 0 ? `${needsYou} need you` : "nothing needs you"}
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Button asChild className="rounded-full">
            <Link href="/missions/new">
              <Rocket className="mr-2 size-4" aria-hidden />
              Start a mission
            </Link>
          </Button>
          <Button asChild variant="outline" className="rounded-full">
            <Link href="/topology">
              <Network className="mr-2 size-4" aria-hidden />
              Live topology
            </Link>
          </Button>
        </div>
      </div>
    </Card>
  );
}
