"use client";

import { useState } from "react";
import useSWR from "swr";
import Link from "next/link";
import { motion } from "motion/react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader, EASE } from "@/components/shared/page-header";
import { Search, Zap, X } from "lucide-react";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export default function TracesPage() {
  const [filter, setFilter] = useState("");
  const { data, isLoading } = useSWR("/api/observability/traces?limit=50", fetcher);

  const traces = (data?.traces || []).filter(
    (t: any) =>
      !filter ||
      (t.missionId && t.missionId.includes(filter)) ||
      (t.taskId && t.taskId.includes(filter))
  );

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Zap}
        eyebrow="Observability"
        title="Traces"
        description="Execution traces across missions and tasks."
      />

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" />
        <Input
          placeholder="Filter by mission or task ID…"
          aria-label="Filter traces"
          className="pl-9 pr-9"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
        {filter && (
          <button
            type="button"
            onClick={() => setFilter("")}
            aria-label="Clear search"
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {isLoading ? (
        <div className="grid gap-3">
          {[0, 1, 2].map((i) => (
            <Card key={i} className="animate-pulse p-4">
              <div className="h-4 w-1/3 rounded bg-muted" />
              <div className="mt-2 h-3 w-1/2 rounded bg-muted" />
            </Card>
          ))}
        </div>
      ) : traces.length ? (
        <div className="grid gap-3">
          {traces.map((t: any, i: number) => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: Math.min(i * 0.03, 0.3), ease: EASE }}
            >
              <Link href={`/observability/traces/${t.id}`} className="block">
                <Card className="p-4 transition-colors hover:border-ring/40">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex min-w-0 items-start gap-3">
                      <div className="shrink-0 rounded-xl bg-muted p-2">
                        <Zap className="h-5 w-5 text-primary" />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate font-mono text-sm">
                          Trace {t.id.slice(0, 12)}
                        </p>
                        <p className="truncate font-mono text-xs text-muted-foreground">
                          {t.missionId ? `Mission ${t.missionId.slice(0, 8)}` : "—"} ·{" "}
                          {t.taskId ? `Task ${t.taskId.slice(0, 8)}` : "—"}
                        </p>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-4 text-xs tabular-nums text-muted-foreground">
                      <span>{t.duration ? `${t.duration}ms` : "—"}</span>
                      <span>${t.cost ? t.cost.toFixed(4) : "0"}</span>
                      <span className="hidden sm:inline">
                        {new Date(t.createdAt).toLocaleString()}
                      </span>
                    </div>
                  </div>
                </Card>
              </Link>
            </motion.div>
          ))}
        </div>
      ) : (
        <EmptyState
          icon={Zap}
          title="No traces found"
          description="Execution traces appear here as the workforce runs."
        />
      )}
    </div>
  );
}