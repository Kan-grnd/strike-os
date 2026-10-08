"use client";

import * as React from "react";
import Link from "next/link";
import { motion } from "motion/react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Brain,
  Target,
  Eye,
  Users,
  Wrench,
  Cpu,
  ChevronRight,
  type LucideIcon,
} from "lucide-react";
import { cn, safeJsonArray } from "@/lib/utils";
import { AGENT_TYPE_COLOR, ATTENTION_STATES } from "@/lib/agent-meta";
import { StateDot } from "@/components/shared/state-dot";

const EASE = [0.16, 1, 0.3, 1] as const;

const TYPE_ICON: Record<string, LucideIcon> = {
  ARCHITECT: Brain,
  PLANNER: Target,
  OBSERVER: Eye,
};

export function AgentCard({
  agent,
  index = 0,
}: {
  agent: any;
  index?: number;
}) {
  const caps = safeJsonArray(agent.capabilities);
  const toolIds = safeJsonArray(agent.tools);
  const modelIds = safeJsonArray(agent.models);
  const needsAttention = ATTENTION_STATES.has(agent.runtimeState);
  const Icon = TYPE_ICON[agent.type] || Users;
  const success =
    typeof agent.successRate === "number" ? Math.min(100, agent.successRate) : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay: Math.min(index * 0.05, 0.4), ease: EASE }}
    >
      <Link href={`/agents/${agent.id}`} className="block h-full">
        <Card className="group relative flex h-full flex-col gap-4 overflow-hidden p-5 transition-colors hover:border-ring/40">
          <div
            aria-hidden
            className={cn(
              "pointer-events-none absolute -right-10 -top-10 h-24 w-24 rounded-full opacity-0 blur-2xl transition-opacity duration-500 group-hover:opacity-100",
              needsAttention ? "bg-warning/25" : "bg-primary/15"
            )}
          />
          <div className="relative flex items-start justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div
                className={cn(
                  "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border bg-card",
                  AGENT_TYPE_COLOR[agent.type] || "border-primary/40 text-primary"
                )}
              >
                <Icon className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <StateDot state={agent.runtimeState} />
                  <h3 className="truncate font-semibold">{agent.name}</h3>
                </div>
                <p className="mt-0.5 font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                  {agent.type}
                </p>
              </div>
            </div>
            <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground/40 transition-colors group-hover:text-foreground" />
          </div>

          <p className="line-clamp-2 min-h-[2.5rem] text-sm text-muted-foreground">
            {agent.description || "No description provided."}
          </p>

          <div className="flex flex-wrap items-center gap-1.5">
            {agent.status && (
              <Badge variant="outline" className="font-mono text-[11px] uppercase">
                {agent.status}
              </Badge>
            )}
            {needsAttention && (
              <Badge
                variant="outline"
                className="border-warning/40 font-mono text-[11px] text-warning"
              >
                attention
              </Badge>
            )}
            {caps.slice(0, 2).map((c) => (
              <Badge key={c} variant="secondary" className="font-mono text-[11px]">
                {c}
              </Badge>
            ))}
            {caps.length > 2 && (
              <Badge variant="secondary" className="font-mono text-[11px]">
                +{caps.length - 2}
              </Badge>
            )}
          </div>

          <div className="mt-auto flex items-center justify-between border-t pt-3 text-[11px] text-muted-foreground">
            <span className="flex items-center gap-3">
              <span className="flex items-center gap-1">
                <Target className="h-3 w-3" />
                {caps.length}
              </span>
              <span className="flex items-center gap-1">
                <Wrench className="h-3 w-3" />
                {toolIds.length}
              </span>
              <span className="flex items-center gap-1">
                <Cpu className="h-3 w-3" />
                {modelIds.length}
              </span>
            </span>
            {agent.successRate != null && (
              <span className="font-mono tabular-nums">
                {agent.tasksCompleted ?? 0} tasks · {agent.successRate}%
              </span>
            )}
          </div>
        </Card>
      </Link>
    </motion.div>
  );
}