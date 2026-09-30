"use client";

import { useState } from "react";
import { useTasks } from "@/hooks/useApi";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ListChecks, RefreshCw } from "lucide-react";
import { TASK_STATUS_COLOR, TASK_STATUS_OPTIONS } from "@/lib/execution-meta";

export default function TasksPage() {
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const { data, error, isLoading, mutate } = useTasks(status ? { status } : undefined);
  const tasks = (data?.tasks || []).filter((t: any) =>
    !search || (t.description || "").toLowerCase().includes(search.toLowerCase())
  );

  const groupTasks = (g: string) => tasks.filter((t: any) => t.status === g);

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Tasks</h1>
        <p className="text-sm text-muted-foreground">Atomic execution units across all missions</p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Input placeholder="Search tasks..." className="max-w-sm" value={search} onChange={(e) => setSearch(e.target.value)} />
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
        <Card className="p-12 text-center">
          <ListChecks className="h-12 w-12 mx-auto text-faint mb-4" />
          <p className="text-lg font-medium">{status || search ? "No tasks match" : "No tasks yet"}</p>
          <p className="text-sm text-muted-foreground mt-1">
            {status || search ? "Try a different filter." : "Tasks appear when missions are launched."}
          </p>
        </Card>
      )}

      {!error && tasks.length > 0 && (
        <div className="overflow-x-auto pb-2">
          <div className="grid grid-cols-7 gap-3 min-w-[1100px]">
            {TASK_STATUS_OPTIONS.map((g) => {
              const group = groupTasks(g);
              return (
                <div key={g}>
                  <h3 className="text-xs font-semibold mb-2 text-muted-foreground flex items-center gap-2">
                    {g} <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-mono">{group.length}</span>
                  </h3>
                  <div className="space-y-2">
                    {group.map((t: any) => (
                      <Link key={t.id} href={`/tasks/${t.id}`}>
                        <Card className="p-3 text-xs hover:border-primary/40 transition-colors cursor-pointer">
                          <Badge variant="outline" className={TASK_STATUS_COLOR[t.status]}>{t.status}</Badge>
                          <p className="font-medium truncate mt-2">{t.description}</p>
                          <div className="text-faint mt-1 space-y-0.5">
                            {t.missionId ? (
                              <Link href={`/missions/${t.missionId}`} className="hover:text-foreground underline-offset-2 hover:underline">
                                Mission {t.missionId.slice(0, 8)}
                              </Link>
                            ) : <p>No mission</p>}
                            {t.ownerAgentId && (
                              <Link href={`/agents/${t.ownerAgentId}`} className="block hover:text-foreground underline-offset-2 hover:underline">
                                Agent {t.ownerAgentId.slice(0, 8)}
                              </Link>
                            )}
                          </div>
                        </Card>
                      </Link>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}