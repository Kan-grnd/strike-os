"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTasks } from "@/hooks/useApi";
import Link from "next/link";
import { motion } from "motion/react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ListChecks, RefreshCw, X } from "lucide-react";
import { TASK_STATUS_OPTIONS } from "@/lib/execution-meta";
import { runtimeStateMeta, stateDotClass } from "@/lib/runtime-state-meta";
import { cn, formatRelativeTime, pluralize } from "@/lib/utils";
import { PageHeader, EASE } from "@/components/shared/page-header";
import { EmptyState } from "@/components/ui/empty-state";

const KNOWN = new Set<string>(TASK_STATUS_OPTIONS);
const parseStatus = (v: string | null) => (v && KNOWN.has(v) ? v : "");

function TaskCard({ t, index }: { t: any; index: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: Math.min(index * 0.03, 0.3), ease: EASE }}
    >
      <Card className="group space-y-1.5 p-3 text-xs transition-colors hover:border-ring/40">
        <Link
          href={`/tasks/${t.id}`}
          className="block truncate font-medium transition-colors hover:text-foreground/80 hover:underline underline-offset-2"
        >
          {t.description}
        </Link>
        <div className="flex flex-col gap-0.5 text-muted-foreground">
          {t.missionId ? (
            <Link
              href={`/missions/${t.missionId}`}
              className="truncate transition-colors hover:text-foreground hover:underline underline-offset-2"
            >
              {t.mission?.goal || `Mission ${t.missionId.slice(0, 8)}`}
            </Link>
          ) : (
            <span className="text-muted-foreground/70">No mission</span>
          )}
          {t.agentName ? (
            <Link
              href={`/agents/${t.ownerAgentId}`}
              className="truncate transition-colors hover:text-foreground hover:underline underline-offset-2"
            >
              {t.agentName}
            </Link>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2 pt-0.5 font-mono text-[10px] text-muted-foreground">
          {t.createdAt ? <span>{formatRelativeTime(t.createdAt)}</span> : null}
          {t.status === "FAILED" && (
            <span className="text-destructive">
              retry {t.retryCount ?? 0}/{t.maxRetries ?? 3}
            </span>
          )}
          {t.priority > 0 && <span>P{t.priority}</span>}
        </div>
      </Card>
    </motion.div>
  );
}

function TaskLane({ g, tasks }: { g: string; tasks: any[] }) {
  const { tone } = runtimeStateMeta(g);
  return (
    <div className="min-w-0">
      <div className="mb-2 flex items-center gap-2">
        <span className={cn("h-2 w-2 rounded-full", stateDotClass(tone))} />
        <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-foreground/80">
          {g}
        </span>
        <span className="rounded-full bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
          {tasks.length}
        </span>
      </div>
      <div className="space-y-2">
        {tasks.map((t: any, i: number) => (
          <TaskCard key={t.id} t={t} index={i} />
        ))}
      </div>
    </div>
  );
}

function TasksBoard() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState(() => parseStatus(searchParams.get("status")));
  const [search, setSearch] = useState("");
  const { data, error, isLoading, mutate } = useTasks(status ? { status } : undefined);
  const tasks = (data?.tasks || []).filter(
    (t: any) => !search || (t.description || "").toLowerCase().includes(search.toLowerCase())
  );

  useEffect(() => {
    setStatus(parseStatus(searchParams.get("status")));
  }, [searchParams]);

  const setStatusFilter = (v: string) => {
    setStatus(v);
    router.replace(v ? `/tasks?status=${encodeURIComponent(v)}` : "/tasks");
  };

  const filtered = Boolean(status || search);
  const serverCount = data?.tasks?.length ?? 0;
  const groupTasks = (g: string) => tasks.filter((t: any) => t.status === g);
  const columns = TASK_STATUS_OPTIONS.filter((g) => !filtered || groupTasks(g).length > 0);
  const unknownTasks = !status ? tasks.filter((t: any) => !KNOWN.has(t.status)) : [];

  const clearFilters = () => {
    setSearch("");
    setStatusFilter("");
  };

  return (
    <div className="mx-auto max-w-[1400px] space-y-6">
      <PageHeader
        icon={ListChecks}
        eyebrow="Execution"
        title="Tasks"
        description="Atomic execution units across all missions"
      />

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative max-w-sm flex-1">
          <Input
            placeholder="Search tasks…"
            aria-label="Search tasks"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button
              type="button"
              aria-label="Clear search"
              onClick={() => setSearch("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <Select value={status || "all"} onValueChange={(v) => setStatusFilter(v === "all" ? "" : v)}>
          <SelectTrigger className="w-[180px]" aria-label="Filter tasks by status">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {TASK_STATUS_OPTIONS.map((g) => (
              <SelectItem key={g} value={g}>
                {g}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {filtered && (
          <Button
            variant="ghost"
            size="sm"
            onClick={clearFilters}
            className="gap-1 text-muted-foreground hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" /> Clear
          </Button>
        )}
      </div>

      {error && (
        <Card className="space-y-4 p-12 text-center">
          <p className="text-lg font-medium text-destructive">Failed to load tasks</p>
          <p className="text-sm text-muted-foreground">{error.message}</p>
          <Button variant="outline" onClick={() => mutate()} className="gap-2">
            <RefreshCw className="h-4 w-4" /> Retry
          </Button>
        </Card>
      )}

      {isLoading && !error && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <div className="h-4 w-24 animate-pulse rounded bg-muted" />
              <div className="h-20 animate-pulse rounded-lg bg-muted/60" />
              <div className="h-20 animate-pulse rounded-lg bg-muted/40" />
            </div>
          ))}
        </div>
      )}

      {!isLoading && !error && tasks.length === 0 && (
        <EmptyState
          icon={ListChecks}
          title={filtered ? "No tasks match" : "No tasks yet"}
          description={
            filtered
              ? "Try a different filter to see more tasks."
              : "Tasks appear here when missions are launched and planned into work."
          }
          action={
            filtered ? (
              <Button variant="outline" onClick={clearFilters}>
                Clear filters
              </Button>
            ) : undefined
          }
        />
      )}

      {!error && tasks.length > 0 && (
        <>
          <p className="text-sm text-muted-foreground" aria-live="polite">
            {filtered
              ? `${tasks.length} of ${serverCount} ${pluralize(serverCount, "task")} match`
              : `${tasks.length} ${pluralize(tasks.length, "task")}`}
          </p>
          <div className="overflow-x-auto pb-2">
            <div
              className={cn(
                "grid gap-4",
                filtered
                  ? "sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
                  : "grid-cols-7 min-w-[1100px]"
              )}
            >
              {columns.map((g) => (
                <TaskLane key={g} g={g} tasks={groupTasks(g)} />
              ))}
              {unknownTasks.length > 0 && (
                <div className="min-w-0">
                  <div className="mb-2 flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-muted-foreground/40" />
                    <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-foreground/80">
                      {new Set(unknownTasks.map((t: any) => t.status)).size === 1
                        ? unknownTasks[0].status
                        : "OTHER"}
                    </span>
                    <span className="rounded-full bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                      {unknownTasks.length}
                    </span>
                  </div>
                  <div className="space-y-2">
                    {unknownTasks.map((t: any, i: number) => (
                      <TaskCard key={t.id} t={t} index={i} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default function TasksPage() {
  return (
    <Suspense fallback={<div className="min-h-[50vh]" />}>
      <TasksBoard />
    </Suspense>
  );
}