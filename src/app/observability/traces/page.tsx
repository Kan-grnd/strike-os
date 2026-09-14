"use client";

import { useState } from "react";
import useSWR from "swr";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Search, Zap, Activity, Clock } from "lucide-react";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export default function TracesPage() {
  const [filter, setFilter] = useState("");
  const { data, isLoading } = useSWR("/api/observability/traces?limit=50", fetcher);
  const traces = (data?.traces || []).filter((t: any) =>
    !filter || (t.missionId && t.missionId.includes(filter)) || (t.taskId && t.taskId.includes(filter))
  );

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Traces</h1>
          <p className="text-sm text-muted-foreground">Execution traces across missions and tasks</p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-faint" />
          <Input placeholder="Filter by mission/task ID..." className="pl-9" value={filter} onChange={(e) => setFilter(e.target.value)} />
        </div>
      </div>

      {isLoading && (
        <div className="text-center py-12 text-muted-foreground">Loading traces...</div>
      )}
      {!isLoading && (
        <div className="grid gap-4">
          {(data?.traces || []).map((t: any) => (
            <Link key={t.id} href={`/observability/traces/${t.id}`}>
              <Card className="p-4 hover:border-primary/40 transition-colors cursor-pointer">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div className="rounded-md bg-muted p-2 shrink-0">
                      <Zap className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-mono text-sm">Trace {t.id.slice(0, 12)}</p>
                        <Badge variant="outline" className="text-xs">Trace</Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {t.missionId ? `Mission ${t.missionId.slice(0, 8)}` : "—"} | {t.taskId ? `Task ${t.taskId.slice(0, 8)}` : "—"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-faint">
                    <span>{t.duration ? `${t.duration}ms` : "—"}</span>
                    <span>${t.cost ? t.cost.toFixed(4) : "0"}</span>
                    <span>{new Date(t.createdAt).toLocaleString()}</span>
                  </div>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}