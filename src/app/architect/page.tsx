"use client";

import { useState } from "react";
import useSWR from "swr";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Sparkles,
  Loader2,
  CheckCircle2,
  XCircle,
  Play,
  RotateCcw,
  ShieldCheck,
  Target,
  Wrench,
  Rocket,
} from "lucide-react";
import { cn, safeJson, safeJsonArray } from "@/lib/utils";
import { CAPABILITY_CATALOG } from "@/lib/capabilities";
import { PageHeader, SectionLabel } from "@/components/shared/page-header";

const EASE = [0.16, 1, 0.3, 1] as const;

const fetcher = (url: string) => fetch(url).then((r) => r.json());

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
    <div className="mx-auto max-w-[1400px] space-y-6">
      <PageHeader
        eyebrow="Workforce"
        icon={Sparkles}
        title="Agent Architect"
        description="Compose an agent from capabilities and tools — or deploy a ready-made template."
      />

      {(result || forgeMsg) && (
        <div className="space-y-3">
          {result && (
            <Card
              className={cn(
                "flex items-center gap-3 p-4",
                result.ok
                  ? "border-success/40 bg-success/5"
                  : "border-destructive/40 bg-destructive/5"
              )}
            >
              {result.ok ? (
                <CheckCircle2 className="h-5 w-5 shrink-0 text-success" />
              ) : (
                <XCircle className="h-5 w-5 shrink-0 text-destructive" />
              )}
              <p className="text-sm">
                {result.ok
                  ? `Agent "${result.agent?.name ?? name}" created — opening it now.`
                  : result.error}
              </p>
            </Card>
          )}
          {forgeMsg && (
            <Card
              className={cn(
                "flex items-center gap-2 p-4 text-sm",
                forgeMsg.ok
                  ? "border-success/40 bg-success/5"
                  : "border-destructive/40 bg-destructive/5"
              )}
            >
              {forgeMsg.ok ? (
                <CheckCircle2 className="h-4 w-4 shrink-0 text-success" />
              ) : (
                <XCircle className="h-4 w-4 shrink-0 text-destructive" />
              )}
              {forgeMsg.text}
            </Card>
          )}
        </div>
      )}

      {/* ── Specialists / templates ──────────────────────────────────── */}
      <section className="space-y-4">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-muted-foreground" />
          <SectionLabel>Specialist templates</SectionLabel>
          <Badge variant="secondary" className="font-mono text-[11px]">
            {specialistBundles.length}
          </Badge>
        </div>
        {specialistBundles.length === 0 ? (
          <Card className="p-8 text-center text-sm text-muted-foreground">
            No templates installed.
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {specialistBundles.map((bundle: any, i: number) => {
              const install = specialistInstalls[bundle.id];
              const state = !install
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
                <motion.div
                  key={bundle.id}
                  data-testid={`forge-${bundle.id}`}
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.45, delay: Math.min(i * 0.05, 0.35), ease: EASE }}
                >
                  <Card className="flex h-full flex-col gap-3 p-5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h3 className="truncate font-semibold">{bundle.label}</h3>
                        <p className="mt-0.5 font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                          {bundle.agentType}
                        </p>
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
                        className="shrink-0 font-mono text-[11px]"
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
                    <p className="line-clamp-2 text-sm text-muted-foreground">
                      {bundle.description}
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {bundle.capabilities.slice(0, 3).map((c: string) => (
                        <Badge key={c} variant="secondary" className="font-mono text-[11px]">
                          {c}
                        </Badge>
                      ))}
                      {bundle.toolNames.slice(0, 2).map((t: string) => (
                        <Badge key={t} variant="outline" className="font-mono text-[11px]">
                          {t}
                        </Badge>
                      ))}
                    </div>
                    {lastTrial && (
                      <p className="flex items-center gap-1 text-[11px] text-muted-foreground">
                        {lastTrial.verdict === "PASS" ? (
                          <CheckCircle2 className="h-3.5 w-3.5 text-success" />
                        ) : (
                          <XCircle className="h-3.5 w-3.5 text-destructive" />
                        )}
                        <span className="font-mono">
                          {lastTrial.verdict} · {((lastTrial.durationMs ?? 0) / 1000).toFixed(1)}s
                          {lastTrial.cost != null ? ` · $${Number(lastTrial.cost).toFixed(4)}` : ""}
                        </span>
                      </p>
                    )}
                    <div className="mt-auto flex flex-wrap gap-2 pt-1">
                      <Button
                        size="sm"
                        variant="outline"
                        data-testid={`template-${bundle.id}`}
                        onClick={() => applyBundle(bundle)}
                        disabled={!!deployingId || !!trialingId}
                      >
                        Use template
                      </Button>
                      {!install ? (
                        <Button
                          size="sm"
                          className="gap-1.5"
                          data-testid={`deploy-${bundle.id}`}
                          onClick={() => deployBundle(bundle)}
                          disabled={!!deployingId || !!trialingId}
                        >
                          {deployingId === bundle.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Rocket className="h-3.5 w-3.5" />
                          )}
                          Deploy
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant={state === "paused" ? "outline" : "default"}
                          className="gap-1.5"
                          data-testid={`trial-${bundle.id}`}
                          onClick={() => trialBundle(bundle)}
                          disabled={!!deployingId || !!trialingId}
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
                  </Card>
                </motion.div>
              );
            })}
          </div>
        )}
      </section>

      {/* ── Builder ──────────────────────────────────────────────────── */}
      <section className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-6">
          <Card className="space-y-4 p-6">
            <div>
              <label className="text-sm font-medium" htmlFor="agent-name">
                Agent name
              </label>
              <Input
                id="agent-name"
                placeholder="e.g. Competitive Intel Analyst"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-2"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium" htmlFor="agent-type">
                  Type
                </label>
                <select
                  id="agent-type"
                  className="mt-2 w-full rounded-xl border bg-background px-3 py-2 text-sm h-10"
                  value={type}
                  onChange={(e) => setType(e.target.value)}
                >
                  <option value="WORKER">Worker</option>
                  <option value="SPECIALIST">Specialist</option>
                  <option value="OBSERVER">Observer</option>
                  <option value="EVALUATOR">Evaluator</option>
                </select>
              </div>
              <div>
                <label className="text-sm font-medium" htmlFor="agent-colony">
                  Colony
                </label>
                <select
                  id="agent-colony"
                  className="mt-2 w-full rounded-xl border bg-background px-3 py-2 text-sm h-10"
                  value={colonyId}
                  onChange={(e) => setColonyId(e.target.value)}
                >
                  <option value="">— None —</option>
                  {colonies.map((c: any) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </Card>

          <Card className="space-y-4 p-6">
            <div className="flex items-center gap-2">
              <Target className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold">Capabilities</h2>
              <Badge variant="secondary" className="font-mono text-[11px]">
                {selectedCapabilities.length} selected
              </Badge>
            </div>
            <div className="space-y-4">
              {Object.entries(CAPABILITY_CATALOG).map(([category, caps]) => (
                <div key={category}>
                  <p className="mb-2 font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                    {category}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {caps.map((cap) => {
                      const on = selectedCapabilities.includes(cap);
                      return (
                        <button
                          key={cap}
                          type="button"
                          onClick={() => toggleCapability(cap)}
                          aria-pressed={on}
                          className={cn(
                            "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                            on
                              ? "border-primary bg-primary text-primary-foreground"
                              : "border-border hover:border-primary/50"
                          )}
                        >
                          {cap}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card className="space-y-4 p-6">
            <div className="flex items-center gap-2">
              <Wrench className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold">Tools</h2>
              <Badge variant="secondary" className="font-mono text-[11px]">
                {selectedTools.length} selected
              </Badge>
            </div>
            {tools.length === 0 ? (
              <p className="text-sm text-muted-foreground">No tools registered.</p>
            ) : (
              <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
                {tools.map((tool: any) => {
                  const on = selectedTools.includes(tool.name);
                  return (
                    <button
                      key={tool.id}
                      type="button"
                      onClick={() => toggleTool(tool.name)}
                      aria-pressed={on}
                      className={cn(
                        "rounded-xl border px-3 py-2 text-left text-sm transition-colors",
                        on
                          ? "border-primary bg-primary/10"
                          : "border-border hover:border-primary/50"
                      )}
                    >
                      <div className="font-medium">{tool.name}</div>
                      <div className="text-xs text-muted-foreground">{tool.source}</div>
                    </button>
                  );
                })}
              </div>
            )}
          </Card>
        </div>

        {/* ── Summary rail ───────────────────────────────────────────── */}
        <div className="lg:sticky lg:top-6 lg:self-start">
          <Card className="space-y-5 p-6">
            <div>
              <SectionLabel>Blueprint</SectionLabel>
              <p className="mt-2 text-lg font-semibold">
                {name || "Untitled agent"}
              </p>
              <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                {type}
                {colonyId
                  ? ` · ${colonies.find((c: any) => c.id === colonyId)?.name ?? ""}`
                  : " · no colony"}
              </p>
            </div>
            <div className="space-y-2 border-t pt-4 text-sm">
              <SummaryRow label="Capabilities" value={selectedCapabilities.length} />
              <SummaryRow label="Tools" value={selectedTools.length} />
              <SummaryRow
                label="Models"
                value={selectedModels.length === 0 ? "default" : selectedModels.length}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              {selectedCapabilities.length === 0
                ? "Add at least one capability to create the agent."
                : "Ready to create."}
            </p>
            <div className="flex flex-col gap-2">
              <Button
                onClick={handleSubmit}
                disabled={submitting || !name || selectedCapabilities.length === 0}
                className="gap-2"
              >
                {submitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4" />
                )}
                Create Agent
              </Button>
              <Button variant="ghost" onClick={() => router.push("/agents")}>
                Cancel
              </Button>
            </div>
          </Card>
        </div>
      </section>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-mono tabular-nums">{value}</span>
    </div>
  );
}