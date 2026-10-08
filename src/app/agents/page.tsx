"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Users,
  Search,
  Plus,
  X,
  RotateCcw,
  AlertCircle,
  Boxes,
  Activity,
  ShieldAlert,
} from "lucide-react";
import { useAgents, useColonies } from "@/hooks/useApi";
import {
  AGENT_TYPE_OPTIONS,
  AGENT_STATUS_OPTIONS,
  ATTENTION_STATES,
} from "@/lib/agent-meta";
import { AgentCard } from "@/components/fleet/agent-card";
import { PageHeader, SectionLabel } from "@/components/shared/page-header";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { EmptyState } from "@/components/ui/empty-state";

function titleCase(value: string) {
  return value.charAt(0) + value.slice(1).toLowerCase();
}

function Agents() {
  const searchParams = useSearchParams();
  const colonyParam = searchParams.get("colonyId") ?? "";
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [colonyFilter, setColonyFilter] = useState(colonyParam);

  useEffect(() => {
    setColonyFilter(colonyParam);
  }, [colonyParam]);

  const { data, isLoading, error, mutate } = useAgents({
    status: statusFilter === "all" ? "" : statusFilter,
    type: typeFilter === "all" ? "" : typeFilter,
    colonyId: colonyFilter,
  });
  const { data: coloniesData } = useColonies();
  const colonies = coloniesData?.colonies || [];
  const colonyName = colonies.find((c: any) => c.id === colonyFilter)?.name;

  const agents = useMemo(
    () =>
      (data?.agents || []).filter(
        (a: any) =>
          !search ||
          a.name?.toLowerCase().includes(search.toLowerCase()) ||
          a.description?.toLowerCase().includes(search.toLowerCase())
      ),
    [data, search]
  );

  const allAgents: any[] = data?.agents || [];
  const running = allAgents.filter((a) => a.status === "RUNNING").length;
  const attention = allAgents.filter((a) =>
    ATTENTION_STATES.has(a.runtimeState)
  ).length;

  const hasFilters =
    search !== "" || statusFilter !== "all" || typeFilter !== "all" || !!colonyFilter;

  const clearFilters = () => {
    setSearch("");
    setStatusFilter("all");
    setTypeFilter("all");
    setColonyFilter("");
  };

  return (
    <div className="mx-auto max-w-[1400px] space-y-6">
      <PageHeader
        eyebrow="Workforce"
        icon={Users}
        title="Agents"
        description="Every member of your AI workforce, with live runtime state."
        actions={
          <Link href="/architect">
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              New Agent
            </Button>
          </Link>
        }
      />

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          index={0}
          icon={Users}
          label="Total agents"
          value={allAgents.length}
          caption={`${colonies.length} colonies`}
          accent="hsl(var(--primary) / 0.4)"
        />
        <KpiCard
          index={1}
          icon={Activity}
          label="Running"
          value={running}
          caption={`${allAgents.length - running} not running`}
          accent="hsl(var(--success) / 0.4)"
        />
        <KpiCard
          index={2}
          icon={ShieldAlert}
          label="Needs attention"
          value={attention}
          caption={attention > 0 ? "Blocked, failed or awaiting approval" : "All clear"}
          accent="hsl(var(--warning) / 0.4)"
        />
        <KpiCard
          index={3}
          icon={Boxes}
          label="Colonies"
          value={colonies.length}
          caption="Logical groupings"
        />
      </section>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 basis-full sm:basis-auto sm:max-w-sm sm:min-w-[16rem]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search agents..."
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[150px]" aria-label="Filter by status">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All status</SelectItem>
            {AGENT_STATUS_OPTIONS.map((s) => (
              <SelectItem key={s} value={s}>
                {titleCase(s)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[150px]" aria-label="Filter by type">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            {AGENT_TYPE_OPTIONS.map((t) => (
              <SelectItem key={t} value={t}>
                {titleCase(t)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {colonyFilter && (
          <Badge variant="secondary" className="gap-1.5 px-2.5 py-1">
            Colony: {colonyName || colonyFilter}
            <button
              aria-label="Clear colony filter"
              className="ml-0.5 rounded-full hover:bg-foreground/10"
              onClick={() => setColonyFilter("")}
            >
              <X className="h-3 w-3" />
            </button>
          </Badge>
        )}
        {hasFilters && (
          <button
            className="text-xs text-muted-foreground underline-offset-2 hover:underline"
            onClick={clearFilters}
          >
            Clear filters
          </button>
        )}
      </div>

      {error && (
        <Card className="p-8 text-center">
          <AlertCircle className="mx-auto mb-3 h-10 w-10 text-destructive" />
          <p className="text-lg font-medium">Couldn't load agents</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Something went wrong fetching your workforce.
          </p>
          <Button variant="outline" className="mt-4 gap-2" onClick={() => mutate()}>
            <RotateCcw className="h-4 w-4" /> Retry
          </Button>
        </Card>
      )}

      {!error && isLoading && agents.length === 0 && (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="h-44 animate-pulse bg-muted/40" />
          ))}
        </div>
      )}

      {!error && !isLoading && agents.length === 0 && (
        <EmptyState
          icon={Users}
          title={hasFilters ? "No agents match" : "No agents yet"}
          description={
            hasFilters
              ? "No agents match the current filters. Try widening them."
              : "Create your first workforce member to get started."
          }
          cta={hasFilters ? undefined : "Create Agent"}
          ctaHref={hasFilters ? undefined : "/architect"}
          className="py-16"
        />
      )}

      {!error && agents.length > 0 && (
        <>
          <SectionLabel>
            {agents.length} agent{agents.length === 1 ? "" : "s"}
          </SectionLabel>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {agents.map((agent: any, i: number) => (
              <AgentCard key={agent.id} agent={agent} index={i} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export default function AgentsPage() {
  return (
    <Suspense fallback={<div className="min-h-[50vh]" />}>
      <Agents />
    </Suspense>
  );
}