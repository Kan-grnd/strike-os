"use client";

import Link from "next/link";
import useSWR from "swr";
import { motion } from "motion/react";
import { Card } from "@/components/ui/card";
import { Badge, badgeVariants } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Target, RotateCcw, AlertCircle, Layers, CheckCircle2 } from "lucide-react";
import { CAPABILITY_CATALOG } from "@/lib/capabilities";
import { cn, safeJsonArray } from "@/lib/utils";
import { PageHeader, SectionLabel } from "@/components/shared/page-header";
import { KpiCard } from "@/components/dashboard/kpi-card";

const EASE = [0.16, 1, 0.3, 1] as const;

const fetcher = (url: string) =>
  fetch(url).then((r) => {
    if (!r.ok) throw new Error(`Request failed: ${r.status}`);
    return r.json();
  });

export default function CapabilitiesPage() {
  const { data, isLoading, error, mutate } = useSWR("/api/agents", fetcher);
  const agents = data?.agents || [];

  const capabilityAgents: Record<string, any[]> = {};
  agents.forEach((a: any) => {
    const caps = safeJsonArray(a.capabilities);
    caps.forEach((c) => {
      if (!capabilityAgents[c]) capabilityAgents[c] = [];
      capabilityAgents[c].push(a);
    });
  });

  const allCaps = Object.values(CAPABILITY_CATALOG).flat();
  const covered = allCaps.filter((cap) => (capabilityAgents[cap] || []).length > 0);
  const gaps = allCaps.length - covered.length;

  return (
    <div className="mx-auto max-w-[1400px] space-y-6">
      <PageHeader
        eyebrow="Workforce"
        icon={Target}
        title="Capabilities"
        description="Registry of capabilities and the agents that provide them."
      />

      <section className="grid gap-4 sm:grid-cols-3">
        <KpiCard
          index={0}
          icon={Layers}
          label="Capabilities"
          value={allCaps.length}
          caption={`${Object.keys(CAPABILITY_CATALOG).length} categories`}
        />
        <KpiCard
          index={1}
          icon={CheckCircle2}
          label="Covered"
          value={covered.length}
          caption="At least one agent provides these"
          accent="hsl(var(--success) / 0.4)"
        />
        <KpiCard
          index={2}
          icon={AlertCircle}
          label="Gaps"
          value={gaps}
          caption={gaps > 0 ? "No agent provides these yet" : "Full coverage"}
          accent="hsl(var(--warning) / 0.4)"
        />
      </section>

      {error && (
        <Card className="p-8 text-center">
          <AlertCircle className="mx-auto mb-3 h-10 w-10 text-destructive" />
          <p className="text-lg font-medium">Couldn't load capabilities</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Something went wrong fetching the workforce registry.
          </p>
          <Button variant="outline" className="mt-4 gap-2" onClick={() => mutate()}>
            <RotateCcw className="h-4 w-4" /> Retry
          </Button>
        </Card>
      )}

      {!error && isLoading && agents.length === 0 && (
        <div className="grid gap-3 md:grid-cols-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="h-24 animate-pulse bg-muted/40" />
          ))}
        </div>
      )}

      {!error && (
        <div className="space-y-8">
          {Object.entries(CAPABILITY_CATALOG).map(([category, caps], ci) => (
            <section key={category} className="space-y-3">
              <SectionLabel>{category}</SectionLabel>
              <div className="grid gap-3 md:grid-cols-2">
                {caps.map((cap, i) => {
                  const providers = capabilityAgents[cap] || [];
                  const empty = providers.length === 0;
                  return (
                    <motion.div
                      key={cap}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{
                        duration: 0.35,
                        delay: Math.min(ci * 0.03 + i * 0.02, 0.3),
                        ease: EASE,
                      }}
                    >
                      <Card className="flex h-full items-start gap-3 p-4 transition-colors hover:border-ring/40">
                        <div
                          className={cn(
                            "shrink-0 rounded-xl border p-2",
                            empty
                              ? "border-warning/40 text-warning"
                              : "text-muted-foreground"
                          )}
                        >
                          <Target className="h-4 w-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-mono text-sm font-medium">{cap}</p>
                          {!isLoading && (
                            <p className="mt-1 text-xs text-muted-foreground">
                              {empty ? (
                                <span className="text-warning">
                                  No agent provides this yet
                                </span>
                              ) : (
                                <>
                                  {providers.length} agent
                                  {providers.length > 1 ? "s" : ""} provide
                                  {providers.length === 1 ? "s" : ""} this
                                </>
                              )}
                            </p>
                          )}
                          {providers.length > 0 && (
                            <div className="mt-2 flex flex-wrap gap-1">
                              {providers.slice(0, 3).map((p) => (
                                <Link
                                  key={p.id}
                                  href={`/agents/${p.id}`}
                                  className={cn(
                                    badgeVariants({ variant: "outline" }),
                                    "text-xs transition-colors hover:border-primary/40 hover:text-foreground"
                                  )}
                                >
                                  {p.name}
                                </Link>
                              ))}
                              {providers.length > 3 && (
                                <Badge variant="outline" className="text-xs">
                                  +{providers.length - 3}
                                </Badge>
                              )}
                            </div>
                          )}
                        </div>
                      </Card>
                    </motion.div>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}