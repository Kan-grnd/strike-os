"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Search, ArrowRight, RefreshCw, Sparkles, X, AlertCircle, Zap, Briefcase } from "lucide-react";
import { useMissions, useAutomations, createAutomation } from "@/hooks/useApi";
import { formatCost, formatDuration, pluralize, safeJson, cn } from "@/lib/utils";
import {
  MISSION_STATUS_COLOR,
  MISSION_STATUS_OPTIONS,
  AUTOMATION_STATUS_COLOR,
  AUTOMATION_STATUS_OPTIONS,
  missionProgress,
} from "@/lib/execution-meta";

const triggerIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  schedule: ({ className }) => <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
  webhook: Zap,
  event: ({ className }) => <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>,
  data_change: ({ className }) => <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 3a5 5 0 0 1 5 5 5 5 0 0 1-5 5 5 5 0 0 1-5-5 5 5 0 0 1 5-5z"/><path d="M12 17h10"/><path d="M14.5 2 16 3.5 10 9.5"/></svg>,
  condition: ({ className }) => <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 11a8 8 0 1 0 0 16"/><path d="M14 17a1 1 0 1 0 0 2"/><path d="M14 7a1 1 0 0 0 0 2"/></svg>,
  manual: ({ className }) => <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 20V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16"/><path d="M4 20h16"/></svg>,
};

type Facet = "all" | "missions" | "workflows";

const KNOWN_MISSION = new Set<string>(MISSION_STATUS_OPTIONS);
const KNOWN_AUTOMATION = new Set<string>(AUTOMATION_STATUS_OPTIONS);

const parseFacet = (v: string | null): Facet =>
  v === "missions" || v === "workflows" ? v : "all";

const statusValidFor = (facet: Facet, status: string) => {
  if (!status) return true;
  if (facet === "missions") return KNOWN_MISSION.has(status);
  if (facet === "workflows") return KNOWN_AUTOMATION.has(status);
  return KNOWN_MISSION.has(status) || KNOWN_AUTOMATION.has(status);
};

const parseStatus = (facet: Facet, v: string | null) =>
  v && statusValidFor(facet, v) ? v : "";

/** Segment widths clamped to the track that remains, so rounded percentages can
 *  never overflow the progress bar (the old bar summed past 100%). */
function ClampedProgress({ pct, failedPct, cancelledPct }: { pct: number; failedPct: number; cancelledPct: number }) {
  let used = 0;
  const seg = (w: number) => {
    const c = Math.min(Math.max(w, 0), 100 - used);
    used += c;
    return c;
  };
  const widths = [seg(pct), seg(failedPct), seg(cancelledPct)];
  const visible = widths.map((w) => w > 0).filter(Boolean).length;
  return (
    <div className="h-2 w-full rounded-full bg-muted overflow-hidden flex" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(used)} aria-label="Mission progress">
      {widths[0] > 0 && <div className="h-full rounded-l-full bg-primary" style={{ width: `${widths[0]}%` }} />}
      {widths[1] > 0 && <div className="h-full bg-destructive" style={{ width: `${widths[1]}%` }} />}
      {widths[2] > 0 && <div className={cn("h-full bg-muted-foreground/40", visible === 1 && "rounded-r-full")} style={{ width: `${widths[2]}%` }} />}
    </div>
  );
}

const timeOf = (v?: string) => {
  if (!v) return -Infinity;
  const n = new Date(v).getTime();
  return Number.isNaN(n) ? -Infinity : n;
};

function MissionRow({ m }: { m: any }) {
  const prog = missionProgress(m);
  const failedPct = prog.total ? Math.round((prog.failed / prog.total) * 100) : 0;
  const cancelledPct = prog.total ? Math.round((prog.cancelled / prog.total) * 100) : 0;
  return (
    <Link href={`/missions/${m.id}`}>
      <Card className="p-6 hover:border-primary/40 transition-colors cursor-pointer group">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <h2 className="font-semibold">{m.goal}</h2>
              <Badge className={MISSION_STATUS_COLOR[m.status] || "bg-muted text-muted-foreground"}>{m.status}</Badge>
            </div>
            <p className="text-xs text-muted-foreground">Priority {m.priority} • Created {m.createdAt ? new Date(m.createdAt).toLocaleDateString() : "—"}</p>
            <div className="mt-3">
              <div className="flex items-center justify-between text-xs mb-1 gap-2">
                <span className="text-muted-foreground">Progress</span>
                <span className="text-muted-foreground">
                  {prog.pct}%
                  {prog.failed > 0 && <span className="text-destructive">{` · ${prog.failed} failed`}</span>}
                  {prog.cancelled > 0 && <span className="text-muted-foreground">{` · ${prog.cancelled} cancelled`}</span>}
                </span>
              </div>
              <ClampedProgress pct={prog.pct} failedPct={failedPct} cancelledPct={cancelledPct} />
            </div>
            <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
              <span>{prog.total} tasks</span>
              <span>{formatCost(m.totalCost)}</span>
              <span>{formatDuration(m.duration)}</span>
            </div>
          </div>
          <ArrowRight className="h-5 w-5 text-muted-foreground group-hover:text-foreground transition-colors shrink-0" />
        </div>
      </Card>
    </Link>
  );
}

function WorkflowRow({ a }: { a: any }) {
  const trigger = safeJson<Record<string, unknown>>(a.trigger, {});
  const actions = safeJson<Array<unknown>>(a.actions, []);
  const Icon = triggerIcons[String(trigger.type)];
  return (
    <Link href={`/workflows/${a.id}`}>
      <Card className="p-5 hover:border-primary/40 transition-colors cursor-pointer group">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="rounded-md bg-muted p-2 shrink-0">{Icon ? <Icon className="h-5 w-5 text-muted-foreground" /> : <Zap className="h-5 w-5 text-muted-foreground" />}</div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <h2 className="font-semibold">{a.name}</h2>
                <Badge className={AUTOMATION_STATUS_COLOR[a.status] || "bg-muted text-muted-foreground"}>{a.status}</Badge>
              </div>
              <p className="text-sm text-muted-foreground line-clamp-1">{a.description || "No description"}</p>
              <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground flex-wrap">
                <span className="flex items-center gap-1">{Icon ? <Icon className="h-3.5 w-3.5" /> : <Zap className="h-3.5 w-3.5" />} {String(trigger.type || "manual")}</span>
                <span>Actions: {Array.isArray(actions) ? actions.length : 0}</span>
                <span>Runs: {a.runCount || 0}</span>
                <span>Errors: {a.errorCount || 0}</span>
              </div>
            </div>
          </div>
          <ArrowRight className="h-5 w-5 text-muted-foreground group-hover:text-foreground transition-colors shrink-0" />
        </div>
      </Card>
    </Link>
  );
}

function GuardHeader({ label, count }: { label: string; count: number }) {
  return (
    <div className="flex items-center gap-2 pt-2" aria-label={`Unknown status ${label}`}>
      <Badge className="bg-muted text-muted-foreground">{label}</Badge>
      <span className="text-xs text-muted-foreground">{count} {pluralize(count, "item")} with an unrecognised status</span>
    </div>
  );
}

function WorkBoard() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [facet, setFacet] = useState<Facet>(() => parseFacet(searchParams.get("type")));
  const [status, setStatus] = useState<string>(() => parseStatus(parseFacet(searchParams.get("type")), searchParams.get("status")));
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [newWorkflow, setNewWorkflow] = useState("");
  const [planning, setPlanning] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");
  const [simResult, setSimResult] = useState<any>(null);

  const { data: missionsData, error: missionsError, isLoading: missionsLoading, mutate: mutateMissions } = useMissions();
  const { data: workflowsData, error: workflowsError, isLoading: workflowsLoading, mutate: mutateWorkflows } = useAutomations();

  useEffect(() => {
    const t = parseFacet(searchParams.get("type"));
    setFacet(t);
    setStatus(parseStatus(t, searchParams.get("status")));
  }, [searchParams]);

  const applyQuery = (t: Facet, s: string) => {
    const params = new URLSearchParams();
    if (t !== "all") params.set("type", t);
    if (s) params.set("status", s);
    const qs = params.toString();
    router.replace(qs ? `/work?${qs}` : "/work");
  };

  const setFacetFilter = (t: Facet) => {
    const nextStatus = statusValidFor(t, status) ? status : "";
    setFacet(t);
    setStatus(nextStatus);
    applyQuery(t, nextStatus);
  };

  const setStatusFilter = (s: string) => {
    setStatus(s);
    applyQuery(facet, s);
  };

  const clearFilters = () => {
    setSearch("");
    setFacet("all");
    setStatus("");
    router.replace("/work");
  };

  const openCreate = () => {
    if (facet !== "workflows") setFacetFilter("workflows");
    setShowCreate(true);
  };

  const M = missionsData?.missions || [];
  const W = workflowsData?.automations || [];
  const bucketM = facet === "workflows" ? [] : M;
  const bucketW = facet === "missions" ? [] : W;
  const baseCount = bucketM.length + bucketW.length;

  const searchTerm = search.trim().toLowerCase();
  const matchesSearch = (text?: string) => !searchTerm || (text || "").toLowerCase().includes(searchTerm);

  const shownM = bucketM.filter((m: any) => matchesSearch(m.goal) && (status ? m.status === status : KNOWN_MISSION.has(m.status)));
  const shownW = bucketW.filter((a: any) => matchesSearch(a.name || a.description) && (status ? a.status === status : KNOWN_AUTOMATION.has(a.status)));

  const unknownM = !status ? bucketM.filter((m: any) => matchesSearch(m.goal) && !KNOWN_MISSION.has(m.status)) : [];
  const unknownW = !status ? bucketW.filter((a: any) => matchesSearch(a.name || a.description) && !KNOWN_AUTOMATION.has(a.status)) : [];

  const filtered = Boolean(search || status || facet !== "all");
  const itemsShown = shownM.length + shownW.length;

  const items = [
    ...shownM.map((m: any) => ({ kind: "mission" as const, createdAt: m.createdAt, mission: m })),
    ...shownW.map((a: any) => ({ kind: "workflow" as const, createdAt: a.createdAt, workflow: a })),
  ].sort((x, y) => timeOf(y.createdAt) - timeOf(x.createdAt));

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
      await mutateWorkflows();
      router.push(`/workflows/${data.automation.id}`);
    } catch (e: any) {
      setCreateError(e?.message || "Failed to create workflow.");
      setCreating(false);
    }
  };

  const missionsRelevant = facet !== "workflows";
  const workflowsRelevant = facet !== "missions";
  const anyLoading = (missionsRelevant && missionsLoading) || (workflowsRelevant && workflowsLoading);

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Work</h1>
          <p className="text-sm text-muted-foreground">Goals and recurring automations across the workforce</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/missions/new">
            <Button className="gap-2"><Plus className="h-4 w-4" /> New Mission</Button>
          </Link>
          <Button variant="outline" onClick={openCreate} className="gap-2">
            <Plus className="h-4 w-4" /> New Workflow
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 max-w-sm min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search work..."
            aria-label="Search work"
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div role="group" aria-label="Filter by type" className="flex rounded-md border bg-background p-1 gap-1">
          {(["all", "missions", "workflows"] as const).map((t) => (
            <button
              key={t}
              type="button"
              aria-pressed={facet === t}
              onClick={() => setFacetFilter(t)}
              className={cn(
                "px-3 py-1 text-sm rounded transition-colors",
                facet === t ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {t === "all" ? "All" : t === "missions" ? "Missions" : "Workflows"}
            </button>
          ))}
        </div>
        <label className="sr-only" htmlFor="work-status-filter">Filter by status</label>
        <select
          id="work-status-filter"
          value={status}
          onChange={(e) => setStatusFilter(e.target.value)}
          aria-label="Filter work by status"
          className="rounded-md border bg-background px-3 py-2 text-sm h-10"
        >
          <option value="">All statuses</option>
          {facet !== "workflows" && (facet === "missions" ? (
            MISSION_STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)
          ) : (
            <optgroup label="Mission status">
              {MISSION_STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
            </optgroup>
          ))}
          {facet !== "missions" && (facet === "workflows" ? (
            AUTOMATION_STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)
          ) : (
            <optgroup label="Workflow status">
              {AUTOMATION_STATUS_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
            </optgroup>
          ))}
        </select>
        {search && (
          <Button variant="ghost" size="sm" onClick={() => setSearch("")} className="gap-1 text-muted-foreground hover:text-foreground" aria-label="Clear search">
            <X className="h-3.5 w-3.5" /> Clear
          </Button>
        )}
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
          <div className="flex items-center justify-between flex-wrap gap-2">
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
              <h3 className="font-semibold text-success flex items-center gap-2">
                <Sparkles className="h-4 w-4" /> Simulation Preview
              </h3>
              <p className="text-sm text-muted-foreground">{simResult.name}</p>
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="rounded-lg p-3 border">
                  <p className="text-xs text-muted-foreground">Steps</p>
                  <p className="font-bold text-xl">{simResult.actions?.length || 0}</p>
                </div>
                <div className="rounded-lg p-3 border">
                  <p className="text-xs text-muted-foreground">Est. Cost</p>
                  <p className="font-bold text-xl">${(simResult.totalCost || 0).toFixed(3)}</p>
                </div>
                <div className="rounded-lg p-3 border">
                  <p className="text-xs text-muted-foreground">Est. Duration</p>
                  <p className="font-bold text-xl">{Math.round((simResult.totalDuration || 0) / 1000)}s</p>
                </div>
              </div>
            </div>
          )}
        </Card>
      )}

      {(missionsRelevant && missionsError) && (
        <Card className="p-8 text-center space-y-4">
          <p className="text-lg font-medium text-destructive">Failed to load missions</p>
          <p className="text-sm text-muted-foreground">{missionsError.message}</p>
          <Button variant="outline" onClick={() => mutateMissions()} className="gap-2">
            <RefreshCw className="h-4 w-4" /> Retry
          </Button>
        </Card>
      )}
      {(workflowsRelevant && workflowsError) && (
        <Card className="p-8 text-center space-y-4">
          <p className="text-lg font-medium text-destructive">Failed to load workflows</p>
          <p className="text-sm text-muted-foreground">{workflowsError.message}</p>
          <Button variant="outline" onClick={() => mutateWorkflows()} className="gap-2">
            <RefreshCw className="h-4 w-4" /> Retry
          </Button>
        </Card>
      )}

      {anyLoading && itemsShown === 0 && (
        <div className="space-y-1 text-sm text-muted-foreground py-2" aria-live="polite">
          {missionsRelevant && missionsLoading && <p>Loading missions...</p>}
          {workflowsRelevant && workflowsLoading && <p>Loading workflows...</p>}
        </div>
      )}

      {!anyLoading && !missionsError && !workflowsError && itemsShown === 0 && (
        <Card className="p-12 text-center space-y-4">
          <Briefcase className="h-12 w-12 mx-auto text-muted-foreground" />
          {search || status ? (
            <>
              <p className="text-lg font-medium">No work matches</p>
              <p className="text-sm text-muted-foreground">Try a different filter.</p>
              <Button variant="outline" onClick={clearFilters}>Clear filters</Button>
            </>
          ) : facet === "workflows" ? (
            <>
              <p className="text-lg font-medium">No workflows yet</p>
              <p className="text-sm text-muted-foreground">Create your first recurring workflow</p>
              <Button onClick={openCreate} className="mt-2 gap-2"><Plus className="h-4 w-4" /> Create Workflow</Button>
            </>
          ) : facet === "missions" ? (
            <>
              <p className="text-lg font-medium">No missions yet</p>
              <p className="text-sm text-muted-foreground">Create your first mission</p>
              <Link href="/missions/new"><Button className="mt-2 gap-2"><Plus className="h-4 w-4" /> Create Mission</Button></Link>
            </>
          ) : (
            <>
              <p className="text-lg font-medium">No work yet</p>
              <p className="text-sm text-muted-foreground">Create a mission or a workflow to get started</p>
              <div className="flex justify-center gap-2 pt-2">
                <Link href="/missions/new"><Button className="gap-2"><Plus className="h-4 w-4" /> New Mission</Button></Link>
                <Button variant="outline" onClick={openCreate} className="gap-2"><Plus className="h-4 w-4" /> New Workflow</Button>
              </div>
            </>
          )}
        </Card>
      )}

      {itemsShown > 0 && (
        <>
          <p className="text-sm text-muted-foreground" aria-live="polite">
            {filtered ? `${itemsShown} of ${baseCount} ${pluralize(baseCount, "item")} match` : `${baseCount} ${pluralize(baseCount, "item")}`}
          </p>
          <div className="grid gap-4">
            {items.map((it) =>
              it.kind === "mission" ? (
                <MissionRow key={it.mission.id} m={it.mission} />
              ) : (
                <WorkflowRow key={it.workflow.id} a={it.workflow} />
              )
            )}
            {unknownM.length > 0 && (
              <>
                <GuardHeader label={new Set(unknownM.map((m: any) => m.status)).size === 1 ? unknownM[0].status : "OTHER"} count={unknownM.length} />
                {unknownM.map((m: any) => <MissionRow key={`u-${m.id}`} m={m} />)}
              </>
            )}
            {unknownW.length > 0 && (
              <>
                <GuardHeader label={new Set(unknownW.map((a: any) => a.status)).size === 1 ? unknownW[0].status : "OTHER"} count={unknownW.length} />
                {unknownW.map((a: any) => <WorkflowRow key={`u-${a.id}`} a={a} />)}
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export default function WorkPage() {
  return (
    <Suspense fallback={<div className="min-h-[50vh]" />}>
      <WorkBoard />
    </Suspense>
  );
}