"use client";

import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  Bot,
  Layers,
  Target,
  Activity,
  Rocket,
  TriangleAlert,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";
import type { KPIItem, Tone } from "./adapter";

const ICONS = {
  agents: Bot,
  tasks: Layers,
  success: Target,
  events: Activity,
  missions: Rocket,
} as const;

function ChangeBadge({ tone, text, dir }: { tone: Tone; text: string; dir?: "up" | "down" }) {
  const color =
    tone === "good" ? "text-success" : tone === "bad" ? "text-destructive" : "text-muted-foreground";
  const Icon = dir === "down" ? ArrowDownRight : ArrowUpRight;
  return (
    <div className={cn("inline-flex items-center gap-1 text-[11px] font-medium tabular-nums", color)}>
      <Icon className="size-3.5" aria-hidden />
      {text}
    </div>
  );
}

export function KpiCard({ item }: { item: KPIItem }) {
  const Icon = ICONS[item.id];
  const hasFlag = item.flag;
  const hasChange = !hasFlag && item.change;

  return (
    <Card className="p-5 rounded-2xl border-border bg-card shadow-none transition-shadow duration-300 hover:border-primary/40 hover:shadow-[0_0_28px_-6px_color-mix(in_oklab,var(--primary)_25%,transparent)]">
      <div className="flex items-center justify-between gap-2">
        <div className="flex size-8 items-center justify-center rounded-lg border border-border bg-[color-mix(in_oklab,var(--primary)_12%,transparent)]">
          <Icon className="size-4" aria-hidden />
        </div>
        {hasFlag ? (
          <div className="inline-flex items-center gap-1 rounded-full bg-destructive/15 px-2 py-0.5 text-[11px] font-medium text-destructive">
            <TriangleAlert className="size-3" aria-hidden />
            {item.flag!.text}
          </div>
        ) : hasChange ? (
          <ChangeBadge tone={item.change!.tone} text={item.change!.text} dir={item.change!.dir} />
        ) : null}
      </div>
      <div className="mt-4 text-xs text-muted-foreground">{item.label}</div>
      <div className="mt-1 text-2xl font-semibold tracking-tight tabular-nums">{item.value}</div>
      {item.prev !== undefined ? (
        <div className="mt-1 text-xs text-muted-foreground">
          vs {item.prev}
        </div>
      ) : null}
    </Card>
  );
}
