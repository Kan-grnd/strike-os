"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Sparkles, Clock, DollarSign, Zap, CheckCircle2, AlertCircle, RefreshCw, Info, XCircle } from "lucide-react";
import { cn, formatCost, formatDuration } from "@/lib/utils";
import { PageHeader, SectionLabel, EASE } from "@/components/shared/page-header";

type PlanStep = {
  step: number;
  description: string;
  agentType: string;
  dependencies?: string[];
  estimatedDuration: number;
  estimatedCost: number;
};

export default function NewMissionPage() {
  const router = useRouter();
  const [goal, setGoal] = useState("");
  const [planning, setPlanning] = useState(false);
  const [launching, setLaunching] = useState(false);
  const [error, setError] = useState("");
  const [missionId, setMissionId] = useState<string | null>(null);
  const [planSteps, setPlanSteps] = useState<PlanStep[] | null>(null);
  const [planSimulated, setPlanSimulated] = useState(false);
  const [abandoning, setAbandoning] = useState(false);
  const [notice, setNotice] = useState("");

  const planMission = async () => {
    if (!goal.trim() || planning) return;
    setPlanning(true);
    setError("");
    setNotice("");
    try {
      let id = missionId;
      if (!id) {
        const res = await fetch("/api/missions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ goal, plan: {}, agentIds: [] }),
        });
        if (!res.ok) throw new Error(`Failed to create mission: ${res.status}`);
        const data = await res.json();
        id = data.mission?.id;
        if (!id) throw new Error("Mission was not created");
        setMissionId(id);
      }

      const planRes = await fetch(`/api/missions/${id}/plan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (!planRes.ok) {
        const body = await planRes.json().catch(() => ({}));
        throw new Error(body.error || `Planning failed: ${planRes.status}`);
      }
      const planData = await planRes.json();
      const steps = Array.isArray(planData.planSteps) ? (planData.planSteps as PlanStep[]) : [];
      if (steps.length === 0) throw new Error("Planner returned an empty plan");
      setPlanSimulated(planData.simulated === true);

      await fetch(`/api/missions/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "READY" }),
      });

      setPlanSteps(steps);
    } catch (e: any) {
      setError(e?.message || "Planning failed. Try again.");
    } finally {
      setPlanning(false);
    }
  };

  const launch = async () => {
    if (!missionId || launching) return;
    setLaunching(true);
    setError("");
    setNotice("");
    try {
      const res = await fetch(`/api/missions/${missionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "start" }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Failed to launch: ${res.status}`);
      }
      router.push(`/missions/${missionId}`);
    } catch (e: any) {
      setError(e?.message || "Failed to launch mission.");
      setLaunching(false);
    }
  };

  const abandon = async () => {
    if (abandoning) return;
    // No mission row yet — just clear the draft in the form.
    if (!missionId) {
      setGoal("");
      setPlanSteps(null);
      setPlanSimulated(false);
      setNotice("Draft cleared — nothing was run.");
      return;
    }
    if (!window.confirm("Abandon this draft mission? Nothing has been run.")) return;
    setAbandoning(true);
    setError("");
    setNotice("");
    try {
      const res = await fetch(`/api/missions/${missionId}/cancel`, { method: "POST" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Failed to abandon: ${res.status}`);
      }
      // The mission row is kept for history, marked CANCELLED; no tasks were created.
      setNotice("Draft mission abandoned — no work was run.");
      setMissionId(null);
      setPlanSteps(null);
      setPlanSimulated(false);
    } catch (e: any) {
      setError(e?.message || "Failed to abandon the mission.");
    } finally {
      setAbandoning(false);
    }
  };

  const totalCost = planSteps?.reduce((s, x) => s + (x.estimatedCost || 0), 0) || 0;
  const totalDuration = planSteps?.reduce((s, x) => s + (x.estimatedDuration || 0), 0) || 0;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader
        icon={Sparkles}
        eyebrow="Execution"
        title="New Mission"
        description="Describe the goal and Strike OS will plan, assign, and execute the work"
      />

      <Card className="space-y-4 p-6">
        <div className="space-y-2">
          <label htmlFor="mission-goal" className="text-sm font-medium">
            Mission goal
          </label>
          <Textarea
            id="mission-goal"
            placeholder="Create a competitor intelligence workforce that continuously monitors approved sources and flags signal changes…"
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            className="min-h-[96px]"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={planMission} disabled={planning || !goal.trim()} className="gap-2">
            <Sparkles className="h-4 w-4" />
            {planning ? "Planning…" : planSteps ? "Re-plan" : "Plan mission"}
          </Button>
          <Button onClick={launch} disabled={launching || !missionId || !planSteps} className="gap-2">
            <Zap className="h-4 w-4" />
            {launching ? "Launching…" : "Approve & launch"}
          </Button>
          {(missionId || goal.trim()) && (
            <Button
              onClick={abandon}
              disabled={abandoning || launching || planning}
              variant="ghost"
              className="gap-2 text-muted-foreground hover:text-destructive"
            >
              <XCircle className="h-4 w-4" />
              {abandoning ? "Abandoning…" : "Abandon"}
            </Button>
          )}
        </div>
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <Info className="h-3.5 w-3.5 shrink-0" />
          Nothing runs until you approve the plan. Abandoning leaves no work behind.
        </p>
        {error && (
          <p className="flex items-center gap-2 rounded-xl border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            <AlertCircle className="h-4 w-4 shrink-0" /> {error}
          </p>
        )}
        {notice && (
          <p className="flex items-center gap-2 rounded-xl border border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
            <Info className="h-4 w-4 shrink-0" /> {notice}
          </p>
        )}
      </Card>

      {planSteps && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: EASE }}
        >
          <Card className="space-y-5 border-success/30 bg-success/[0.03] p-6">
            <div className="flex flex-wrap items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-success" />
              <h2 className="font-semibold">Plan for this mission</h2>
              {planSimulated && (
                <Badge className="bg-warning/10 text-warning">Simulated</Badge>
              )}
              {missionId && (
                <Badge variant="outline" className="font-mono text-xs">
                  {missionId.slice(0, 8)}
                </Badge>
              )}
            </div>

            <div className="grid grid-cols-1 gap-px overflow-hidden rounded-xl border bg-border sm:grid-cols-3">
              <div className="bg-background p-4">
                <SectionLabel>Steps</SectionLabel>
                <p className="mt-1 text-2xl font-bold tabular-nums">{planSteps.length}</p>
              </div>
              <div className="bg-background p-4">
                <SectionLabel>
                  <span className="flex items-center gap-1">
                    <DollarSign className="h-3 w-3" /> Est. cost
                  </span>
                </SectionLabel>
                <p className="mt-1 text-2xl font-bold tabular-nums">{formatCost(totalCost)}</p>
              </div>
              <div className="bg-background p-4">
                <SectionLabel>
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" /> Est. duration
                  </span>
                </SectionLabel>
                <p className="mt-1 text-2xl font-bold tabular-nums">{formatDuration(totalDuration)}</p>
              </div>
            </div>

            <div className="space-y-2">
              {planSteps.map((step, i) => (
                <motion.div
                  key={step.step}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.35, delay: Math.min(i * 0.05, 0.4), ease: EASE }}
                  className="flex items-center gap-3 rounded-xl border bg-background/60 p-3"
                >
                  <Badge variant="outline" className="font-mono">
                    {step.step}
                  </Badge>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{step.description}</p>
                    <p className="text-xs text-muted-foreground">
                      {step.agentType}
                      {step.dependencies?.length ? ` · depends on ${step.dependencies.join(", ")}` : ""}
                    </p>
                  </div>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {formatDuration(step.estimatedDuration)}
                  </span>
                </motion.div>
              ))}
            </div>

            <Button variant="ghost" size="sm" onClick={planMission} disabled={planning} className="gap-2">
              <RefreshCw className={cn("h-3.5 w-3.5", planning && "animate-spin")} /> Re-plan
            </Button>
          </Card>
        </motion.div>
      )}
    </div>
  );
}