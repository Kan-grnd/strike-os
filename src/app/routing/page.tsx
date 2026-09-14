"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Target, CheckCircle2, AlertCircle } from "lucide-react";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export default function RoutingPage() {
  const [selectedAgent, setSelectedAgent] = useState<string>("");
  const [testResult, setTestResult] = useState<any>(null);
  const [testing, setTesting] = useState(false);

  // Mock agent data for demo
  const agents = [
    { id: "1", name: "Researcher", type: "SPECIALIST", status: "RUNNING", capabilities: ["intel.research", "source.evaluation", "report.synthesis"], model: "claude-sonnet-4" },
    { id: "2", name: "Web Analyst", type: "WORKER", status: "RUNNING", capabilities: ["web.analysis", "cadence.tracking"], model: "claude-haiku-4" },
    { id: "3", name: "Source Reviewer", type: "WORKER", status: "IDLE", capabilities: ["source.evaluation", "authority.rating"], model: "claude-haiku-4" },
    { id: "4", name: "Architect", type: "ARCHITECT", status: "IDLE", capabilities: ["system.design", "pipeline.architecture"], model: "gpt-4o" },
    { id: "5", name: "Coder", type: "WORKER", status: "RUNNING", capabilities: ["code.python", "data.pipelines"], model: "auto/best-coding" },
    { id: "6", name: "QA", type: "WORKER", status: "IDLE", capabilities: ["quality.validation", "accuracy.audit"], model: "auto/fast" },
  ];

  const handleTest = async () => {
    if (!selectedAgent) return;
    setTesting(true);
    try {
      const res = await fetch("/api/models/select", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agentId: selectedAgent,
          taskType: "intel.research",
          requirements: { capabilities: ["intel.research"] },
        }),
      });
      const data = await res.json();
      setTestResult(data);
    } catch {
      setTestResult({ error: "Test failed" });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold">Routing</h1>
        <p className="text-sm text-muted-foreground">Model routing policies and fallback chains</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Default Policy */}
        <Card className="p-6 lg:col-span-2 space-y-4">
          <div className="flex items-center gap-2 mb-4">
            <Sparkles className="h-5 w-5 text-primary" />
            <h2 className="font-semibold">Default Routing Policy</h2>
          </div>
          <p className="text-sm text-muted-foreground">Applied when an agent has no manual override</p>
          
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium">Task Type Rules</label>
              <div className="grid grid-cols-2 gap-3 mt-2">
                <div className="rounded-md border p-3">
                  <p className="font-mono text-sm text-primary">research</p>
                  <p className="text-xs text-muted-foreground">→ claude-sonnet-4 (primary)</p>
                </div>
                <div className="rounded-md border p-3">
                  <p className="font-mono text-sm text-primary">code</p>
                  <p className="text-xs text-muted-foreground">→ auto/best-coding (primary)</p>
                </div>
                <div className="rounded-md border p-3">
                  <p className="font-mono text-sm text-primary">analysis</p>
                  <p className="text-xs text-muted-foreground">→ claude-sonnet-4 (primary)</p>
                </div>
                <div className="rounded-md border p-3">
                  <p className="font-mono text-sm text-primary">quick</p>
                  <p className="text-xs text-muted-foreground">→ auto/fast (primary)</p>
                </div>
              </div>
            </div>

            <div className="border-t pt-4">
              <div className="flex items-center justify-between mb-2">
                <label className="font-medium">Default Fallback Chain</label>
                <Badge variant="outline">3 models</Badge>
              </div>
              <div className="space-y-2">
                {["1. auto/best-coding (OmniRoute)", "2. claude-sonnet-4 (Anthropic)", "3. gpt-4o (OpenAI)"].map((m, i) => (
                  <div key={i} className="flex items-center gap-2 rounded-md bg-muted/50 p-2">
                    <span className="font-mono text-xs">{i + 1}.</span>
                    <span className="text-sm">{m}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between border-t pt-4">
              <span className="text-sm text-muted-foreground">Max cost per call: $0.05</span>
              <span className="text-sm text-muted-foreground">Max latency: 30s</span>
            </div>
          </div>
        </Card>

        {/* Agent Overrides */}
        <Card className="p-6 space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <Target className="h-5 w-5 text-primary" />
            <h2 className="font-semibold">Agent Overrides</h2>
          </div>
          <p className="text-xs text-muted-foreground">Per-agent model assignment</p>
          <div className="space-y-2 max-h-96 overflow-auto">
            {agents.map((a) => (
              <div key={a.id} className={`flex items-center justify-between p-2 rounded-md border cursor-pointer transition-colors ${selectedAgent === a.id ? "border-primary bg-primary/5" : ""}`} onClick={() => setSelectedAgent(selectedAgent === a.id ? "" : a.id)}>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs">{a.type}</Badge>
                  <span className="text-sm font-medium">{a.name}</span>
                  <Badge variant="outline" className={a.status === "RUNNING" ? "bg-success/10 text-success" : "bg-muted"}> {a.status} </Badge>
                </div>
                <Badge variant="outline" className="font-mono text-xs">{a.model}</Badge>
              </div>
            ))}
          </div>
        </Card>

        {/* Test Panel */}
        <Card className="p-6 lg:col-span-1 space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle2 className="h-5 w-5 text-success" />
            <h2 className="font-semibold">Test Routing</h2>
          </div>
          <p className="text-sm text-muted-foreground">Click an agent to see which model would be selected</p>
          
          {selectedAgent && (
            <div className="space-y-3">
              <div className="rounded-md bg-muted p-3">
                <p className="text-xs text-muted-foreground">Selected Agent</p>
                <p className="font-mono text-sm">{agents.find(a => a.id === selectedAgent)?.name}</p>
                <p className="text-xs text-muted-foreground">Capabilities: {agents.find(a => a.id === selectedAgent)?.capabilities.join(", ")}</p>
              </div>
              
              <Button onClick={handleTest} disabled={testing} className="w-full gap-2">
                {testing ? "Testing..." : <><Sparkles className="h-4 w-4" /> Run Test</>}
              </Button>

              {testResult && (
                <div className={`rounded-md p-3 ${testResult.error ? "bg-destructive/10 border border-destructive/20" : "bg-success/10 border border-success/20"}`}>
                  {testResult.error ? (
                    <>
                      <AlertCircle className="h-4 w-4 text-destructive mb-2" />
                      <p className="text-sm text-destructive">{testResult.error}</p>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="h-4 w-4 text-success mb-2" />
                      <p className="text-sm font-mono">{testResult.selectedModelId || "auto/best-coding"}</p>
                      <p className="text-xs text-muted-foreground mt-1">Provider: {testResult.providerName || "omniroute"}</p>
                      <p className="text-xs text-muted-foreground mt-1">Reason: {testResult.reason || "Best match"}</p>
                    </>
                  )}
                </div>
              )}
              
              {!selectedAgent && (
                <div className="text-center py-8 text-muted-foreground">
                  <Target className="h-12 w-12 mx-auto mb-3 opacity-30" />
                  <p>Select an agent to test routing</p>
                </div>
              )}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}