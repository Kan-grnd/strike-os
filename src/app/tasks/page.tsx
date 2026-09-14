"use client";

import { useState } from "react";
import useSWR from "swr";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

const statusColor: Record<string, string> = {
  QUEUED: "bg-muted text-muted-foreground",
  ASSIGNED: "bg-info/10 text-info",
  RUNNING: "bg-success/10 text-success",
  WAITING: "bg-warning/10 text-warning",
  COMPLETED: "bg-success/10 text-success",
  FAILED: "bg-destructive/10 text-destructive",
  CANCELLED: "bg-muted text-faint",
};

export default function TasksPage() {
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const { data, isLoading } = useSWR(status ? `/api/tasks?status=${status}` : "/api/tasks", fetcher);
  const tasks = (data?.tasks || []).filter((t: any) => !search || (t.description || "").toLowerCase().includes(search.toLowerCase()));

  const groups = ["QUEUED", "ASSIGNED", "RUNNING", "WAITING", "COMPLETED", "FAILED", "CANCELLED"];

  const groupTasks = (g: string) => tasks.filter((t: any) => t.status === g);

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Tasks</h1>
        <p className="text-sm text-muted-foreground">Atomic execution units across all missions</p>
      </div>

      <div className="flex items-center gap-3">
        <Input placeholder="Search tasks..." className="max-w-sm" value={search} onChange={(e) => setSearch(e.target.value)} />
        <select value={status} onChange={(e) => setStatus(e.target.value)} className="rounded-md border bg-background px-3 py-2 text-sm h-10">
          <option value="">All</option>
          {groups.map((g) => <option key={g} value={g}>{g}</option>)}
        </select>
      </div>

      <div className="grid grid-cols-7 gap-3">
        {groups.map((g) => (
          <div key={g}>
            <h3 className="text-xs font-semibold mb-2 text-muted-foreground">{g}</h3>
            <div className="space-y-2">
              {groupTasks(g).map((t: any) => (
                <Link key={t.id} href={`/tasks/${t.id}`}>
                  <Card className="p-3 text-xs hover:border-primary/40 transition-colors cursor-pointer">
                    <div className="flex items-center justify-between mb-1">
                      <Badge variant="outline" className={statusColor[t.status]}>{t.status}</Badge>
                    </div>
                    <p className="font-medium truncate">{t.description}</p>
                    <p className="text-faint mt-1">{t.missionId ? `Mission ${t.missionId.slice(0,8)}` : "No mission"}</p>
                  </Card>
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
