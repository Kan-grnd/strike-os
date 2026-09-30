"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Sparkles, Clock, DollarSign, Zap, CheckCircle2, AlertCircle, RefreshCw } from "lucide-react";
import { cn, formatCost, formatDuration } from "@/lib/utils";

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

  const planMission = async () => {
    if (!goal.trim() || planning) return;
    setPlanning(true);
    setError("");
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
        body: JSON.stringify({ llm: false }),
      });
      if (!planRes.ok) {
        const body = await planRes.json().catch(() => ({}));
        throw new Error(body.error || `Planning failed: ${planRes.status}`);
      }
      const planData = await planRes.json();
      const steps = Array.isArray(planData.planSteps) ? (planData.planSteps as PlanStep[]) : [];
      if (steps.length === 0) throw new Error("Planner returned an empty plan");

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

  const totalCost = planSteps?.reduce((s, x) => s + (x.estimatedCost || 0), 0) || 0;
  const totalDuration = planSteps?.reduce((s, x) => s + (x.estimatedDuration || 0), 0) || 0;

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">New Mission</h1>
        <p className="text-sm text-muted-foreground">Describe the goal and Strike OS will plan, assign, and execute</p>
      </div>

      <Card className="p-6 space-y-4">
        <div>
          <label htmlFor="mission-goal" className="text-sm font-medium">Mission Goal</label>
          <Textarea
            id="mission-goal"
            placeholder="Create a competitor intelligence workforce that continuously monitors approved sources and flags signal changes..."
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            className="mt-2 min-h-[80px]"
          />
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={planMission} disabled={planning || !goal.trim()} className="gap-2">
            <Sparkles className="h-4 w-4" />
            {planning ? "Planning..." : planSteps ? "Re-plan" : "Plan Mission"}
          </Button>
          <Button onClick={launch} disabled={launching || !missionId || !planSteps} variant="outline" className="gap-2">
            <Zap className="h-4 w-4" />
            {launching ? "Launching..." : "Launch Mission"}
          </Button>
        </div>
        {error && (
          <p className="flex items-center gap-2 text-sm text-destructive bg-destructive/5 border border-destructive/20 rounded-md px-3 py-2">
            <AlertCircle className="h-4 w-4 shrink-0" /> {error}
          </p>
        )}
      </Card>

      {planSteps && (
        <Card className="p-6 space-y-4 border-success/30 bg-success/5">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-success" />
            <h2 className="font-semibold">Plan for this mission</h2>
            {missionId && <Badge variant="outline" className="font-mono text-xs">{missionId.slice(0, 8)}</Badge>}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
            <div className="rounded-lg p-3 text-center border glass">
              <p className="text-xs text-muted-foreground">Steps</p>
              <p className="font-bold text-xl">{planSteps.length}</p>
            </div>
            <div className="rounded-lg p-3 text-center border glass">
              <p className="text-xs text-muted-foreground flex items-center justify-center gap-1"><DollarSign className="h-3 w-3" /> Est. Cost</p>
              <p className="font-bold text-xl">{formatCost(totalCost)}</p>
            </div>
            <div className="rounded-lg p-3 text-center border glass">
              <p className="text-xs text-muted-foreground flex items-center justify-center gap-1"><Clock className="h-3 w-3" /> Est. Duration</p>
              <p className="font-bold text-xl">{formatDuration(totalDuration)}</p>
            </div>
          </div>
          <div className="space-y-2">
            {planSteps.map((step) => (
              <div key={step.step} className="flex items-center gap-3 rounded-md p-3 border glass">
                <Badge variant="outline" className="font-mono">{step.step}</Badge>
                <div className="flex-1">
                  <p className="text-sm font-medium">{step.description}</p>
                  <p className="text-xs text-muted-foreground">
                    Agent type: {step.agentType}
                    {step.dependencies?.length ? ` • depends on: ${step.dependencies.join(", ")}` : ""}
                  </p>
                </div>
                <span className="text-xs text-muted-foreground">{formatDuration(step.estimatedDuration)}</span>
              </div>
            ))}
          </div>
          <Button variant="ghost" size="sm" onClick={planMission} disabled={planning} className="gap-2">
            <RefreshCw className={cn("h-3.5 w-3.5", planning && "animate-spin")} /> Re-plan
          </Button>
        </Card>
      )}
    </div>
  );
}