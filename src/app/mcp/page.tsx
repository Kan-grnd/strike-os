"use client";

import useSWR from "swr";
import { motion } from "motion/react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader, EASE } from "@/components/shared/page-header";
import { Plug, Play, RefreshCw, Plus, Wrench, CircleCheck, CircleDashed } from "lucide-react";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

const STATUS_META: Record<string, { className: string }> = {
  CONNECTED: { className: "bg-success/15 text-success border-success/30" },
  DISCONNECTED: { className: "bg-muted text-muted-foreground border-border" },
  ERROR: { className: "bg-destructive/15 text-destructive border-destructive/30" },
  PENDING: { className: "bg-warning/15 text-warning border-warning/30" },
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
        <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.16em]">
          {label}
        </span>
      </div>
      <div className="mt-1 text-2xl font-bold tabular-nums">{value}</div>
    </div>
  );
}

export default function McpPage() {
  const { data } = useSWR("/api/mcp", fetcher);
  const connections = data?.connections || [];

  const totalTools = connections.reduce((sum: number, c: any) => {
    try {
      return sum + (JSON.parse(c.tools || "[]") as string[]).length;
    } catch {
      return sum;
    }
  }, 0);

  return (
    <div className="mx-auto max-w-[1400px] space-y-6">
      <PageHeader
        backHref="/"
        icon={Plug}
        eyebrow="Integrations"
        title="MCP"
        description="Model Context Protocol servers that extend workforce capabilities."
        actions={
          <Button className="gap-2">
            <Plus className="h-4 w-4" /> Add connection
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border bg-border lg:grid-cols-4">
        <Stat icon={Plug} label="Connections" value={connections.length} />
        <Stat
          icon={CircleCheck}
          label="Connected"
          value={connections.filter((c: any) => c.status === "CONNECTED").length}
        />
        <Stat icon={Wrench} label="Tools" value={totalTools} />
        <Stat
          icon={CircleDashed}
          label="Needs attention"
          value={connections.filter((c: any) => c.status === "ERROR" || c.status === "PENDING").length}
        />
      </div>

      {connections.length === 0 ? (
        <EmptyState
          icon={Plug}
          title="No MCP connections yet"
          description="Add an MCP server to extend your workforce's capabilities."
          action={
            <Button className="gap-2">
              <Plus className="h-4 w-4" /> Add connection
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {connections.map((c: any, i: number) => {
            let tools: string[] = [];
            try {
              tools = JSON.parse(c.tools || "[]");
            } catch {
              tools = [];
            }
            const meta = STATUS_META[c.status] || STATUS_META.DISCONNECTED;
            return (
              <motion.div
                key={c.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, delay: Math.min(i * 0.05, 0.4), ease: EASE }}
              >
                <Card className="flex h-full flex-col p-5 transition-colors hover:border-ring/40">
                  <div className="mb-3 flex items-start justify-between">
                    <div className="rounded-md bg-muted p-2">
                      <Plug className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <Badge className={`border ${meta.className}`}>{c.status}</Badge>
                  </div>
                  <h2 className="mb-1 font-semibold">{c.name}</h2>
                  <p className="mb-3 truncate font-mono text-xs text-muted-foreground">
                    {c.baseUrl}
                  </p>
                  <div className="mb-3 flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1">
                      <Wrench className="h-3 w-3" /> {tools.length} tools
                    </span>
                  </div>
                  <div className="mt-auto flex gap-2 border-t pt-3">
                    <Button size="sm" variant="outline" className="flex-1 gap-1">
                      <Play className="h-3.5 w-3.5" /> Test
                    </Button>
                    <Button size="sm" variant="outline" className="flex-1 gap-1">
                      <RefreshCw className="h-3.5 w-3.5" /> Sync tools
                    </Button>
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