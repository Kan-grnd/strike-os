"use client";

import { useState } from "react";
import useSWR from "swr";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Loader2, CheckCircle2, X, XCircle, Play, RotateCcw, ShieldCheck } from "lucide-react";
import { cn, safeJson, safeJsonArray } from "@/lib/utils";
import { CAPABILITY_CATALOG } from "@/lib/capabilities";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

const TOOL_CATALOG: Record<string, string[]> = {
  "Web": ["search"],
  "Intel": ["browser", "search", "github", "terminal", "database"],
  "Code": ["shell_execution", "code_lint", "git_operations"],
  "Notify": ["notify_user", "send_email", "post_webhook"],
};

export default function AgentArchitectPage() {
  const router = useRouter();
  const [goal, setGoal] = useState("");
  const [name, setName] = useState("");
  const [type, setType] = useState("WORKER");
  const [colonyId, setColonyId] = useState<string>("");
  const [selectedCapabilities, setSelectedCapabilities] = useState<string[]>([]);
  const [selectedTools, setSelectedTools] = useState<string[]>([]);
  const [selectedModels, setSelectedModels] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; agent?: any; error?: string } | null>(null);
  const [forgeMsg, setForgeMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [deployingId, setDeployingId] = useState<string | null>(null);
  const [trialingId, setTrialingId] = useState<string | null>(null);

  const { data: coloniesData } = useSWR("/api/colonies", fetcher);
  const { data: toolsData } = useSWR("/api/tools", fetcher);
  const { data: modelsData } = useSWR("/api/models", fetcher);
  const { data: agentsData } = useSWR("/api/agents", fetcher);
  const { data: forgeData, mutate: mutateForge } = useSWR("/api/specialists", fetcher);

  const colonies = coloniesData?.colonies || [];
  const tools = toolsData?.tools || [];
  const models = modelsData?.models || [];
  const existingAgents = agentsData?.agents || [];
  const specialistBundles = forgeData?.bundles || [];
  const specialistInstalls: Record<string, any> = forgeData?.installs || {};

  const toggleCapability = (cap: string) => {
    setSelectedCapabilities((prev) =>
      prev.includes(cap) ? prev.filter((c) => c !== cap) : [...prev, cap]
    );
  };

  const toggleTool = (tool: string) => {
    setSelectedTools((prev) =>
      prev.includes(tool) ? prev.filter((t) => t !== tool) : [...prev, tool]
    );
  };

  const applyBundle = (bundle: any) => {
    const dirty =
      goal.trim() !== "" ||
      name !== "" ||
      selectedCapabilities.length > 0 ||
      selectedTools.length > 0 ||
      selectedModels.length > 0 ||
      colonyId !== "";
    if (
      dirty &&
      !window.confirm(
        `Apply template "${bundle.label}"? This will replace your current form selections.`
      )
    ) {
      return;
    }
    const colony = colonies.find((c: any) => c.name === bundle.colonyName);
    const modelIds = [bundle.modelPolicy.primary, ...bundle.modelPolicy.fallbacks]
      .map((n: string) => models.find((m: any) => m.name === n)?.id)
      .filter(Boolean);
    setName(bundle.label);
    setGoal(bundle.description);
    setType(bundle.agentType);
    setColonyId(colony?.id ?? "");
    setSelectedCapabilities([...bundle.capabilities]);
    setSelectedTools([...bundle.toolNames]);
    setSelectedModels(modelIds);
    setResult(null);
    setForgeMsg({
      ok: true,
      text: `Template "${bundle.label}" applied — review the form, or use its one-click Deploy.`,
    });
  };

  const deployBundle = async (bundle: any) => {
    setDeployingId(bundle.id);
    setForgeMsg(null);
    try {
      const res = await fetch("/api/specialists", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "deploy", bundleId: bundle.id }),
      });
      const data = await res.json();
      if (!res.ok) {
        setForgeMsg({ ok: false, text: data.error ?? "Deployment denied" });
      } else {
        setForgeMsg({
          ok: true,
          text: `"${bundle.label}" deployed — agent "${data.agent?.name ?? "?"}" created. Run its trial to validate.`,
        });
        mutateForge();
      }
    } catch (err: any) {
      setForgeMsg({ ok: false, text: err.message ?? "Deploy failed" });
    } finally {
      setDeployingId(null);
    }
  };

  const trialBundle = async (bundle: any) => {
    setTrialingId(bundle.id);
    setForgeMsg(null);
    try {
      const res = await fetch("/api/specialists", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "trial-run", bundleId: bundle.id }),
      });
      const data = await res.json();
      if (!res.ok) {
        setForgeMsg({ ok: false, text: data.error ?? "Trial failed" });
      } else {
        const t = data.trial;
        setForgeMsg({
          ok: t.verdict === "PASS",
          text: `${bundle.label} trial ${t.verdict} · ${(t.durationMs / 1000).toFixed(1)}s · $${(t.cost ?? 0).toFixed(4)} · ${t.trace?.length ?? 0} trace steps${
            t.verdict === "FAIL" && t.reason ? ` — ${t.reason}` : ""
          }`,
        });
        mutateForge();
      }
    } catch (err: any) {
      setForgeMsg({ ok: false, text: err.message ?? "Trial failed" });
    } finally {
      setTrialingId(null);
    }
  };

  const handleSubmit = async () => {
    if (!name || selectedCapabilities.length === 0) {
      setResult({ ok: false, error: "Name and at least one capability required" });
      return;
    }
    setSubmitting(true);
    setResult(null);
    try {
      // Find existing agent that can do any of these capabilities
      const existingAgent = existingAgents.find((a: any) => {
        const caps = safeJsonArray(a.capabilities);
        return caps.some((c) => selectedCapabilities.includes(c));
      });

      if (existingAgent) {
        setResult({ ok: false, error: `Existing agent "${existingAgent.name}" already provides these capabilities. Consider reusing it.` });
        setSubmitting(false);
        return;
      }

      const toolIds = selectedTools.map((toolName) => {
        const tool = tools.find((t: any) => t.name === toolName);
        return tool?.id;
      }).filter(Boolean);

      const modelIds =
        selectedModels.length > 0
          ? selectedModels
          : models.slice(0, 2).map((m: any) => m.id);

      const res = await fetch("/api/agents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          description: goal || `${type.toLowerCase()} agent`,
          type,
          colonyId: colonyId || undefined,
          capabilities: selectedCapabilities,
          tools: toolIds,
          models: modelIds,
        }),
      });
      const data = await res.json();
      if (data.error) {
        setResult({ ok: false, error: data.error });
      } else {
        setResult({ ok: true, agent: data.agent });
        setTimeout(() => router.push(`/agents/${data.agent.id}`), 1000);
      }
    } catch (err: any) {
      setResult({ ok: false, error: err.message });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <div>
        <div className="flex items-center gap-3 mb-2">
          <div className="rounded-lg p-2 bg-primary/10">
            <Sparkles className="h-5 w-5 text-primary" />
          </div>
          <h1 className="text-2xl font-bold">Agent Architect</h1>
        </div>
        <p className="text-sm text-muted-foreground">Design and deploy new agents based on capability needs</p>
      </div>

      {result?.ok && (
        <Card className="p-6 border-success/40 bg-success/5">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="h-5 w-5 text-success" />
            <div>
              <p className="font-semibold">Agent created successfully</p>
              <p className="text-sm text-muted-foreground">Redirecting to {result.agent?.name}...</p>
            </div>
          </div>
        </Card>
      )}

      {result && !result.ok && (
        <Card className="p-6 border-destructive/40 bg-destructive/5">
          <div className="flex items-center gap-3">
            <X className="h-5 w-5 text-destructive" />
            <div>
              <p className="font-semibold">Cannot create</p>
              <p className="text-sm text-muted-foreground">{result.error}</p>
            </div>
          </div>
        </Card>
      )}

      {forgeMsg && (
        <Card className={cn("p-4", forgeMsg.ok ? "border-success/40 bg-success/5" : "border-destructive/40 bg-destructive/5")}>
          <div className="flex items-center gap-3">
            {forgeMsg.ok ? (
              <CheckCircle2 className="h-5 w-5 text-success shrink-0" />
            ) : (
              <XCircle className="h-5 w-5 text-destructive shrink-0" />
            )}
            <p className="text-sm text-muted-foreground">{forgeMsg.text}</p>
          </div>
        </Card>
      )}

      <Card className="p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="rounded-lg p-2 bg-primary/10">
            <ShieldCheck className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">Specialist Forge</h2>
            <p className="text-xs text-muted-foreground">
              One-click specialist bundles — apply a template to the form, or deploy straight to the workforce and validate with a live trial.
            </p>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {specialistBundles.map((bundle: any) => {
            const install = specialistInstalls[bundle.id];
            const state: "none" | "installed" | "active" | "paused" = !install
              ? "none"
              : install.status === "ACTIVE"
              ? "active"
              : install.status === "PAUSED"
              ? "paused"
              : "installed";
            const lastTrial = install?.trialHistory
              ? safeJson<any[]>(install.trialHistory, []).slice(-1)[0]
              : null;
            return (
              <div
                key={bundle.id}
                data-testid={`forge-${bundle.id}`}
                className={cn(
                  "rounded-lg border p-4 space-y-3",
                  state === "active" && "border-success/40",
                  state === "paused" && "border-warning/40",
                  state === "none" && "border-dashed"
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="text-sm font-semibold truncate">{bundle.label}</h3>
                    <p className="text-xs text-muted-foreground truncate">{bundle.tagline}</p>
                  </div>
                  <Badge
                    variant={
                      state === "active"
                        ? "success"
                        : state === "paused"
                        ? "warning"
                        : state === "none"
                        ? "secondary"
                        : "outline"
                    }
                    className="shrink-0 text-[10px]"
                  >
                    {state === "none"
                      ? "Not installed"
                      : state === "active"
                      ? "Active"
                      : state === "paused"
                      ? "Paused"
                      : "Trial pending"}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">{bundle.description}</p>
                <div className="flex flex-wrap gap-1.5">
                  {bundle.toolNames.map((t: string) => (
                    <Badge key={t} variant="secondary" className="text-[10px]">
                      {t}
                    </Badge>
                  ))}
                  {bundle.capabilities.slice(0, 3).map((c: string) => (
                    <Badge key={c} variant="outline" className="text-[10px]">
                      {c}
                    </Badge>
                  ))}
                </div>
                {lastTrial && (
                  <p
                    className={cn(
                      "text-[11px] font-medium flex items-center gap-1",
                      lastTrial.verdict === "PASS" ? "text-success" : "text-destructive"
                    )}
                  >
                    {lastTrial.verdict === "PASS" ? (
                      <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                    ) : (
                      <XCircle className="h-3.5 w-3.5 shrink-0" />
                    )}
                    <span>
                      {lastTrial.verdict} ·{(lastTrial.durationMs / 1000).toFixed(1)}s · $
                      {(lastTrial.cost ?? 0).toFixed(4)} · {lastTrial.trace?.length ?? 0} trace steps
                      {lastTrial.verdict === "FAIL" && lastTrial.reason
                        ? ` — ${lastTrial.reason}`
                        : ""}
                    </span>
                  </p>
                )}
                <div className="flex flex-wrap gap-2 pt-1">
                  <Button
                    size="sm"
                    variant="outline"
                    data-testid={`template-${bundle.id}`}
                    disabled={!!deployingId || !!trialingId}
                    onClick={() => applyBundle(bundle)}
                  >
                    Use template
                  </Button>
                  {!install ? (
                    <Button
                      size="sm"
                      data-testid={`deploy-${bundle.id}`}
                      disabled={!!deployingId || !!trialingId}
                      onClick={() => deployBundle(bundle)}
                      className="gap-1.5"
                    >
                      {deployingId === bundle.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Sparkles className="h-3.5 w-3.5" />
                      )}
                      Deploy
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant={state === "paused" ? "outline" : "default"}
                      data-testid={`trial-${bundle.id}`}
                      disabled={!!deployingId || !!trialingId}
                      onClick={() => trialBundle(bundle)}
                      className="gap-1.5"
                    >
                      {trialingId === bundle.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : state === "paused" ? (
                        <RotateCcw className="h-3.5 w-3.5" />
                      ) : (
                        <Play className="h-3.5 w-3.5" />
                      )}
                      {state === "paused" ? "Retry trial" : "Run trial"}
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      <Card className="p-6 space-y-6">
        <div>
          <h2 className="text-lg font-semibold mb-1">Goal</h2>
          <p className="text-xs text-muted-foreground mb-3">Describe what this agent should do</p>
          <Input
            placeholder="e.g. An agent that researches competitors, evaluates source authority, and flags signal changes for my intel workforce"
            aria-label="Goal"
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            className="h-12"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium" htmlFor="agent-name">Agent Name</label>
            <Input
              id="agent-name"
              placeholder="Competitive Intel Analyst"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-2"
            />
          </div>
          <div>
            <label className="text-sm font-medium" htmlFor="agent-type">Type</label>
            <select
              id="agent-type"
              className="mt-2 w-full rounded-md border bg-background px-3 py-2 text-sm h-10"
              value={type}
              onChange={(e) => setType(e.target.value)}
            >
              <option value="WORKER">Worker</option>
              <option value="SPECIALIST">Specialist</option>
              <option value="OBSERVER">Observer</option>
              <option value="EVALUATOR">Evaluator</option>
            </select>
          </div>
        </div>

        <div>
          <label className="text-sm font-medium" htmlFor="agent-colony">Colony</label>
          <select
            id="agent-colony"
            className="mt-2 w-full rounded-md border bg-background px-3 py-2 text-sm h-10"
            value={colonyId}
            onChange={(e) => setColonyId(e.target.value)}
          >
            <option value="">— No colony —</option>
            {colonies.map((c: any) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
      </Card>

      <Card className="p-6 space-y-4">
        <div>
          <h2 className="text-lg font-semibold mb-1">Capabilities</h2>
          <p className="text-xs text-muted-foreground">Select what this agent can do</p>
        </div>
        <div className="space-y-4">
          {Object.entries(CAPABILITY_CATALOG).map(([category, caps]) => (
            <div key={category}>
              <p className="text-sm font-medium mb-2">{category}</p>
              <div className="flex flex-wrap gap-2">
                {caps.map((cap) => (
                  <button
                    key={cap}
                    type="button"
                    onClick={() => toggleCapability(cap)}
                    aria-pressed={selectedCapabilities.includes(cap)}
                    className={cn(
                      "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                      selectedCapabilities.includes(cap)
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border hover:border-primary/50"
                    )}
                  >
                    {cap}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card className="p-6 space-y-4">
        <div>
          <h2 className="text-lg font-semibold mb-1">Tools</h2>
          <p className="text-xs text-muted-foreground">Available tools this agent can use</p>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          {tools.map((tool: any) => (
            <button
              key={tool.id}
              type="button"
              onClick={() => toggleTool(tool.name)}
              aria-pressed={selectedTools.includes(tool.name)}
              className={cn(
                "rounded-md border px-3 py-2 text-left text-sm transition-colors",
                selectedTools.includes(tool.name)
                  ? "border-primary bg-primary/10"
                  : "border-border hover:border-primary/50"
              )}
            >
              <div className="font-medium">{tool.name}</div>
              <div className="text-xs text-faint">{tool.source}</div>
            </button>
          ))}
        </div>
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          {selectedModels.length === 0
            ? "No models selected — the default model set will be used."
            : `${selectedModels.length} model${selectedModels.length > 1 ? "s" : ""} selected.`}
        </p>
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={() => router.push("/agents")}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={submitting} className="gap-2">
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            Create Agent
          </Button>
        </div>
      </div>
    </div>
  );
}
