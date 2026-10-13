"use client";

import { useState } from "react";
import { motion } from "motion/react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader, EASE } from "@/components/shared/page-header";
import { cn } from "@/lib/utils";
import {
  Sparkles,
  Target,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";

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

  const rules = [
    { task: "research", model: "claude-sonnet-4 (primary)" },
    { task: "code", model: "auto/best-coding (primary)" },
    { task: "analysis", model: "claude-sonnet-4 (primary)" },
    { task: "quick", model: "auto/fast (primary)" },
  ];

  const fallbackChain = [
    "auto/best-coding (OmniRoute)",
    "claude-sonnet-4 (Anthropic)",
    "gpt-4o (OpenAI)",
  ];

  const selected = agents.find((a) => a.id === selectedAgent);

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
    <div className="mx-auto max-w-[1200px] space-y-6">
      <PageHeader
        backHref="/"
        icon={Sparkles}
        eyebrow="Intelligence"
        title="Routing"
        description="Model routing policies and fallback chains."
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="space-y-4 p-6 lg:col-span-2">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            <h2 className="font-semibold">Default routing policy</h2>
          </div>
          <p className="text-sm text-muted-foreground">
            Applied when an agent has no manual override.
          </p>

          <div className="space-y-4">
            <div className="space-y-2">
              <span className="text-sm font-medium">Task type rules</span>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {rules.map((r, i) => (
                  <motion.div
                    key={r.task}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: Math.min(i * 0.05, 0.3), ease: EASE }}
                    className="rounded-xl border bg-background p-3"
                  >
                    <p className="font-mono text-sm text-primary">{r.task}</p>
                    <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                      <span aria-hidden>→</span> {r.model}
                    </p>
                  </motion.div>
                ))}
              </div>
            </div>

            <div className="space-y-2 border-t pt-4">
              <div className="flex items-center justify-between">
                <span className="font-medium">Default fallback chain</span>
                <Badge variant="outline">{fallbackChain.length} models</Badge>
              </div>
              <div className="space-y-2">
                {fallbackChain.map((m, i) => (
                  <div
                    key={m}
                    className="flex items-center gap-2 rounded-xl bg-muted/50 p-2"
                  >
                    <span className="font-mono text-xs text-muted-foreground">
                      {i + 1}
                    </span>
                    <span className="font-mono text-sm">{m}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between border-t pt-4 text-sm text-muted-foreground">
              <span>Max cost per call: $0.05</span>
              <span>Max latency: 30s</span>
            </div>
          </div>
        </Card>

        <Card className="flex flex-col space-y-3 p-6">
          <div className="flex items-center gap-2">
            <Target className="h-5 w-5 text-primary" />
            <h2 className="font-semibold">Agent overrides</h2>
          </div>
          <p className="text-xs text-muted-foreground">Per-agent model assignment.</p>
          <div className="max-h-96 space-y-2 overflow-auto">
            {agents.map((a) => (
              <button
                key={a.id}
                type="button"
                onClick={() =>
                  setSelectedAgent(selectedAgent === a.id ? "" : a.id)
                }
                className={cn(
                  "flex w-full items-center justify-between gap-2 rounded-xl border p-2 text-left transition-colors",
                  selectedAgent === a.id
                    ? "border-primary bg-primary/5"
                    : "hover:border-ring/40"
                )}
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium">{a.name}</span>
                  <span className="font-mono text-xs text-muted-foreground">
                    {a.model}
                  </span>
                </span>
                <span className="flex shrink-0 items-center gap-1.5">
                  <span
                    className={cn(
                      "h-1.5 w-1.5 rounded-full",
                      a.status === "RUNNING" ? "bg-success" : "bg-muted-foreground"
                    )}
                  />
                  <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
                    {a.type}
                  </span>
                </span>
              </button>
            ))}
          </div>
        </Card>
      </div>

      <Card className="space-y-4 p-6">
        <div className="flex items-center gap-2">
          <Target className="h-5 w-5 text-primary" />
          <h2 className="font-semibold">Test routing</h2>
        </div>
        {selected ? (
          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-xl bg-muted p-4">
              <p className="text-xs text-muted-foreground">Selected agent</p>
              <p className="font-mono text-sm">{selected.name}</p>
              <p className="mt-2 text-xs text-muted-foreground">
                Capabilities: {selected.capabilities.join(", ")}
              </p>
            </div>
            <div className="space-y-3">
              <Button onClick={handleTest} disabled={testing} className="w-full gap-2">
                {testing ? (
                  "Testing…"
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" /> Run test
                  </>
                )}
              </Button>
              {testResult && (
                <div
                  className={cn(
                    "rounded-xl border p-3",
                    testResult.error
                      ? "border-destructive/30 bg-destructive/10"
                      : "border-success/30 bg-success/10"
                  )}
                >
                  {testResult.error ? (
                    <p className="flex items-center gap-2 text-sm text-destructive">
                      <AlertCircle className="h-4 w-4" /> {testResult.error}
                    </p>
                  ) : (
                    <>
                      <p className="flex items-center gap-2 font-mono text-sm">
                        <CheckCircle2 className="h-4 w-4 text-success" />
                        {testResult.selectedModelId || "auto/best-coding"}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Provider: {testResult.providerName || "omniroute"}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Reason: {testResult.reason || "Best match"}
                      </p>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        ) : (
          <EmptyState
            icon={Target}
            title="Select an agent to test routing"
            description="Pick an agent above to see which model the router would choose."
          />
        )}
      </Card>
    </div>
  );
}