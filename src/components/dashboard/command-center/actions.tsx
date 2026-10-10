"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Sparkles, CircleCheck, X } from "lucide-react";
import type { ActionItem, Tone } from "./adapter";
import { Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import Link from "next/link";

interface ActionsProps {
  actions: ActionItem[];
}

export function Actions({ actions }: ActionsProps) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState<ActionItem | null>(null);

  const count = actions.length;
  const headerRight = count > 0 ? (
    <span className="text-xs font-medium text-warning">{count} open</span>
  ) : (
    <span className="text-xs font-medium text-success">All clear</span>
  );

  function openSheet(a: ActionItem) {
    setActive(a);
    setOpen(true);
  }

  function handlePrimary() {
    setOpen(false);
  }

  return (
    <section aria-label="Recommended actions" className="relative z-10">
      <header className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Sparkles className="size-5 text-muted-foreground" aria-hidden />
          <h2 className="text-lg font-semibold tracking-tight">Recommended actions</h2>
          <span className="hidden sm:inline text-xs text-muted-foreground">Focus on what needs you</span>
        </div>
        {headerRight}
      </header>
      {count === 0 ? (
        <Alert className="rounded-2xl border-border bg-card shadow-none">
          <CircleCheck className="size-4 text-success" aria-hidden />
          <AlertTitle>All clear</AlertTitle>
          <AlertDescription>
            Nothing is blocked, stuck, waiting on you, or failing. Nothing to do right now.
          </AlertDescription>
        </Alert>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {actions.map((a) => (
            <Card key={a.id} className="flex flex-col gap-4 p-5 rounded-2xl border-border bg-card shadow-none">
              <div className="flex items-start justify-between gap-3">
                <h3 className="text-base leading-snug font-semibold">{a.title}</h3>
                <span
                  className={cn(
                    "shrink-0 rounded-md border border-border px-2 py-0.5 text-[11px] font-medium",
                    a.priority === "High" ? "text-destructive" : "text-muted-foreground"
                  )}
                >
                  {a.priority}
                </span>
              </div>
              <dl className="grid gap-2.5 text-sm">
                <div>
                  <dt className="text-xs text-muted-foreground">Impact</dt>
                  <dd
                    className={cn(
                      "font-semibold",
                      a.impactTone === "bad" ? "text-destructive" : a.impactTone === "good" ? "text-success" : "text-foreground"
                    )}
                  >
                    {a.impact}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-muted-foreground">Reason</dt>
                  <dd className="text-foreground/90">{a.reason}</dd>
                </div>
              </dl>
              <Button variant="secondary" className="mt-auto w-full rounded-lg" onClick={() => openSheet(a)}>
                {a.actionLabel}
              </Button>
            </Card>
          ))}
        </div>
      )}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="bg-popover/90 backdrop-blur-2xl">
          <SheetHeader>
            <SheetTitle>{active?.title}</SheetTitle>
          </SheetHeader>
          <div className="space-y-4 pt-4">
            <div className="text-sm text-muted-foreground">{active?.detail.hint || active?.reason}</div>
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
              {active?.detail.agent ? (
                <>
                  <dt className="text-muted-foreground">Agent</dt>
                  <dd>{active.detail.agent}</dd>
                </>
              ) : null}
              {active?.detail.task ? (
                <>
                  <dt className="text-muted-foreground">Task</dt>
                  <dd>{active.detail.task}</dd>
                </>
              ) : null}
              {active?.detail.mission ? (
                <>
                  <dt className="text-muted-foreground">Mission</dt>
                  <dd>{active.detail.mission}</dd>
                </>
              ) : null}
              {active?.detail.since ? (
                <>
                  <dt className="text-muted-foreground">In this state</dt>
                  <dd>{active.detail.since}</dd>
                </>
              ) : null}
              {active?.detail.lastEvent ? (
                <>
                  <dt className="text-muted-foreground">Last event</dt>
                  <dd>{active.detail.lastEvent}</dd>
                </>
              ) : null}
            </dl>
            {active?.detail.recent && active.detail.recent.length > 0 ? (
              <div>
                <div className="mb-2 text-xs font-medium text-muted-foreground">What happened</div>
                <ul className="space-y-1.5 text-sm">
                  {active.detail.recent.map((r, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="mt-1.5 size-1.5 rounded-full bg-muted-foreground/60" aria-hidden />
                      <span className="text-muted-foreground">{r}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
          <SheetFooter>
            <Button onClick={handlePrimary}>{active?.actionLabel}</Button>
            <Button variant="outline" className="rounded-full" asChild>
              <Link href={active?.traceId ? `/observability/traces/${active.traceId}` : `/work`}>
                Open full trace
              </Link>
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </section>
  );
}
