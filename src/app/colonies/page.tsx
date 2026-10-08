"use client";

import { useState } from "react";
import Link from "next/link";
import { motion } from "motion/react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Boxes,
  Users,
  Plus,
  Loader2,
  RotateCcw,
  AlertCircle,
  CheckCircle2,
  ArrowUpRight,
} from "lucide-react";
import { useColonies, createColony } from "@/hooks/useApi";
import { ATTENTION_STATES } from "@/lib/agent-meta";
import { PageHeader, SectionLabel } from "@/components/shared/page-header";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";

const EASE = [0.16, 1, 0.3, 1] as const;

export default function ColoniesPage() {
  const { data, isLoading, error, mutate } = useColonies();
  const colonies = data?.colonies || [];

  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formMsg, setFormMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const handleCreate = async () => {
    if (!name.trim()) {
      setFormMsg({ ok: false, text: "Colony name is required." });
      return;
    }
    setSubmitting(true);
    setFormMsg(null);
    try {
      const res = await createColony({ name: name.trim(), description: description.trim() });
      if (res.error) {
        setFormMsg({ ok: false, text: res.error });
      } else {
        setFormMsg({ ok: true, text: `Colony "${res.colony?.name ?? name}" created.` });
        setName("");
        setDescription("");
        setCreating(false);
        mutate();
      }
    } catch (err: any) {
      setFormMsg({ ok: false, text: err.message ?? "Failed to create colony" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-[1400px] space-y-6">
      <PageHeader
        eyebrow="Workforce"
        icon={Boxes}
        title="Colonies"
        description="Logical groupings of agents in your workforce."
        actions={
          <Button
            className="gap-2"
            onClick={() => {
              setFormMsg(null);
              setCreating((c) => !c);
            }}
          >
            <Plus className="h-4 w-4" />
            {creating ? "Cancel" : "New Colony"}
          </Button>
        }
      />

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <KpiCard
          index={0}
          icon={Boxes}
          label="Colonies"
          value={colonies.length}
          caption="Organizational units"
        />
        <KpiCard
          index={1}
          icon={Users}
          label="Agents assigned"
          value={colonies.reduce((s: number, c: any) => s + c.agents.length, 0)}
          caption="Across all colonies"
          accent="hsl(var(--primary) / 0.4)"
        />
        <KpiCard
          index={2}
          icon={AlertCircle}
          label="Needs attention"
          value={colonies.reduce(
            (s: number, c: any) =>
              s + c.agents.filter((a: any) => ATTENTION_STATES.has(a.runtimeState)).length,
            0
          )}
          caption="Agents blocked or failing"
          accent="hsl(var(--warning) / 0.4)"
        />
      </section>

      {formMsg && (
        <p
          className={
            formMsg.ok ? "text-sm text-success" : "text-sm text-destructive"
          }
        >
          {formMsg.text}
        </p>
      )}

      {creating && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          transition={{ duration: 0.3, ease: EASE }}
        >
          <Card className="space-y-4 p-5">
            <div>
              <h2 className="text-sm font-semibold">New Colony</h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Create a new grouping for agents.
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="text-sm font-medium" htmlFor="colony-name">
                  Colony Name
                </label>
                <Input
                  id="colony-name"
                  placeholder="e.g. Research Division"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="mt-2"
                />
              </div>
              <div>
                <label
                  className="text-sm font-medium"
                  htmlFor="colony-description"
                >
                  Description
                </label>
                <Input
                  id="colony-description"
                  placeholder="What does this colony focus on?"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="mt-2"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setCreating(false);
                  setFormMsg(null);
                }}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                className="gap-2"
                onClick={handleCreate}
                disabled={submitting}
              >
                {submitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-4 w-4" />
                )}
                Create Colony
              </Button>
            </div>
          </Card>
        </motion.div>
      )}

      {error && (
        <Card className="p-8 text-center">
          <AlertCircle className="mx-auto mb-3 h-10 w-10 text-destructive" />
          <p className="text-lg font-medium">Couldn't load colonies</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Something went wrong fetching your colonies.
          </p>
          <Button variant="outline" className="mt-4 gap-2" onClick={() => mutate()}>
            <RotateCcw className="h-4 w-4" /> Retry
          </Button>
        </Card>
      )}

      {!error && isLoading && colonies.length === 0 && (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i} className="h-48 animate-pulse bg-muted/40" />
          ))}
        </div>
      )}

      {!error && !isLoading && colonies.length === 0 && (
        <EmptyState
          icon={Boxes}
          title="No colonies yet"
          description="Create colonies to organize your agents into teams."
          cta="New Colony"
          className="py-16"
        />
      )}

      {!error && colonies.length > 0 && (
        <>
          <SectionLabel>{colonies.length} colonies</SectionLabel>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {colonies.map((colony: any, i: number) => {
              const runningCount = colony.agents.filter(
                (a: any) => a.status === "RUNNING"
              ).length;
              const idleCount = colony.agents.filter(
                (a: any) => a.status === "IDLE"
              ).length;
              const attentionCount = colony.agents.filter((a: any) =>
                ATTENTION_STATES.has(a.runtimeState)
              ).length;
              return (
                <motion.div
                  key={colony.id}
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{
                    duration: 0.45,
                    delay: Math.min(i * 0.05, 0.4),
                    ease: EASE,
                  }}
                >
                  <Card className="group flex h-full flex-col gap-4 p-5 transition-colors hover:border-ring/40">
                    <div className="flex items-start justify-between">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl border bg-card">
                        <Boxes className="h-5 w-5 text-muted-foreground" />
                      </div>
                      <Badge variant="outline" className="font-mono text-[10px]">
                        {colony.agents.length} agents
                      </Badge>
                    </div>
                    <div>
                      <h3 className="font-semibold text-lg">{colony.name}</h3>
                      <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                        {colony.description || "No description."}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                      <span className="flex items-center gap-1.5">
                        <span className="h-1.5 w-1.5 rounded-full bg-success" />
                        {runningCount} running
                      </span>
                      <span className="flex items-center gap-1.5">
                        <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground" />
                        {idleCount} idle
                      </span>
                      {attentionCount > 0 && (
                        <span className="flex items-center gap-1.5">
                          <span className="h-1.5 w-1.5 rounded-full bg-warning" />
                          {attentionCount} need{attentionCount === 1 ? "s" : ""} attention
                        </span>
                      )}
                    </div>
                    <Link
                      href={`/agents?colonyId=${colony.id}`}
                      className="mt-auto inline-flex items-center justify-between rounded-lg border px-3 py-2 text-sm transition-colors hover:bg-accent"
                    >
                      <span className="flex items-center gap-2">
                        <Users className="h-3.5 w-3.5" />
                        View Agents
                      </span>
                      <ArrowUpRight
                        className={cn(
                          "h-3.5 w-3.5 text-muted-foreground transition-transform",
                          "group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
                        )}
                      />
                    </Link>
                  </Card>
                </motion.div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}