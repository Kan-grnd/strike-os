"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RefreshCw, Activity, AlertCircle, X, History } from "lucide-react";
import { useOperations } from "@/hooks/useApi";
import { DataTable, type DataTableColumn } from "@/components/execution/data-table";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { PageHeader } from "@/components/shared/page-header";
import { formatCost, formatDuration, formatRelativeTime, pluralize } from "@/lib/utils";
import {
  OPERATION_STATUS_COLOR,
  OPERATION_STATUS_OPTIONS,
  HEALTH_COLOR,
  HEALTH_LABEL,
} from "@/lib/execution-meta";
import { sortRunsByAttention, runDurationMs, runTaskCount } from "@/lib/activity";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

/* Activity → Runs. A run is an operation (M4.4). This is history, not live —
 * the ordering is needs-attention-first (worst health, then most recent) via the
 * pure helper, so a failing run surfaces above a routine completed one. */

const NEEDS_ATTENTION = new Set(["FAILING", "BLOCKED", "DEGRADED"]);

const COLUMNS: DataTableColumn<any>[] = [
  {
    header: "Run",
    width: "110px",
    render: (op) => (
      <Link
        href={`/activity/runs/${op.id}`}
        className="font-mono text-xs text-info hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 rounded-xl"
      >
        {op.id.slice(0, 8)}
      </Link>
    ),
  },
  {
    header: "Mission",
    render: (op) => (
      <div className="min-w-[200px] max-w-[420px]">
        {op.mission ? (
          <Link href={`/missions/${op.mission.id}`} className="truncate text-sm font-medium hover:underline">
            {op.mission.goal}
          </Link>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        )}
        <p className="mt-0.5 text-xs text-muted-foreground">
          {runTaskCount(op)} {pluralize(runTaskCount(op), "task")}
        </p>
      </div>
    ),
  },
  {
    header: "Status",
    width: "120px",
    render: (op) => <Badge className={OPERATION_STATUS_COLOR[op.status] || "bg-muted text-muted-foreground"}>{op.status}</Badge>,
  },
  {
    header: "Health",
    width: "110px",
    render: (op) => {
      const open = !["COMPLETED", "CANCELLED"].includes(op.status);
      if (!op.health || !open) return <span className="text-xs text-muted-foreground">—</span>;
      return (
        <Badge className={HEALTH_COLOR[op.health] || "bg-muted text-muted-foreground"} title="Operational health — independent of the status label">
          {HEALTH_LABEL[op.health] || op.health}
        </Badge>
      );
    },
  },
  {
    header: "Started",
    width: "140px",
    render: (op) => (
      <span className="whitespace-nowrap text-xs text-muted-foreground">
        {op.startedAt ? formatRelativeTime(op.startedAt) : "—"}
      </span>
    ),
  },
  {
    header: "Duration",
    width: "110px",
    align: "right",
    render: (op) => {
      const ms = runDurationMs(op);
      return <span className="text-xs tabular-nums text-muted-foreground">{ms != null ? formatDuration(ms) : "—"}</span>;
    },
  },
  {
    header: "Cost",
    width: "100px",
    align: "right",
    render: (op) => <span className="text-sm tabular-nums">{formatCost(op.cost)}</span>,
  },
];

export default function ActivityRunsPage() {
  const { data, error, isLoading, mutate } = useOperations(undefined, { poll: true });
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");

  const runs = data?.operations || [];
  const term = search.trim().toLowerCase();

  const running = runs.filter((op: any) => op.status === "RUNNING").length;
  const attention = runs.filter((op: any) => NEEDS_ATTENTION.has(String(op.health || "").toUpperCase())).length;
  const cost = runs.reduce((s: number, op: any) => s + (op.cost || 0), 0);

  const rows = useMemo(() => {
    const filtered = runs.filter((op: any) => {
      if (status && op.status !== status) return false;
      if (term && !String(op.mission?.goal || "").toLowerCase().includes(term) && !String(op.id).toLowerCase().includes(term)) return false;
      return true;
    });
    return sortRunsByAttention(filtered);
  }, [runs, status, term]);

  const filtered = Boolean(term || status);

  return (
    <div className="mx-auto max-w-[1400px] space-y-6">
      <PageHeader
        icon={History}
        eyebrow="Activity"
        title="Runs"
        description="Every operation the workforce has executed, newest and worst-health first"
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard icon={Activity} label="Runs" value={runs.length} caption="Operations recorded" />
        <KpiCard icon={Activity} label="Running" value={running} caption="Executing now" />
        <KpiCard icon={AlertCircle} label="Needs attention" value={attention} caption="Blocked, failing or degraded" />
        <KpiCard icon={Activity} label="Total cost" value={Number(cost.toFixed(2))} prefix="$" caption="Across all runs" />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative max-w-sm flex-1 min-w-[200px]">
          <Input
            placeholder="Search runs…"
            aria-label="Search runs"
            className="pr-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button
              type="button"
              aria-label="Clear search"
              onClick={() => setSearch("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <Select value={status || "all"} onValueChange={(v) => setStatus(v === "all" ? "" : v)}>
          <SelectTrigger className="w-[190px]" aria-label="Filter runs by status">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {OPERATION_STATUS_OPTIONS.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {error && (
        <Card className="p-8 text-center space-y-4">
          <p className="text-lg font-medium text-destructive">Failed to load runs</p>
          <p className="text-sm text-muted-foreground">{error.message}</p>
          <Button variant="outline" onClick={() => mutate()} className="gap-2">
            <RefreshCw className="h-4 w-4" /> Retry
          </Button>
        </Card>
      )}

      {!error && isLoading && runs.length === 0 && (
        <div className="space-y-1 py-2 text-sm text-muted-foreground" aria-live="polite">
          <p>Loading runs…</p>
        </div>
      )}

      {!error && !isLoading && runs.length === 0 && (
        <Card className="p-12 text-center space-y-4">
          <History className="mx-auto h-12 w-12 text-muted-foreground" />
          <p className="text-lg font-medium">No runs yet</p>
          <p className="text-sm text-muted-foreground">Runs appear here once a mission executes its first operation.</p>
        </Card>
      )}

      {!error && runs.length > 0 && (
        <>
          <p className="text-sm text-muted-foreground" aria-live="polite">
            {filtered
              ? `${rows.length} of ${runs.length} ${pluralize(runs.length, "run")} match`
              : `${runs.length} ${pluralize(runs.length, "run")}`}
          </p>
          {rows.length > 0 ? (
            <DataTable columns={COLUMNS} rows={rows} rowKey={(op: any) => op.id} minWidth="1040px" caption="Runs, ordered by health" />
          ) : (
            <Card className="p-12 text-center space-y-3">
              <p className="text-lg font-medium">No runs match</p>
              <Button variant="outline" onClick={() => { setSearch(""); setStatus(""); }}>
                Clear filters
              </Button>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
