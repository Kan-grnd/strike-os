"use client";

import * as React from "react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/* Shared chrome for the command-center chart panels: one header rhythm, one
 * empty state, one legend — so nine different chart types still read as a set
 * that belongs to the same dashboard. */

export function Panel({
  title,
  hint,
  className,
  bodyClassName,
  children,
}: {
  title: string;
  hint?: React.ReactNode;
  className?: string;
  bodyClassName?: string;
  children: React.ReactNode;
}) {
  return (
    <Card className={cn("flex h-full flex-col p-6", className)}>
      <div className="mb-4 flex items-baseline justify-between gap-2">
        <h3 className="font-mono text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          {title}
        </h3>
        {hint != null && (
          <span className="truncate font-mono text-[11px] text-muted-foreground/70">
            {hint}
          </span>
        )}
      </div>
      <div className={cn("min-h-0 flex-1", bodyClassName)}>{children}</div>
    </Card>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-full min-h-[160px] items-center justify-center">
      <p className="px-4 text-center font-mono text-[11px] text-muted-foreground">
        {children}
      </p>
    </div>
  );
}

export interface LegendItem {
  label: string;
  value: React.ReactNode;
  color: string;
}

export function Legend({
  items,
  columns = "sm:grid-cols-3",
}: {
  items: LegendItem[];
  columns?: string;
}) {
  return (
    <div className={cn("mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5", columns)}>
      {items.map((it) => (
        <div key={it.label} className="flex min-w-0 items-center gap-2">
          <span
            className="h-1.5 w-2.5 shrink-0 rounded-[2px]"
            style={{ backgroundColor: it.color }}
          />
          <span className="truncate font-mono text-[11px] text-muted-foreground">
            {it.label}
          </span>
          <span className="ml-auto font-mono text-[11px] tabular-nums text-foreground">
            {it.value}
          </span>
        </div>
      ))}
    </div>
  );
}
