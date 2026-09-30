"use client";

import { useState } from "react";
import { useTasks } from "@/hooks/useApi";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ListChecks, RefreshCw, X } from "lucide-react";
import { TASK_STATUS_COLOR, TASK_STATUS_OPTIONS } from "@/lib/execution-meta";
import { cn, formatRelativeTime, pluralize } from "@/lib/utils";

export default function TasksPage() {
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const { data, error, isLoading, mutate } = useTasks(status ? { status } : undefined);
  const tasks = (data?.tasks || []).filter((t: any) =>
    !search || (t.description || "").toLowerCase().includes(search.toLowerCase())
  );

  const filtered = Boolean(status || search);
  const serverCount = data?.tasks?.length ?? 0;
  const groupTasks = (g: string) => tasks.filter((t: any) => t.status === g);
  const columns = TASK_STATUS_OPTIONS.filter((g) => !filtered || groupTasks(g).length > 0);

  const clearFilters = () => {
    setSearch("");
    setStatus("");
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Tasks</h1>
        <p className="text-sm text-muted-foreground">Atomic execution units across all missions</p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Input
          placeholder="Search tasks..."
          aria-label="Search tasks"
          className="max-w-sm"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        {search && (
          <Button variant="ghost" size="sm" onClick={() => setSearch("")} className="gap-1 text-muted-foreground hover:text-foreground">
            <X className="h-3.5 w-3.5" /> Clear
          </Button>
        )}
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          aria-label="Filter tasks by status"
          className="rounded-md border bg-background px-3 py-2 text-sm h-10"
        >
          <option value="">All statuses</option>
          {TASK_STATUS_OPTIONS.map((g) => <option key={g} value={g}>{g}</option>)}
        </select>
      </div>

      {error && (
        <Card className="p-12 text-center space-y-4">
          <p className="text-lg font-medium text-destructive">Failed to load tasks</p>
          <p className="text-sm text-muted-foreground">{error.message}</p>
          <Button variant="outline" onClick={() => mutate()} className="gap-2">
            <RefreshCw className="h-4 w-4" /> Retry
          </Button>
        </Card>
      )}

      {isLoading && !error && (
        <div className="text-center py-12 text-muted-foreground">Loading tasks...</div>
      )}

      {!isLoading && !error && tasks.length === 0 && (
        <Card className="p-12 text-center space-y-4">
          <ListChecks className="h-12 w-12 mx-auto text-faint" />
          <p className="text-lg font-medium">{filtered ? "No tasks match" : "No tasks yet"}</p>
          <p className="text-sm text-muted-foreground">
            {filtered ? "Try a different filter." : "Tasks appear when missions are launched."}
          </p>
          {filtered && (
            <Button variant="outline" onClick={clearFilters}>Clear filters</Button>
          )}
        </Card>
      )}

      {!error && tasks.length > 0 && (
        <>
          <p className="text-sm text-muted-foreground" aria-live="polite">
            {filtered
              ? `${tasks.length} of ${serverCount} ${pluralize(serverCount, "task")} match`
              : `${tasks.length} ${pluralize(tasks.length, "task")}`}
          </p>
          <div className="overflow-x-auto pb-2">
            <div className={cn("grid gap-3 divide-x divide-border/30", filtered ? "sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" : "grid-cols-7 min-w-[1100px]")}>
              {columns.map((g, idx) => {
                const group = groupTasks(g);
                return (
                  <div key={g} className={idx > 0 ? "pl-4" : undefined}>
                    <h3 className="text-xs font-semibold mb-2 flex items-center gap-2">
                      <span className={cn("px-1.5 py-0.5 rounded", TASK_STATUS_COLOR[g])}>{g}</span>
                      <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground">{group.length}</span>
                    </h3>
                    <div className="space-y-2">
                      {group.map((t: any) => (
                        <Card key={t.id} className="p-3 text-xs space-y-1.5">
                          <Link
                            href={`/tasks/${t.id}`}
                            className="block font-medium truncate hover:text-foreground/80 hover:underline underline-offset-2"
                          >
                            {t.description}
                          </Link>
                          <div className="flex flex-col gap-0.5 text-faint">
                            {t.missionId ? (
                              <Link
                                href={`/missions/${t.missionId}`}
                                className="truncate text-muted-foreground hover:text-foreground underline-offset-2 hover:underline"
                              >
                                Mission: {t.mission?.goal || `${t.missionId.slice(0, 8)}`}
                              </Link>
                            ) : (
                              <span className="text-muted-foreground">No mission</span>
                            )}
                            {t.agentName ? (
                              <Link
                                href={`/agents/${t.ownerAgentId}`}
                                className="truncate text-muted-foreground hover:text-foreground underline-offset-2 hover:underline"
                              >
                                Agent: {t.agentName}
                              </Link>
                            ) : null}
                          </div>
                          <div className="text-[10px] text-faint flex flex-wrap items-center gap-2 pt-0.5">
                            {t.createdAt ? <span>{formatRelativeTime(t.createdAt)}</span> : null}
                            {t.status === "FAILED" && <span>Retry {t.retryCount ?? 0}/{t.maxRetries ?? 3}</span>}
                            {t.priority > 0 && <span>Priority {t.priority}</span>}
                          </div>
                        </Card>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}