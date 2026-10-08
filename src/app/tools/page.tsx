"use client";

import { useState } from "react";
import useSWR from "swr";
import { motion } from "motion/react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { cn } from "@/lib/utils";
import { Search, Wrench, ExternalLink, Play, Layers, HeartPulse, Phone, X } from "lucide-react";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

const sourceBadge: Record<string, { label: string; className: string }> = {
  NATIVE: { label: "Native", className: "bg-primary/20 text-primary" },
  MCP: { label: "MCP", className: "bg-purple/20 text-purple" },
  API: { label: "API", className: "bg-amber/20 text-amber" },
  INTEGRATION: { label: "Integration", className: "bg-emerald/20 text-emerald" },
};

const healthDot: Record<string, string> = {
  healthy: "bg-success",
  degraded: "bg-warning",
  unknown: "bg-muted-foreground",
  error: "bg-destructive",
};

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
        <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em]">
          {label}
        </span>
      </div>
      <div className="mt-1 text-2xl font-bold tabular-nums">{value}</div>
    </div>
  );
}

export default function ToolsPage() {
  const { data } = useSWR("/api/tools", fetcher);
  const [search, setSearch] = useState("");
  const [sourceFilter, setSourceFilter] = useState("");

  const allTools: any[] = data?.tools || [];

  const tools = allTools.filter(
    (t: any) =>
      (!search ||
        t.name.toLowerCase().includes(search.toLowerCase()) ||
        t.description?.toLowerCase().includes(search.toLowerCase())) &&
      (!sourceFilter || t.source === sourceFilter)
  );

  const sources = Array.from(
    new Set(allTools.map((t: any) => t.source))
  ) as string[];

  const totalCalls = allTools.reduce((sum, t) => sum + (t.totalCalls || 0), 0);

  return (
    <div className="mx-auto max-w-[1400px] space-y-6">
      <PageHeader
        backHref="/"
        icon={Wrench}
        eyebrow="Registry"
        title="Tools"
        description="Tool Fabric registry — standardized external actions."
        actions={
          <Button variant="outline" className="gap-2">
            <Wrench className="h-4 w-4" /> Add tool
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border bg-border lg:grid-cols-4">
        <Stat icon={Wrench} label="Tools" value={allTools.length} />
        <Stat icon={Layers} label="Sources" value={sources.length} />
        <Stat
          icon={HeartPulse}
          label="Healthy"
          value={allTools.filter((t) => t.health === "healthy").length}
        />
        <Stat icon={Phone} label="Total calls" value={totalCalls.toLocaleString()} />
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" />
          <Input
            placeholder="Search tools…"
            aria-label="Search tools"
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
          value={sourceFilter || "all"}
          onValueChange={(v) => setSourceFilter(v === "all" ? "" : v)}
        >
          <SelectTrigger className="w-[170px]" aria-label="Filter by source">
            <SelectValue placeholder="Source" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All sources</SelectItem>
            {sources.map((s) => (
              <SelectItem key={s} value={s}>
                {sourceBadge[s]?.label || s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {tools.length ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {tools.map((t: any, i: number) => {
            const sb = sourceBadge[t.source] || { label: t.source, className: "bg-muted" };
            const hc = healthDot[t.health] || "bg-muted-foreground";
            return (
              <motion.div
                key={t.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, delay: Math.min(i * 0.04, 0.4), ease: EASE }}
              >
                <Card className="flex h-full flex-col p-5 transition-colors hover:border-ring/40">
                  <div className="mb-3 flex items-start justify-between">
                    <div className="rounded-md bg-muted p-2">
                      <Wrench className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <Badge className={sb.className}>{sb.label}</Badge>
                  </div>
                  <h3 className="mb-1 font-semibold">{t.name}</h3>
                  <p className="mb-3 line-clamp-2 text-xs text-muted-foreground">
                    {t.description || "No description"}
                  </p>

                  <div className="mb-3 flex items-center justify-between text-xs">
                    <span className="flex items-center gap-1.5 capitalize">
                      <span className={cn("h-1.5 w-1.5 rounded-full", hc)} />
                      {t.health}
                    </span>
                    <span className="tabular-nums text-muted-foreground">
                      ${(t.cost || 0).toFixed(4)} / call
                    </span>
                  </div>

                  <div className="mb-3 flex flex-wrap gap-1">
                    <Badge variant="outline" className="text-[10px]">
                      Timeout: {t.timeout ? `${t.timeout / 1000}s` : "—"}
                    </Badge>
                    <Badge variant="outline" className="text-[10px]">
                      Calls: {t.totalCalls || 0}
                    </Badge>
                  </div>

                  <div className="mt-auto flex gap-2 border-t pt-3">
                    <Button size="sm" variant="outline" className="flex-1 gap-1">
                      <Play className="h-3.5 w-3.5" /> Test
                    </Button>
                    <Button size="sm" variant="outline" className="flex-1 gap-1">
                      <ExternalLink className="h-3.5 w-3.5" /> Schema
                    </Button>
                  </div>
                </Card>
              </motion.div>
            );
          })}
        </div>
      ) : (
        <EmptyState
          icon={Search}
          title="No tools match your filters"
          description="Try a different search term or source."
        />
      )}
    </div>
  );
}