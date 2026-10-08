"use client";

import { useState } from "react";
import useSWR from "swr";
import { motion } from "motion/react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader, EASE } from "@/components/shared/page-header";
import { Cpu, Search, Server, Braces, Layers, X } from "lucide-react";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

function Stat({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number | string;
}) {
  return (
    <div className="bg-background p-4">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
        <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.16em]">
          {label}
        </span>
      </div>
      <div className="mt-1 text-2xl font-bold tabular-nums">{value}</div>
    </div>
  );
}

export default function ModelsPage() {
  const { data } = useSWR("/api/models", fetcher);
  const [search, setSearch] = useState("");
  const [providerFilter, setProviderFilter] = useState("");

  const allModels: any[] = data?.models || [];

  const models = allModels
    .filter(
      (m: any) =>
        !search ||
        m.name.toLowerCase().includes(search.toLowerCase()) ||
        (m.capabilities &&
          JSON.parse(m.capabilities || "[]").some((c: string) =>
            c.includes(search)
          ))
    )
    .filter((m: any) => !providerFilter || m.provider?.name === providerFilter);

  const providers = Array.from(
    new Set(allModels.map((m: any) => m.provider?.name).filter(Boolean))
  ) as string[];

  const capabilityCount = new Set(
    allModels.flatMap((m: any) => JSON.parse(m.capabilities || "[]"))
  ).size;

  return (
    <div className="mx-auto max-w-[1400px] space-y-6">
      <PageHeader
        backHref="/"
        icon={Cpu}
        eyebrow="Registry"
        title="Models"
        description="Model registry — capabilities, pricing, and routing."
      />

      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border bg-border lg:grid-cols-4">
        <Stat icon={Cpu} label="Models" value={allModels.length} />
        <Stat icon={Server} label="Providers" value={providers.length} />
        <Stat icon={Braces} label="Capabilities" value={capabilityCount} />
        <Stat
          icon={Layers}
          label="Max context"
          value={
            allModels.length
              ? Math.max(...allModels.map((m: any) => m.contextWindow || 0)).toLocaleString()
              : "—"
          }
        />
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" />
          <Input
            placeholder="Search models…"
            aria-label="Search models"
            className="pl-9 pr-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              aria-label="Clear search"
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <Select
          value={providerFilter || "all"}
          onValueChange={(v) => setProviderFilter(v === "all" ? "" : v)}
        >
          <SelectTrigger className="w-[180px]" aria-label="Filter by provider">
            <SelectValue placeholder="Provider" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All providers</SelectItem>
            {providers.map((p) => (
              <SelectItem key={p} value={p}>
                {p}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {models.length === 0 ? (
        <EmptyState
          icon={Cpu}
          title="No models match"
          description="Adjust the search or provider filter to see the registry."
        />
      ) : (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {models.map((m: any, i: number) => {
            const caps = JSON.parse(m.capabilities || "[]") as string[];
            return (
              <motion.div
                key={m.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, delay: Math.min(i * 0.04, 0.4), ease: EASE }}
              >
                <Card className="flex h-full flex-col p-5 transition-colors hover:border-ring/40">
                  <div className="mb-2 flex items-start justify-between">
                    <div className="rounded-md bg-muted p-2">
                      <Cpu className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <Badge variant="outline">{m.provider?.name || "Unknown"}</Badge>
                  </div>
                  <h2 className="font-semibold">{m.name}</h2>
                  <p className="text-xs text-muted-foreground">
                    {m.contextWindow.toLocaleString()} context window
                  </p>
                  <div className="my-3 flex flex-wrap gap-1">
                    {caps.slice(0, 3).map((c) => (
                      <Badge key={c} variant="outline" className="text-[11px]">
                        {c}
                      </Badge>
                    ))}
                    {caps.length > 3 && (
                      <Badge variant="outline" className="text-[11px] text-muted-foreground">
                        +{caps.length - 3}
                      </Badge>
                    )}
                  </div>
                  <div className="mt-auto border-t pt-3 font-mono text-xs text-muted-foreground">
                    ${(m.costPer1KInput || 0)?.toFixed(2)}/1K in · $
                    {(m.costPer1KOutput || 0)?.toFixed(2)}/1K out
                  </div>
                </Card>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}