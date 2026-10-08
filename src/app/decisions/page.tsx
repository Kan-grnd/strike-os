"use client";

import { useState } from "react";
import { motion } from "motion/react";
import {
  Search,
  BookOpen,
  Brain,
  Calendar,
  Scale,
  Bot,
  Building2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader, SectionLabel, EASE } from "@/components/shared/page-header";
import { useDecisions } from "@/hooks/useApi";

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

export default function DecisionsPage() {
  const [search, setSearch] = useState("");
  const { data, isLoading } = useDecisions(search ? { q: search } : undefined);

  const decisions = data?.decisions || [];

  return (
    <div className="mx-auto max-w-[1100px] space-y-6">
      <PageHeader
        backHref="/"
        icon={Scale}
        eyebrow="Intelligence"
        title="Decisions"
        description="Recorded decisions and their reasoning across the workforce."
        actions={
          <Button className="gap-2">
            <BookOpen className="h-4 w-4" /> Log decision
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border bg-border lg:grid-cols-4">
        <Stat icon={Scale} label="Total" value={decisions.length} />
        <Stat
          icon={Building2}
          label="Global"
          value={decisions.filter((d: any) => d.scope === "GLOBAL").length}
        />
        <Stat
          icon={Bot}
          label="Agent-logged"
          value={decisions.filter((d: any) => d.agentId).length}
        />
        <Stat
          icon={Brain}
          label="Architect"
          value={decisions.filter((d) => !d.agentId).length}
        />
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" />
        <Input
          placeholder="Search decisions…"
          aria-label="Search decisions"
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

      <section className="space-y-3">
        <SectionLabel>Decision log · {decisions.length}</SectionLabel>

        {isLoading ? (
          <div className="space-y-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="animate-pulse rounded-xl border bg-card p-4">
                <div className="h-4 w-2/3 rounded bg-muted" />
                <div className="mt-2 h-3 w-full rounded bg-muted" />
                <div className="mt-2 h-3 w-1/2 rounded bg-muted" />
              </div>
            ))}
          </div>
        ) : decisions.length === 0 ? (
          <EmptyState
            icon={Scale}
            title="No decisions recorded yet"
            description="Decisions made by the workforce and the architect will appear here."
          />
        ) : (
          <div className="space-y-3">
            {decisions.map((d, i) => {
              const confidence =
                d.confidence != null ? Math.round(d.confidence * 100) : null;
              const isAgent = Boolean(d.agentId);
              return (
                <motion.article
                  key={d.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{
                    duration: 0.35,
                    delay: Math.min(i * 0.04, 0.4),
                    ease: EASE,
                  }}
                  className="group rounded-xl border bg-card p-4 transition-colors hover:border-ring/40"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium leading-snug">{d.content}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {d.subjectId ? `Ref: ${d.subjectId}` : "Workforce decision"}
                      </p>
                      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                        <span className="inline-flex items-center gap-1.5">
                          <Calendar className="h-3.5 w-3.5" />
                          {new Date(d.createdAt).toLocaleDateString()}
                        </span>
                        <span className="inline-flex items-center gap-1.5">
                          {isAgent ? (
                            <Bot className="h-3.5 w-3.5" />
                          ) : (
                            <Brain className="h-3.5 w-3.5" />
                          )}
                          {isAgent ? "Agent" : "Architect"}
                        </span>
                        <span className="tabular-nums">
                          Confidence{" "}
                          <span className="font-medium text-foreground">
                            {confidence != null ? `${confidence}%` : "—"}
                          </span>
                        </span>
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-2">
                      <Badge variant={d.scope === "GLOBAL" ? "default" : "outline"}>
                        {d.scope}
                      </Badge>
                    </div>
                  </div>
                </motion.article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}