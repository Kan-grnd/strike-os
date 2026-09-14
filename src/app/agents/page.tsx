"use client";

import { useState } from "react";
import useSWR from "swr";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Users, Search, Plus, Boxes, Cpu, Wrench, Brain, Zap, Target, Eye,
  ChevronRight, Filter,
} from "lucide-react";
import { cn } from "@/lib/utils";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

const statusColor: Record<string, string> = {
  IDLE: "bg-muted text-muted-foreground",
  RUNNING: "bg-success/10 text-success",
  WAITING: "bg-warning/10 text-warning",
  PAUSED: "bg-info/10 text-info",
  ERROR: "bg-destructive/10 text-destructive",
  OFFLINE: "bg-muted text-faint",
};

const typeColor: Record<string, string> = {
  ARCHITECT: "border-info/40 text-info",
  PLANNER: "border-warning/40 text-warning",
  SPECIALIST: "border-success/40 text-success",
  WORKER: "border-primary/40 text-primary",
  OBSERVER: "border-muted-foreground/40 text-muted-foreground",
  EVALUATOR: "border-accent-foreground/40 text-accent-foreground",
  SUB_AGENT: "border-accent/40 text-accent",
  CORE: "border-primary text-primary",
};

export default function AgentsPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [typeFilter, setTypeFilter] = useState<string>("");
  const { data, isLoading } = useSWR(
    `/api/agents${statusFilter ? `?status=${statusFilter}` : ""}${typeFilter ? `?type=${typeFilter}` : ""}`,
    fetcher
  );

  const agents = (data?.agents || []).filter(
    (a: any) =>
      !search ||
      a.name.toLowerCase().includes(search.toLowerCase()) ||
      a.description?.toLowerCase().includes(search.toLowerCase())
  );

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

      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-faint" />
          <Input
            placeholder="Search agents..."
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select
          className="rounded-md border bg-background px-3 py-2 text-sm"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="">All Status</option>
          <option value="IDLE">Idle</option>
          <option value="RUNNING">Running</option>
          <option value="WAITING">Waiting</option>
          <option value="ERROR">Error</option>
        </select>
        <select
          className="rounded-md border bg-background px-3 py-2 text-sm"
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
        >
          <option value="">All Types</option>
          <option value="ARCHITECT">Architect</option>
          <option value="PLANNER">Planner</option>
          <option value="SPECIALIST">Specialist</option>
          <option value="WORKER">Worker</option>
          <option value="OBSERVER">Observer</option>
        </select>
      </div>

      {isLoading && agents.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">Loading agents...</div>
      )}
      {!isLoading && agents.length === 0 && (
        <Card className="p-12 text-center">
          <Users className="h-12 w-12 mx-auto text-faint mb-4" />
          <p className="text-lg font-medium">No agents yet</p>
          <p className="text-sm text-muted-foreground mt-1">Create your first workforce member</p>
          <Link href="/architect">
            <Button className="mt-4 gap-2"><Plus className="h-4 w-4" /> Create Agent</Button>
          </Link>
        </Card>
      )}

      <div className="grid gap-4">
        {agents.map((agent: any) => {
          const caps = JSON.parse(agent.capabilities || "[]") as string[];
          const toolIds = JSON.parse(agent.tools || "[]") as string[];
          const modelIds = JSON.parse(agent.models || "[]") as string[];
          return (
            <Link key={agent.id} href={`/agents/${agent.id}`}>
              <Card className="p-6 hover:border-primary/40 transition-colors cursor-pointer group">
                <div className="flex items-start gap-4">
                  <div className={cn("rounded-lg p-3 shrink-0 border", typeColor[agent.type] || "border-primary/40")}>
                    {agent.type === "ARCHITECT" ? <Brain className="h-5 w-5" /> :
                     agent.type === "PLANNER" ? <Target className="h-5 w-5" /> :
                     agent.type === "OBSERVER" ? <Eye className="h-5 w-5" /> :
                     <Users className="h-5 w-5" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-base">{agent.name}</h3>
                      <Badge className={cn("text-xs", statusColor[agent.status])}>{agent.status}</Badge>
                      <Badge variant="outline" className="text-xs">{agent.type}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1 line-clamp-1">{agent.description}</p>
                    <div className="flex items-center gap-4 mt-3 text-xs text-faint">
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
                  <ChevronRight className="h-4 w-4 text-faint group-hover:text-foreground transition-colors" />
                </div>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
