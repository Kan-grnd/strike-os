"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Users, Search, Plus, Cpu, Wrench, Brain, Target, Eye,
  ChevronRight, X, RotateCcw, AlertCircle,
} from "lucide-react";
import { cn, safeJsonArray } from "@/lib/utils";
import { useAgents, useColonies } from "@/hooks/useApi";
import {
  AGENT_TYPE_COLOR, AGENT_TYPE_OPTIONS, AGENT_STATUS_COLOR, AGENT_STATUS_OPTIONS,
  ATTENTION_STATES, ATTENTION_LABELS, ATTENTION_COLOR,
} from "@/lib/agent-meta";

function Agents() {
  const searchParams = useSearchParams();
  const colonyParam = searchParams.get("colonyId") ?? "";
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [colonyFilter, setColonyFilter] = useState(colonyParam);
  useEffect(() => {
    setColonyFilter(colonyParam);
  }, [colonyParam]);
  const { data, isLoading, error, mutate } = useAgents({
    status: statusFilter,
    type: typeFilter,
    colonyId: colonyFilter,
  });
  const { data: coloniesData } = useColonies();
  const colonies = coloniesData?.colonies || [];
  const colonyName = colonies.find((c: any) => c.id === colonyFilter)?.name;

  const agents = (data?.agents || []).filter(
    (a: any) =>
      !search ||
      a.name.toLowerCase().includes(search.toLowerCase()) ||
      a.description?.toLowerCase().includes(search.toLowerCase())
  );

  const hasFilters = !!(statusFilter || typeFilter || colonyFilter);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Agents</h1>
          <p className="text-sm text-muted-foreground">Your AI workforce members</p>
        </div>
        <Link href="/architect">
          <Button className="gap-2">
            <Plus className="h-4 w-4" />
            New Agent
          </Button>
        </Link>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 basis-full sm:basis-auto sm:max-w-sm sm:min-w-[16rem]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-faint" />
          <Input
            placeholder="Search agents..."
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select
          aria-label="Filter by status"
          className="rounded-md border bg-background px-3 py-2 text-sm"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="">All Status</option>
          {AGENT_STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>{s.charAt(0) + s.slice(1).toLowerCase()}</option>
          ))}
        </select>
        <select
          aria-label="Filter by type"
          className="rounded-md border bg-background px-3 py-2 text-sm"
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
        >
          <option value="">All Types</option>
          {AGENT_TYPE_OPTIONS.map((t) => (
            <option key={t} value={t}>{t.charAt(0) + t.slice(1).toLowerCase()}</option>
          ))}
        </select>
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
            onClick={() => {
              setStatusFilter("");
              setTypeFilter("");
              setColonyFilter("");
            }}
          >
            Clear filters
          </button>
        )}
      </div>

      {error && (
        <Card className="p-8 text-center">
          <AlertCircle className="h-10 w-10 mx-auto text-destructive mb-3" />
          <p className="text-lg font-medium">Couldn't load agents</p>
          <p className="text-sm text-muted-foreground mt-1">Something went wrong fetching your workforce.</p>
          <Button variant="outline" className="mt-4 gap-2" onClick={() => mutate()}>
            <RotateCcw className="h-4 w-4" /> Retry
          </Button>
        </Card>
      )}

      {!error && isLoading && agents.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">Loading agents...</div>
      )}
      {!error && !isLoading && agents.length === 0 && (
        <Card className="p-12 text-center">
          <Users className="h-12 w-12 mx-auto text-faint mb-4" />
          <p className="text-lg font-medium">No agents yet</p>
          <p className="text-sm text-muted-foreground mt-1">
            {hasFilters ? "No agents match the current filters." : "Create your first workforce member"}
          </p>
          {!hasFilters && (
            <Link href="/architect">
              <Button className="mt-4 gap-2"><Plus className="h-4 w-4" /> Create Agent</Button>
            </Link>
          )}
        </Card>
      )}

      <div className="grid gap-4">
        {agents.map((agent: any) => {
          const caps = safeJsonArray(agent.capabilities);
          const toolIds = safeJsonArray(agent.tools);
          const modelIds = safeJsonArray(agent.models);
          const needsAttention = ATTENTION_STATES.has(agent.runtimeState);
          return (
            <Link key={agent.id} href={`/agents/${agent.id}`}>
              <Card className="p-6 hover:border-primary/40 transition-colors cursor-pointer group">
                <div className="flex items-start gap-4">
                  <div className={cn("rounded-lg p-3 shrink-0 border", AGENT_TYPE_COLOR[agent.type] || "border-primary/40")}>
                    {agent.type === "ARCHITECT" ? <Brain className="h-5 w-5" /> :
                     agent.type === "PLANNER" ? <Target className="h-5 w-5" /> :
                     agent.type === "OBSERVER" ? <Eye className="h-5 w-5" /> :
                     <Users className="h-5 w-5" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold text-base">{agent.name}</h3>
                      <Badge className={cn("text-xs", AGENT_STATUS_COLOR[agent.status])}>{agent.status}</Badge>
                      <Badge variant="outline" className="text-xs">{agent.type}</Badge>
                      {needsAttention && (
                        <Badge className={cn("text-xs", ATTENTION_COLOR[agent.runtimeState])}>
                          {ATTENTION_LABELS[agent.runtimeState] ?? agent.runtimeState}
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground mt-1 line-clamp-1">{agent.description}</p>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-3 text-xs text-faint">
                      {caps.length > 0 && (
                        <span className="flex items-center gap-1">
                          <Target className="h-3 w-3" /> {caps.length} capabilities
                        </span>
                      )}
                      {toolIds.length > 0 && (
                        <span className="flex items-center gap-1">
                          <Wrench className="h-3 w-3" /> {toolIds.length} tools
                        </span>
                      )}
                      {modelIds.length > 0 && (
                        <span className="flex items-center gap-1">
                          <Cpu className="h-3 w-3" /> {modelIds.length} models
                        </span>
                      )}
                      {agent.tasksCompleted > 0 && (
                        <span>{agent.tasksCompleted} tasks • {agent.successRate}% success</span>
                      )}
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-faint group-hover:text-foreground transition-colors shrink-0" />
                </div>
              </Card>
            </Link>
          );
        })}
      </div>
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