"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Zap, Play, Pause, RefreshCw, Clock, Calendar, ArrowLeft, Sparkles } from "lucide-react";

export default function AutomationDetailPage({ params }: { params: { id: string } }) {
  const [name, setName] = useState("Intel Source Sweep");
  const [status, setStatus] = useState("ACTIVE");
  const [runningTest, setRunningTest] = useState(false);

  const trigger = { type: "schedule", config: { cron: "0 9 * * *" } };
  const actions = [
    { type: "create_mission", config: { goal: "Sweep intel sources for new signals and significant changes" } },
    { type: "notify_user", config: { message: "Daily intel source sweep completed" } },
  ];

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" className="gap-2"><ArrowLeft className="h-4 w-4" /> Back</Button>
      </div>

      <div>
        <div className="flex items-center gap-2 mb-1">
          <Input className="text-2xl font-bold border-none bg-transparent p-0 h-auto focus-visible:ring-0" value={name} onChange={(e) => setName(e.target.value)} />
          <Badge className={status === "ACTIVE" ? "bg-success/10 text-success" : "bg-muted"}>{status}</Badge>
        </div>
        <p className="text-sm text-muted-foreground">Automation ID: {params.id}</p>
      </div>

      <div className="flex gap-3">
        {status === "DRAFT" && <Button className="gap-2">Start</Button>}
        {status === "ACTIVE" && <Button variant="outline" className="gap-2">Pause</Button>}
        {status === "PAUSED" && <Button className="gap-2">Resume</Button>}
        <Button variant="outline" onClick={() => setRunningTest(true)} className="gap-2"><RefreshCw className="h-4 w-4" /> Run Now</Button>
      </div>

      {runningTest && (
        <Card className="p-4 border-success/40 bg-success/5">
          <div className="flex items-center gap-3">
            <Zap className="h-5 w-5 text-success animate-pulse" />
            <div>
              <p className="font-medium">Automation running</p>
              <p className="text-xs text-muted-foreground">Trigger: schedule (0 9 * * *) → Action: create_mission → notify_user</p>
            </div>
          </div>
        </Card>
      )}

      <div className="grid grid-cols-2 gap-4">
        <Card className="p-6 space-y-4">
          <h2 className="font-semibold">Trigger</h2>
          <div className="rounded-md bg-muted p-3">
            <p className="text-sm font-mono">{trigger.type}</p>
            <p className="text-xs text-muted-foreground">{trigger.config.cron || "Manual"}</p>
          </div>
        </Card>

        <Card className="p-6 space-y-4">
          <h2 className="font-semibold">Conditions</h2>
          <p className="text-xs text-muted-foreground">No conditions configured</p>
        </Card>

        <Card className="p-6 space-y-4 lg:col-span-2">
          <h2 className="font-semibold">Actions</h2>
          <div className="space-y-2">
            {actions.map((a: any, i: number) => (
              <div key={i} className="rounded-md bg-muted p-3">
                <div className="flex items-center gap-2 mb-1">
                  <Badge variant="outline">{a.type}</Badge>
                  <span className="font-mono text-xs">{a.config.goal || "No details"}</span>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Separator />

      <Card className="p-6">
        <h2 className="font-semibold mb-3">Natural Language</h2>
        <p className="text-sm text-muted-foreground mb-3">Edit the goal to change what this automation does</p>
        <Textarea className="min-h-[100px]" defaultValue="Every day at 9 AM research competitors and alert me if something important changes." />
        <div className="flex gap-2 mt-3 justify-end">
          <Button variant="outline">Preview Changes</Button>
          <Button><Sparkles className="h-4 w-4 mr-2" /> Apply</Button>
        </div>
      </Card>
    </div>
  );
}