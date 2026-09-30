"use client";

import { useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Search, Plus, Zap, Sparkles, ArrowRight, X, AlertCircle, RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useAutomations, createAutomation } from "@/hooks/useApi";
import { safeJson } from "@/lib/utils";
import { AUTOMATION_STATUS_COLOR } from "@/lib/execution-meta";

const triggerIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  schedule: ({ className }) => <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
  webhook: Zap,
  event: ({ className }) => <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>,
  data_change: ({ className }) => <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 3a5 5 0 0 1 5 5 5 5 0 0 1-5 5 5 5 0 0 1-5-5 5 5 0 0 1 5-5z"/><path d="M12 17h10"/><path d="M14.5 2 16 3.5 10 9.5"/></svg>,
  condition: ({ className }) => <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 11a8 8 0 1 0 0 16"/><path d="M14 17a1 1 0 1 0 0 2"/><path d="M14 7a1 1 0 0 0 0 2"/></svg>,
  manual: ({ className }) => <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 20V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16"/><path d="M4 20h16"/></svg>,
};

export default function WorkflowsPage() {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [newWorkflow, setNewWorkflow] = useState("");
  const [planning, setPlanning] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");
  const [simResult, setSimResult] = useState<any>(null);

  const { data, error, isLoading, mutate } = useAutomations();

  const workflows = (data?.automations || []).filter((a: any) =>
    (!search || ((a.name || "").toLowerCase().includes(search.toLowerCase()) ||
     (a.description || "").toLowerCase().includes(search.toLowerCase()))) &&
    (!statusFilter || a.status === statusFilter)
  );

  const simulate = async () => {
    if (!newWorkflow.trim() || planning) return;
    setPlanning(true);
    setCreateError("");
    try {
      const res = await fetch("/api/automations/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ goal: newWorkflow }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Simulation failed: ${res.status}`);
      }
      setSimResult(await res.json());
    } catch (e: any) {
      setCreateError(e?.message || "Simulation failed. Try again.");
    } finally {
      setPlanning(false);
    }
  };

  const create = async () => {
    if (!newWorkflow.trim() || !simResult || creating) return;
    setCreating(true);
    setCreateError("");
    try {
      const data = await createAutomation({
        name: newWorkflow.slice(0, 80),
        description: newWorkflow,
        trigger: simResult.trigger || { type: "manual" },
        conditions: simResult.conditions || {},
        actions: simResult.actions || [],
        status: "DRAFT",
      });
      if (!data.automation) throw new Error(data.error || "Failed to create workflow");
      await mutate();
      router.push(`/workflows/${data.automation.id}`);
    } catch (e: any) {
      setCreateError(e?.message || "Failed to create workflow.");
      setCreating(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Workflows</h1>
          <p className="text-sm text-muted-foreground">Recurring workflows with triggers and steps</p>
        </div>
        <Button className="gap-2" onClick={() => setShowCreate(true)}>
          <Plus className="h-4 w-4" /> New Workflow
        </Button>
      </div>

      {showCreate && (
        <Card className="p-6 space-y-4 border-primary/30">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Create Workflow</h2>
            <Button variant="ghost" size="icon" aria-label="Close create workflow dialog" onClick={() => { setShowCreate(false); setSimResult(null); setCreateError(""); }}>
              <X className="h-4 w-4" />
            </Button>
          </div>
          <Textarea
            placeholder="Describe your workflow... e.g. Every day at 9 AM research competitors and alert me if something changes"
            value={newWorkflow}
            onChange={(e) => { setNewWorkflow(e.target.value); setSimResult(null); setCreateError(""); }}
            className="min-h-[100px]"
          />
          <div className="flex items-center justify-between">
            <Button onClick={simulate} disabled={planning || !newWorkflow.trim()} className="gap-2">
              {planning ? "Planning..." : <><Sparkles className="h-4 w-4" /> Simulate Plan</>}
            </Button>
            <Button onClick={create} disabled={creating || !newWorkflow.trim() || !simResult} className="gap-2">
              <Sparkles className="h-4 w-4" /> {creating ? "Creating..." : "Create Workflow"}
            </Button>
          </div>

          {createError && (
            <p className="flex items-center gap-2 text-sm text-destructive bg-destructive/5 border border-destructive/20 rounded-md px-3 py-2">
              <AlertCircle className="h-4 w-4 shrink-0" /> {createError}
            </p>
          )}

          {simResult && (
            <div className="p-4 rounded-lg bg-success/5 border border-success/20 space-y-3">
              <h4 className="font-semibold text-success flex items-center gap-2">
                <Sparkles className="h-4 w-4" /> Simulation Preview
              </h4>
              <p className="text-sm text-muted-foreground">{simResult.name}</p>
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="rounded-lg p-3 border glass">
                  <p className="text-xs text-muted-foreground">Steps</p>
                  <p className="font-bold text-xl">{simResult.actions?.length || 0}</p>
                </div>
                <div className="rounded-lg p-3 border glass">
                  <p className="text-xs text-muted-foreground">Est. Cost</p>
                  <p className="font-bold text-xl">${(simResult.totalCost || 0).toFixed(3)}</p>
                </div>
                <div className="rounded-lg p-3 border glass">
                  <p className="text-xs text-muted-foreground">Est. Duration</p>
                  <p className="font-bold text-xl">{Math.round((simResult.totalDuration || 0) / 1000)}s</p>
                </div>
              </div>
            </div>
          )}
        </Card>
      )}

      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-faint" />
          <Input placeholder="Search workflows..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          aria-label="Filter workflows by status"
          className="rounded-md border bg-background px-3 py-2 text-sm h-10"
        >
          <option value="">All Status</option>
          <option value="DRAFT">Draft</option>
          <option value="ACTIVE">Active</option>
          <option value="PAUSED">Paused</option>
          <option value="COMPLETED">Completed</option>
          <option value="FAILED">Failed</option>
        </select>
      </div>

      {error && (
        <Card className="p-12 text-center space-y-4">
          <p className="text-lg font-medium text-destructive">Failed to load workflows</p>
          <p className="text-sm text-muted-foreground">{error.message}</p>
          <Button variant="outline" onClick={() => mutate()} className="gap-2">
            <RefreshCw className="h-4 w-4" /> Retry
          </Button>
        </Card>
      )}

      {isLoading && !error && workflows.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">Loading workflows...</div>
      )}

      {!isLoading && !error && workflows.length === 0 && (
        <Card className="p-12 text-center">
          <Zap className="h-12 w-12 mx-auto text-faint mb-4" />
          <p className="text-lg font-medium">{search || statusFilter ? "No workflows match" : "No workflows yet"}</p>
          <p className="text-sm text-muted-foreground mt-1">Create your first workflow</p>
          <Button onClick={() => setShowCreate(true)} className="mt-4 gap-2"><Plus className="h-4 w-4" /> Create Workflow</Button>
        </Card>
      )}

      <div className="grid gap-4">
        {workflows.map((a: any) => {
          const trigger = safeJson<Record<string, unknown>>(a.trigger, {});
          const actions = safeJson<Array<unknown>>(a.actions, []);
          const Icon = triggerIcons[String(trigger.type)];

          return (
            <Link key={a.id} href={`/workflows/${a.id}`}>
              <Card className="p-5 hover:border-primary/40 transition-colors cursor-pointer group">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div className="rounded-md bg-muted p-2 shrink-0">{Icon ? <Icon className="h-5 w-5 text-muted-foreground" /> : <Zap className="h-5 w-5 text-muted-foreground" />}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold">{a.name}</h3>
                        <Badge className={AUTOMATION_STATUS_COLOR[a.status] || "bg-muted"}>{a.status}</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground line-clamp-1">{a.description || "No description"}</p>
                      <div className="flex items-center gap-4 mt-2 text-xs text-faint">
                        <span className="flex items-center gap-1">{Icon ? <Icon className="h-3.5 w-3.5" /> : <Zap className="h-3.5 w-3.5" />} {String(trigger.type || "manual")}</span>
                        <span>Actions: {Array.isArray(actions) ? actions.length : 0}</span>
                        <span>Runs: {a.runCount || 0}</span>
                        <span>Errors: {a.errorCount || 0}</span>
                      </div>
                    </div>
                  </div>
                  <ArrowRight className="h-5 w-5 text-faint group-hover:text-foreground transition-colors shrink-0" />
                </div>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}