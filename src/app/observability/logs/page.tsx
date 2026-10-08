"use client";

import { useState } from "react";
import useSWR from "swr";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { Search, ScrollText, X } from "lucide-react";

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

  const logs = (data?.logs || []).filter(
    (l: any) =>
      (!filter || l.message.toLowerCase().includes(filter.toLowerCase())) &&
      (!levelFilter || l.level === levelFilter)
  );

  return (
    <div className="space-y-6">
      <PageHeader
        icon={ScrollText}
        eyebrow="Observability"
        title="Logs"
        description="Structured application logs."
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" />
          <Input
            placeholder="Search logs…"
            aria-label="Search logs"
            className="pl-9 pr-9"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
          {filter && (
            <button
              type="button"
              onClick={() => setFilter("")}
              aria-label="Clear search"
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <Select
          value={levelFilter || "all"}
          onValueChange={(v) => setLevelFilter(v === "all" ? "" : v)}
        >
          <SelectTrigger className="w-[150px]" aria-label="Filter by level">
            <SelectValue placeholder="Level" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All levels</SelectItem>
            <SelectItem value="DEBUG">Debug</SelectItem>
            <SelectItem value="INFO">Info</SelectItem>
            <SelectItem value="WARN">Warn</SelectItem>
            <SelectItem value="ERROR">Error</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {logs.length ? (
        <Card
          tabIndex={0}
          className="max-h-[640px] overflow-auto p-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <div className="divide-y">
            {logs.map((l: any) => (
              <div
                key={l.id}
                className="flex items-center gap-3 px-2 py-2 text-xs transition-colors hover:bg-muted/40"
              >
                <Badge
                  variant="outline"
                  className={`shrink-0 text-[11px] ${levelColor[l.level] || ""}`}
                >
                  {l.level}
                </Badge>
                <span className="shrink-0 tabular-nums text-muted-foreground">
                  {new Date(l.createdAt).toLocaleTimeString()}
                </span>
                <span className="shrink-0 text-muted-foreground">{l.service}</span>
                <span className="truncate font-mono">{l.message}</span>
              </div>
            ))}
          </div>
        </Card>
      ) : (
        <EmptyState
          icon={ScrollText}
          title="No logs match"
          description="Try a different search term or level."
        />
      )}
    </div>
  );
}