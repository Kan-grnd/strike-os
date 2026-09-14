"use client";

import useSWR from "swr";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Zap, Plus, Play, Pause, Square, Clock, Calendar, RefreshCw } from "lucide-react";
import { useState } from "react";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

const statusColor: Record<string, string> = {
  DRAFT: "bg-muted text-muted-foreground",
  ACTIVE: "bg-success/10 text-success",
  PAUSED: "bg-info/10 text-info",
  COMPLETED: "bg-success/10 text-success",
  FAILED: "bg-destructive/10 text-destructive",
};

const triggerIcon: Record<string, React.ComponentType<{ className?: string }>> = {
  schedule: Calendar,
  webhook: Zap,
  event: RefreshCw,
  data_change: RefreshCw,
  condition: Clock,
  manual: Play,
};

export default function AutomationsPage() {
  const { data, isLoading } = useSWR("/api/automations", fetcher);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const automations = (data?.automations || []).filter((a: any) =>
    (!search || a.name.toLowerCase().includes(search.toLowerCase()) ||
     a.description?.toLowerCase().includes(search.toLowerCase())) &&
    (!statusFilter || a.status === statusFilter)
  );

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Automations</h1>
          <p className="text-sm text-muted-foreground">Recurring workflows triggered by events, schedules, and conditions</p>
        </div>
        <Button className="gap-2"><Plus className="h-4 w-4" /> New Automation</Button>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-faint" />
          <Input placeholder="Search automations..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <select className="rounded-md border bg-background px-3 py-2 text-sm h-10" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">All Status</option>
          <option value="DRAFT">Draft</option>
          <option value="ACTIVE">Active</option>
          <option value="PAUSED">Paused</option>
          <option value="COMPLETED">Completed</option>
          <option value="FAILED">Failed</option>
        </select>
      </div>

      {isLoading && automations.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">Loading automations...</div>
      )}
      {!isLoading && automations.length === 0 && (
        <Card className="p-12 text-center">
          <Zap className="h-12 w-12 mx-auto text-faint mb-4" />
          <p className="text-lg font-medium">No automations yet</p>
          <p className="text-sm text-muted-foreground mt-1">Describe what you want Strike OS to do repeatedly</p>
          <Button className="mt-4 gap-2"><Plus className="h-4 w-4" /> Create Automation</Button>
        </Card>
      )}

      <div className="grid gap-4">
        {automations.map((a: any) => {
          const trigger = JSON.parse(a.trigger || "{}");
          const actions = JSON.parse(a.actions || "[]") as any[];
          const Icon = triggerIcon[trigger.type] || Clock;
          return (
            <Card key={a.id} className="p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="rounded-md bg-muted p-2 shrink-0"><Icon className="h-5 w-5 text-muted-foreground" /></div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold">{a.name}</h3>
                      <Badge className={statusColor[a.status] || "bg-muted"}>{a.status}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-1">{a.description || "No description"}</p>
                    <div className="flex items-center gap-4 mt-2 text-xs text-faint">
                      <span>Trigger: {trigger.type}</span>
                      <span>Actions: {actions.length}</span>
                      <span>Runs: {a.runCount || 0}</span>
                      <span>Errors: {a.errorCount || 0}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {a.status === "DRAFT" && <Button size="sm" className="gap-1"><Play className="h-3.5 w-3.5" /> Start</Button>}
                  {a.status === "ACTIVE" && <Button size="sm" variant="outline" className="gap-1"><Pause className="h-3.5 w-3.5" /> Pause</Button>}
                  {a.status === "PAUSED" && <Button size="sm" className="gap-1"><Play className="h-3.5 w-3.5" /> Resume</Button>}
                  <Button size="sm" variant="outline" className="gap-1"><RefreshCw className="h-3.5 w-3.5" /> Run Now</Button>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}