"use client";

import * as React from "react";
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card } from "@/components/ui/card";

const AXIS = "hsl(var(--muted-foreground))";

function PanelHeader({
  title,
  hint,
}: {
  title: string;
  hint?: React.ReactNode;
}) {
  return (
    <div className="mb-4 flex items-baseline justify-between gap-2">
      <h2 className="font-mono text-[11px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
        {title}
      </h2>
      {hint != null && (
        <span className="font-mono text-[11px] text-muted-foreground/70">{hint}</span>
      )}
    </div>
  );
}

/* ── Event throughput over the last 2 hours ───────────────────────────── */
export function ThroughputChart({
  events,
}: {
  events: { timestamp?: string }[];
}) {
  const BUCKET = 5 * 60_000;
  const N = 24;
  const now = Date.now();
  const start = now - N * BUCKET;

  const buckets = React.useMemo(() => {
    const arr = new Array<number>(N).fill(0);
    for (const e of events) {
      const t = Date.parse(e?.timestamp ?? "");
      if (Number.isNaN(t) || t < start || t > now) continue;
      const i = Math.min(N - 1, Math.max(0, Math.floor((t - start) / BUCKET)));
      arr[i]++;
    }
    return arr;
  }, [events, now, start]);

  const data = buckets.map((v, i) => {
    const minsAgo = (N - 1 - i) * 5;
    return {
      label: i === N - 1 ? "now" : i % 6 === 0 ? `-${minsAgo}m` : "",
      events: v,
    };
  });
  const total = buckets.reduce((s, v) => s + v, 0);
  const peak = Math.max(1, ...buckets);

  return (
    <Card className="h-full p-6">
      <PanelHeader
        title="Event throughput"
        hint={`${total} events · peak ${peak}/5m`}
      />
      <div className="h-44 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={data}
            margin={{ top: 4, right: 4, bottom: 0, left: -24 }}
          >
            <defs>
              <linearGradient id="throughput-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.35} />
                <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis
              dataKey="label"
              tick={{ fontSize: 11, fill: AXIS }}
              tickLine={false}
              axisLine={false}
              interval={0}
            />
            <YAxis
              tick={{ fontSize: 11, fill: AXIS }}
              tickLine={false}
              axisLine={false}
              width={40}
              allowDecimals={false}
            />
            <Tooltip
              cursor={{ stroke: "hsl(var(--border))" }}
              contentStyle={{
                background: "hsl(var(--popover))",
                border: "1px solid hsl(var(--border))",
                borderRadius: 8,
                fontSize: 12,
              }}
              labelStyle={{ color: "hsl(var(--muted-foreground))" }}
            />
            <Area
              type="monotone"
              dataKey="events"
              stroke="hsl(var(--primary))"
              strokeWidth={2}
              fill="url(#throughput-fill)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}

/* ── Fleet distribution by runtime state ──────────────────────────────── */
const STATE_ORDER = [
  "executing",
  "planning",
  "thinking",
  "delegating",
  "initializing",
  "retrying",
  "waiting",
  "blocked",
  "waiting_for_approval",
  "paused",
  "idle",
  "completed",
  "failed",
  "cancelled",
];

function stateHex(status: string | undefined): string {
  const T: Record<string, string> = {
    idle: "#a1a1aa",
    initializing: "#38bdf8",
    thinking: "#38bdf8",
    planning: "#2dd4bf",
    executing: "#22d3ee",
    delegating: "#2dd4bf",
    waiting: "#38bdf8",
    blocked: "#fbbf24",
    waiting_for_approval: "#818cf8",
    paused: "#fb923c",
    completed: "#34d399",
    failed: "#f87171",
    cancelled: "#71717a",
    stopped: "#71717a",
  };
  return T[status || ""] ?? "#a1a1aa";
}

export function FleetStateChart({ agents }: { agents: any[] }) {
  const rows = React.useMemo(() => {
    const counts: Record<string, number> = {};
    for (const a of agents) {
      const s = a?.runtimeState || (a?.status ? String(a.status).toLowerCase() : "idle");
      counts[s] = (counts[s] || 0) + 1;
    }
    return Object.entries(counts)
      .map(([state, count]) => ({ state, count }))
      .sort((a, b) => {
        const ia = STATE_ORDER.indexOf(a.state);
        const ib = STATE_ORDER.indexOf(b.state);
        return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib) || b.count - a.count;
      });
  }, [agents]);

  const total = rows.reduce((s, r) => s + r.count, 0);

  /* Decorative donut: R=58 with a 24px stroke reads the same as the old
   * recharts pie (inner 46 / outer 70) but stays out of the accessibility
   * tree — recharts' sectors emitted role="img" without a name. */
  const R = 58;
  const C = 2 * Math.PI * R;
  let acc = 0;
  const segments = rows.map((r) => {
    const len = total > 0 ? (r.count / total) * C : 0;
    const dash = Math.max(len - 2, 0.5);
    const seg = {
      key: r.state,
      color: stateHex(r.state),
      dash,
      space: C - dash,
      offset: acc,
    };
    acc += len;
    return seg;
  });

  return (
    <Card className="h-full p-6">
      <PanelHeader title="Fleet composition" hint={`${total} agents`} />
      {rows.length === 0 ? (
        <p className="py-8 text-center font-mono text-[11px] text-muted-foreground">
          No agents yet
        </p>
      ) : (
        <div className="flex flex-col items-center gap-4 sm:flex-row sm:gap-6">
          <div className="relative h-40 w-40 shrink-0">
            <div className="h-full w-full">
              <svg
                viewBox="0 0 160 160"
                className="h-full w-full"
                aria-hidden="true"
                focusable="false"
              >
                <g transform="rotate(-90 80 80)">
                  {segments.map((s) => (
                    <circle
                      key={s.key}
                      cx={80}
                      cy={80}
                      r={R}
                      fill="none"
                      stroke={s.color}
                      strokeWidth={24}
                      strokeDasharray={`${s.dash} ${s.space}`}
                      strokeDashoffset={-s.offset}
                    />
                  ))}
                </g>
              </svg>
            </div>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <span className="pointer-events-auto font-mono text-2xl font-bold tabular-nums">{total}</span>
              <span className="pointer-events-auto font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
                agents
              </span>
            </div>
          </div>
          <div className="flex w-full flex-wrap gap-x-4 gap-y-1.5 sm:flex-col sm:gap-y-2">
            {rows.map((r) => (
              <div key={r.state} className="flex items-center gap-2">
                <span
                  className="h-2 w-2 shrink-0 rounded-[2px]"
                  style={{ backgroundColor: stateHex(r.state) }}
                />
                <span className="font-mono text-[11px] text-muted-foreground">
                  {r.state}
                </span>
                <span className="ml-auto font-mono text-[11px] tabular-nums">
                  {r.count}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}