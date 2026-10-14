"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, RefreshCw, Target, X, AlertCircle } from "lucide-react";
import { useMissions } from "@/hooks/useApi";
import { DataTable, type DataTableColumn } from "@/components/execution/data-table";
import { MissionProgressBar } from "@/components/execution/mission-progress-bar";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { PageHeader } from "@/components/shared/page-header";
import { formatCost, formatRelativeTime, pluralize } from "@/lib/utils";
import { MISSION_STATUS_COLOR, MISSION_STATUS_OPTIONS, HEALTH_COLOR, HEALTH_LABEL, missionProgress } from "@/lib/execution-meta";
import { sortMissionsByAttention, formatCadence, missionNextRun, missionLastTriggerRun } from "@/lib/missions";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

/* A mission is the persistent unit of work. The list answers the operator's
 * directing question — "which goal needs me, and what is it doing?" — so it is
 * ordered needs-attention-first (worst health, then running, then the rest) via
 * the same pure helper the Control Center ranks with. Cadence and runs read from
 * the mission's own cadence and its linked triggers; neither invents a schedule. */

const NEEDS_ATTENTION = new Set(["FAILING", "BLOCKED", "DEGRADED"]);

const COLUMNS: DataTableColumn<any>[] = [
  {
    header: "Mission",
    render: (m) => (
      <div className="min-w-[220px] max-w-[440px]">
        <Link
          href={`/missions/${m.id}`}
          className="font-medium hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60 rounded-xl"
        >
          {m.goal}
        </Link>
        <p className="mt-1 text-xs text-muted-foreground">
          Priority {m.priority} · {missionProgress(m).pct}% complete
        </p>
        <MissionProgressBar mission={m} className="mt-2 w-32" />
      </div>
    ),
  },
  {
    header: "Health",
    width: "120px",
    render: (m) => {
      const open = !["COMPLETED", "CANCELLED"].includes(m.status);
      if (!m.health || !open) return <span className="text-xs text-muted-foreground">—</span>;
      return (
        <Badge className={HEALTH_COLOR[m.health] || "bg-muted text-muted-foreground"} title="Operational health — independent of the state label">
          {HEALTH_LABEL[m.health] || m.health}
        </Badge>
      );
    },
  },
  {
    header: "Status",
    width: "130px",
    render: (m) => <Badge className={MISSION_STATUS_COLOR[m.status] || "bg-muted text-muted-foreground"}>{m.status}</Badge>,
  },
  {
    header: "Cadence",
    width: "130px",
    render: (m) => {
      const cadence = formatCadence(m.cadence);
      const triggers = (m.automations || []).length;
      return (
        <div className="text-xs">
          <span className={cadence === "Manual" && triggers === 0 ? "text-muted-foreground" : ""}>{cadence}</span>
          {triggers > 0 && <span className="block text-muted-foreground">{triggers} trigger{triggers === 1 ? "" : "s"}</span>}
        </div>
      );
    },
  },
  {
    header: "Last run",
    width: "130px",
    render: (m) => {
      const last = missionLastTriggerRun(m.automations);
      const when = last ?? (m.completedAt ? new Date(m.completedAt) : null) ?? m.updatedAt;
      return <span className="text-xs text-muted-foreground whitespace-nowrap">{when ? formatRelativeTime(when as any) : "—"}</span>;
    },
  },
  {
    header: "Next run",
    width: "130px",
    render: (m) => {
      const next = missionNextRun(m.automations);
      return <span className="text-xs text-muted-foreground whitespace-nowrap">{next ? next.toLocaleString() : "—"}</span>;
    },
  },
  {
    header: "Cost",
    width: "100px",
    align: "right",
    render: (m) => <span className="text-sm tabular-nums">{formatCost(m.totalCost)}</span>,
  },
];

export default function MissionsPage() {
  const { data, error, isLoading, mutate } = useMissions({ poll: true });
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");

  const missions = data?.missions || [];
  const term = search.trim().toLowerCase();

  const running = missions.filter((m: any) => m.status === "RUNNING").length;
  const attention = missions.filter((m: any) => NEEDS_ATTENTION.has(String(m.health || "").toUpperCase())).length;
  const cost = missions.reduce((s: number, m: any) => s + (m.totalCost || 0), 0);

  const rows = useMemo(() => {
    const filtered = missions.filter((m: any) => {
      if (status && m.status !== status) return false;
      if (term && !String(m.goal || "").toLowerCase().includes(term)) return false;
      return true;
    });
    return sortMissionsByAttention(filtered);
  }, [missions, status, term]);

  const filtered = Boolean(term || status);

  return (
    <div className="mx-auto max-w-[1400px] space-y-6">
      <PageHeader
        icon={Target}
        eyebrow="Execution"
        title="Missions"
        description="Persistent goals across the workforce, ordered by what needs you"
        actions={
          <Link href="/missions/new">
            <Button className="gap-2">
              <Plus className="h-4 w-4" /> New Mission
            </Button>
          </Link>
        }
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard icon={Target} label="Missions" value={missions.length} caption="Goals in flight or planned" />
        <KpiCard icon={Target} label="Running" value={running} caption="Executing now" />
        <KpiCard icon={AlertCircle} label="Needs attention" value={attention} caption="Blocked, failing or drifting" />
        <KpiCard icon={Target} label="Tracked cost" value={Number(cost.toFixed(2))} prefix="$" caption="Across all missions" />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative max-w-sm flex-1 min-w-[200px]">
          <Input
            placeholder="Search missions…"
            aria-label="Search missions"
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
          <SelectTrigger className="w-[190px]" aria-label="Filter missions by status">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {MISSION_STATUS_OPTIONS.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {error && (
        <Card className="p-8 text-center space-y-4">
          <p className="text-lg font-medium text-destructive">Failed to load missions</p>
          <p className="text-sm text-muted-foreground">{error.message}</p>
          <Button variant="outline" onClick={() => mutate()} className="gap-2">
            <RefreshCw className="h-4 w-4" /> Retry
          </Button>
        </Card>
      )}

      {!error && isLoading && missions.length === 0 && (
        <div className="space-y-1 py-2 text-sm text-muted-foreground" aria-live="polite">
          <p>Loading missions…</p>
        </div>
      )}

      {!error && !isLoading && missions.length === 0 && (
        <Card className="p-12 text-center space-y-4">
          <Target className="mx-auto h-12 w-12 text-muted-foreground" />
          <p className="text-lg font-medium">No missions yet</p>
          <p className="text-sm text-muted-foreground">Describe a goal and the workforce will plan and run it.</p>
          <Link href="/missions/new">
            <Button className="mt-2 gap-2">
              <Plus className="h-4 w-4" /> Create Mission
            </Button>
          </Link>
        </Card>
      )}

      {!error && missions.length > 0 && (
        <>
          <p className="text-sm text-muted-foreground" aria-live="polite">
            {filtered ? `${rows.length} of ${missions.length} ${pluralize(missions.length, "mission")} match` : `${missions.length} ${pluralize(missions.length, "mission")}`}
          </p>
          {rows.length > 0 ? (
            <DataTable columns={COLUMNS} rows={rows} rowKey={(m: any) => m.id} minWidth="980px" caption="Missions, ordered by what needs attention" />
          ) : (
            <Card className="p-12 text-center space-y-3">
              <p className="text-lg font-medium">No missions match</p>
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
