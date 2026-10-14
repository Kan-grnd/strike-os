"use client";

import * as React from "react";
import Link from "next/link";
import { useSWRConfig } from "swr";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { SectionLabel } from "@/components/shared/page-header";
import { cn } from "@/lib/utils";
import { ArrowRight, Check, CircleCheck, Loader2, X } from "lucide-react";
import type { AttentionItem } from "@/lib/attention";

/** Short "how long" label for the queue ("12m", "3h", "2d"). */
function waitLabel(ms: number): string {
  const s = Math.floor(ms / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

const SEVERITY_DOT: Record<number, string> = {
  0: "bg-destructive",
  1: "bg-warning",
  2: "bg-info",
};

const SEVERITY_BADGE: Record<number, string> = {
  0: "bg-destructive/10 text-destructive",
  1: "bg-warning/10 text-warning",
  2: "bg-info/10 text-info",
};

function SeverityMark({ item }: { item: AttentionItem }) {
  return (
    <span
      aria-hidden
      className={cn("mt-1.5 size-2 shrink-0 rounded-full", SEVERITY_DOT[item.severity] || "bg-muted-foreground")}
    />
  );
}

export interface AttentionQueueProps {
  items: AttentionItem[];
  isLoading?: boolean;
  error?: unknown;
  /** Revalidate after a resolution so the queue and missions refresh together. */
  onResolved?: () => void;
}

export function AttentionQueue({ items, isLoading, error, onResolved }: AttentionQueueProps) {
  const { mutate } = useSWRConfig();
  const [busy, setBusy] = React.useState<string | null>(null);
  const [rowError, setRowError] = React.useState<string | null>(null);

  const count = items.length;

  async function resolve(item: AttentionItem, decision: "APPROVE" | "DENY") {
    if (!item.approvalId) return;
    setBusy(item.approvalId);
    setRowError(null);
    try {
      const res = await fetch(`/api/approvals/${item.approvalId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision }),
      });
      if (!res.ok) throw new Error(`Request failed: ${res.status}`);
      await Promise.all([mutate("/api/approvals"), mutate("/api/missions")]);
      onResolved?.();
    } catch (e) {
      setRowError(e instanceof Error ? e.message : "Could not resolve the gate");
    } finally {
      setBusy(null);
    }
  }

  const headerRight =
    count > 0 ? (
      <span className="text-xs font-medium text-warning">{count} open</span>
    ) : (
      <span className="text-xs font-medium text-success">All clear</span>
    );

  return (
    <section aria-label="Needs you" className="grid gap-3">
      <header className="flex items-center justify-between gap-3">
        <SectionLabel>Needs you</SectionLabel>
        {headerRight}
      </header>

      {error ? (
        <Alert className="glass rounded-xl" variant="destructive">
          <AlertTitle>Could not load what needs you</AlertTitle>
          <AlertDescription>
            The approvals and missions requests failed. This is not sample data — retry, or open
            the mission directly.
          </AlertDescription>
        </Alert>
      ) : isLoading ? (
        <Card className="divide-y rounded-xl">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex items-center gap-4 p-4">
              <Skeleton className="size-2 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-1/3" />
                <Skeleton className="h-3 w-2/3" />
              </div>
              <Skeleton className="h-8 w-24 rounded-full" />
            </div>
          ))}
        </Card>
      ) : count === 0 ? (
        <Alert className="glass rounded-xl">
          <CircleCheck className="size-4 text-success" aria-hidden />
          <AlertTitle>All clear</AlertTitle>
          <AlertDescription>
            Nothing is blocked, stuck, or waiting on you right now.
          </AlertDescription>
        </Alert>
      ) : (
        <Card className="divide-y overflow-hidden rounded-xl">
          {items.map((item) => (
            <div
              key={item.id}
              className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:gap-4"
              data-attention-id={item.id}
            >
              <SeverityMark item={item} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="truncate text-sm font-semibold">{item.title}</h3>
                  <Badge className={SEVERITY_BADGE[item.severity] || "bg-muted text-muted-foreground"}>
                    {item.severityLabel}
                  </Badge>
                </div>
                <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">{item.detail}</p>
                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  {item.missionId && (
                    <Link
                      href={`/missions/${item.missionId}`}
                      className="inline-flex items-center gap-1 hover:text-foreground"
                    >
                      Open mission
                      <ArrowRight className="size-3" aria-hidden />
                    </Link>
                  )}
                  <span>Waiting {waitLabel(item.ageMs)}</span>
                  {item.trigger && <span className="font-mono text-[10px] uppercase tracking-wider">{item.trigger}</span>}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {item.kind === "approval" ? (
                  <>
                    <Button
                      size="sm"
                      className="rounded-full"
                      disabled={busy === item.approvalId}
                      onClick={() => resolve(item, "APPROVE")}
                    >
                      {busy === item.approvalId ? (
                        <Loader2 className="size-4 animate-spin" aria-hidden />
                      ) : (
                        <Check className="size-4" aria-hidden />
                      )}
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="rounded-full"
                      disabled={busy === item.approvalId}
                      onClick={() => resolve(item, "DENY")}
                    >
                      <X className="size-4" aria-hidden />
                      Deny
                    </Button>
                  </>
                ) : (
                  <Button size="sm" variant="secondary" className="rounded-full" asChild>
                    <Link href={item.href}>{item.actionLabel}</Link>
                  </Button>
                )}
              </div>
            </div>
          ))}
          {rowError && (
            <p role="alert" className="px-4 pb-3 text-xs text-destructive">
              {rowError}
            </p>
          )}
        </Card>
      )}
    </section>
  );
}
