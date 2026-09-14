"use client";

import { useState } from "react";
import useSWR from "swr";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

const levelColor: Record<string, string> = {
  DEBUG: "bg-muted text-muted-foreground",
  INFO: "bg-success/10 text-success",
  WARN: "bg-warning/10 text-warning",
  ERROR: "bg-destructive/10 text-destructive",
};

export default function LogsPage() {
  const [filter, setFilter] = useState("");
  const [levelFilter, setLevelFilter] = useState("");
  const { data } = useSWR("/api/observability/logs?limit=200", fetcher);

  const logs = (data?.logs || []).filter((l: any) =>
    (!filter || l.message.toLowerCase().includes(filter.toLowerCase())) &&
    (!levelFilter || l.level === levelFilter)
  );

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Logs</h1>
          <p className="text-sm text-muted-foreground">Structured application logs</p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-faint" />
          <input
            placeholder="Search logs..."
            className="pl-9 h-10 rounded-md border bg-background px-2 text-sm"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
        </div>
        <select className="rounded-md border bg-background px-3 py-2 text-sm h-10" value={levelFilter} onChange={(e) => setLevelFilter(e.target.value)}>
          <option value="">All Levels</option>
          <option value="DEBUG">Debug</option>
          <option value="INFO">Info</option>
          <option value="WARN">Warn</option>
          <option value="ERROR">Error</option>
        </select>
      </div>

      <Card className="p-4">
        <div className="space-y-1 max-h-[600px] overflow-auto">
          {logs.map((l: any) => (
            <div key={l.id} className="flex items-center gap-3 text-xs p-2 hover:bg-muted/30 rounded">
              <Badge variant={(levelColor[l.level] as any) || "outline"} className="text-[10px]">{l.level}</Badge>
              <span className="text-faint shrink-0">{new Date(l.createdAt).toLocaleTimeString()}</span>
              <span className="text-faint shrink-0">{l.service}</span>
              <span className="font-mono truncate max-w-[400px]">{l.message}</span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}