"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { WorkflowFlow } from "@/components/workflow/workflow-flow";
import { WorkflowEditorDrawer } from "@/components/workflow/workflow-editor-drawer";
import { ArrowLeft, RefreshCw, Play, Pause, Square, Clock, Zap, CheckCircle2 } from "lucide-react";

export default function WorkflowDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingIndex, setEditingIndex] = useState(0);
  const [workflowPlan, setWorkflowPlan] = useState([
    { type: "create_mission", config: { goal: "Build competitor intelligence report" } },
    { type: "invoke_agent", config: { agentId: "webAnalyst" } },
    { type: "call_tool", config: { toolId: "browser", agentId: "webAnalyst" } },
    { type: "notify_user", config: { message: "Significant signal change detected", severity: "warning" } },
  ]);

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => router.push("/workflows")} className="gap-2">
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>
      </div>

      <div>
        <div className="flex items-center gap-2 mb-1">
          <h1 className="text-2xl font-bold">Competitor Intel Sweep</h1>
          <Badge className="bg-success/10 text-success">ACTIVE</Badge>
        </div>
        <p className="text-sm text-muted-foreground">Workflow • Trigger: schedule (0 9 * * *) • 4 steps</p>
      </div>

      <div className="flex gap-2">
        <Button className="gap-2"><Play className="h-3.5 w-3.5" /> Start</Button>
        <Button variant="outline" className="gap-2"><Pause className="h-3.5 w-3.5" /> Pause</Button>
        <Button variant="outline" size="sm" className="gap-2"><RefreshCw className="h-3.5 w-3.5" /> Refresh</Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="p-6 lg:col-span-2 space-y-4">
          <h2 className="font-semibold flex items-center gap-2"><Zap className="h-4 w-4 text-primary" /> Flow</h2>
          <WorkflowFlow
            title="Execution Sequence"
            actions={workflowPlan.map((a, i) => ({ ...a, index: i }))}
          />
          <p className="text-xs text-muted-foreground">Click any step to edit it</p>
        </Card>

        <Card className="p-6 space-y-3">
          <h2 className="font-semibold">Status</h2>
          <div className="rounded-lg bg-muted p-3 space-y-1 text-sm">
            <div className="flex justify-between"><span>Last run</span><span className="font-mono">2h ago</span></div>
            <div className="flex justify-between"><span>Next run</span><span className="font-mono">7h remaining</span></div>
            <div className="flex justify-between"><span>Runs</span><span className="font-mono">42</span></div>
            <div className="flex justify-between"><span>Errors</span><span className="font-mono">1</span></div>
          </div>
          <Separator />
          <h2 className="font-semibold">Trigger</h2>
          <Badge variant="outline">Schedule — 0 9 * * *</Badge>
          <h2 className="font-semibold mt-2">Conditions</h2>
          <p className="text-xs text-muted-foreground">No conditions set</p>
        </Card>
      </div>

      <Card className="p-6">
        <h2 className="font-semibold mb-3">Execution History</h2>
        <div className="space-y-2 max-h-40 overflow-auto">
          {[
            { status: "COMPLETED", time: "2h ago", duration: "3m 12s", cost: "$0.05" },
            { status: "COMPLETED", time: "5h ago", duration: "2m 45s", cost: "$0.03" },
            { status: "FAILED", time: "8h ago", duration: "30s", cost: "$0.01", error: "Agent timeout" },
          ].map((run, i) => (
            <div key={i} className="flex items-center gap-3 rounded-md bg-muted/30 px-3 py-2 text-sm">
              <span className={`h-2 w-2 rounded-full ${run.status === "COMPLETED" ? "bg-success" : "bg-destructive"}`} />
              <span className="font-mono text-xs">{run.time}</span>
              <span className="flex-1">{run.duration}</span>
              <span className="text-xs text-faint">{run.cost}</span>
              {run.error && <span className="text-xs text-destructive">{run.error}</span>}
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}