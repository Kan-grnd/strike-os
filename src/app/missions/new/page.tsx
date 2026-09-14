"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Brain, Sparkles, Clock, DollarSign, Zap, CheckCircle2 } from "lucide-react";

export default function NewMissionPage() {
  const router = useRouter();
  const [goal, setGoal] = useState("");
  const [simulating, setSimulating] = useState(false);
  const [simResult, setSimResult] = useState<any>(null);
  const [creating, setCreating] = useState(false);

  const simulate = async () => {
    if (!goal.trim()) return;
    setSimulating(true);
    try {
      const res = await fetch("/api/missions", { method: "GET" });
      // Just build a simulated preview locally
      const steps = [
        { step: 1, description: "Discover new sources and collect initial data", agentType: "WORKER", estimatedDuration: 15000, cost: 0.002 },
        { step: 2, description: "Extract and catalog metadata", agentType: "WORKER", dependencies: [1], estimatedDuration: 12000, cost: 0.001 },
        { step: 3, description: "Analyze content for significant changes", agentType: "SPECIALIST", dependencies: [2], estimatedDuration: 20000, cost: 0.003 },
        { step: 4, description: "Detect important changes and route to Alert Agent", agentType: "OBSERVER", dependencies: [3], estimatedDuration: 8000, cost: 0.001 },
      ];
      setSimResult({ steps, totalCost: steps.reduce((s, x) => s + x.cost, 0), totalDuration: steps.reduce((s, x) => s + x.estimatedDuration, 0) });
    } finally {
      setSimulating(false);
    }
  };

  const create = async () => {
    setCreating(true);
    try {
      const res = await fetch("/api/missions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ goal, plan: simResult?.steps || {}, agentIds: [] }),
      });
      const data = await res.json();
      if (data.mission) router.push(`/missions/${data.mission.id}`);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">New Mission</h1>
        <p className="text-sm text-muted-foreground">Describe the goal and Strike OS will plan, assign, and execute</p>
      </div>

      <Card className="p-6 space-y-4">
        <div>
          <label className="text-sm font-medium">Mission Goal</label>
          <Textarea
            placeholder="Create a competitor intelligence workforce that continuously monitors approved sources and flags signal changes..."
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            className="mt-2 min-h-[80px]"
          />
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={simulate} disabled={simulating || !goal.trim()} className="gap-2">
            <Sparkles className="h-4 w-4" />
            {simulating ? "Planning..." : "Simulate Plan"}
          </Button>
          <Button variant="outline" onClick={create} disabled={creating || !goal.trim() || !simResult} className="gap-2">
            <Zap className="h-4 w-4" />
            {creating ? "Creating..." : "Launch Mission"}
          </Button>
        </div>
      </Card>

      {simResult && (
        <Card className="p-6 space-y-4 border-success/30 bg-success/5">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-success" />
            <h2 className="font-semibold">Simulation Preview</h2>
          </div>
          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="rounded-lg bg-card p-3 text-center border">
              <p className="text-xs text-muted-foreground">Steps</p>
              <p className="font-bold text-xl">{simResult.steps.length}</p>
            </div>
            <div className="rounded-lg bg-card p-3 text-center border">
              <p className="text-xs text-muted-foreground">Est. Cost</p>
              <p className="font-bold text-xl">${simResult.totalCost.toFixed(3)}</p>
            </div>
            <div className="rounded-lg bg-card p-3 text-center border">
              <p className="text-xs text-muted-foreground">Est. Duration</p>
              <p className="font-bold text-xl">{Math.round(simResult.totalDuration / 1000)}s</p>
            </div>
          </div>
          <div className="space-y-2">
            {simResult.steps.map((step: any) => (
              <div key={step.step} className="flex items-center gap-3 rounded-md bg-card p-3 border">
                <Badge variant="outline" className="font-mono">{step.step}</Badge>
                <div className="flex-1">
                  <p className="text-sm font-medium">{step.description}</p>
                  <p className="text-xs text-muted-foreground">Agent type: {step.agentType} • ~{Math.round(step.estimatedDuration / 1000)}s</p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
