import * as React from "react";
import { Card } from "@/components/ui/card";
import { stateHex } from "@/lib/topology";

const ACTIVE_LIVE = ["executing", "planning", "thinking", "delegating", "initializing", "retrying"];

export function isAgentActiveLive(a: any): boolean {
  if (ACTIVE_LIVE.includes(a?.runtimeState)) return true;
  return (a?.runtimeState == null || a?.runtimeState === "") && a?.status === "RUNNING";
}

function ChartHeader({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="mb-3 flex items-baseline justify-between gap-2">
      <h3 className="font-mono text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {title}
      </h3>
      {hint && <span className="font-mono text-[10px] text-muted-foreground/70">{hint}</span>}
    </div>
  );
}

const EmptyNote = ({ children }: { children: React.ReactNode }) => (
  <p className="py-6 text-center font-mono text-[11px] text-muted-foreground">{children}</p>
);

/* ── Fleet by runtime state ───────────────────────────────────────────── */
export function StateBar({ agents }: { agents: any[] }) {
  const counts: Record<string, number> = {};
  for (const a of agents) {
    const s = a?.runtimeState || (a?.status ? String(a.status).toLowerCase() : "idle");
    counts[s] = (counts[s] || 0) + 1;
  }
  const order = [
    "executing", "planning", "thinking", "delegating", "initializing", "retrying",
    "waiting", "blocked", "waiting_for_approval", "paused", "idle",
    "completed", "failed", "cancelled", "stopped", "unknown",
  ];
  const rows = Object.entries(counts)
    .map(([state, count]) => ({ state, count }))
    .sort((a, b) => {
      const ia = order.indexOf(a.state);
      const ib = order.indexOf(b.state);
      if (ia !== -1 || ib !== -1) return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
      return b.count - a.count;
    });
  const total = rows.reduce((s, r) => s + r.count, 0);
  const W = 560;

  return (
    <Card className="p-6">
      <ChartHeader title="Fleet by state" hint={`${total} agents`} />
      {rows.length === 0 ? (
        <EmptyNote>No agents yet</EmptyNote>
      ) : (
        <div className="space-y-4">
          <svg viewBox={`0 0 ${W} 12`} className="w-full" aria-hidden="true">
            {rows.map((r, i) => {
              const x = rows.slice(0, i).reduce((s, q) => s + (q.count / total) * W, 0);
              const w = (r.count / total) * W;
              return (
                <rect
                  key={r.state}
                  x={x}
                  y={2}
                  width={Math.max(0, w - 1)}
                  height={8}
                  rx={2}
                  fill={stateHex(r.state)}
                />
              );
            })}
          </svg>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 sm:grid-cols-3">
            {rows.map((r) => (
              <div key={r.state} className="flex items-center gap-2">
                <span
                  className="h-1.5 w-2.5 shrink-0 rounded-[2px]"
                  style={{ backgroundColor: stateHex(r.state) }}
                />
                <span className="truncate font-mono text-[11px] text-muted-foreground">
                  {r.state}
                </span>
                <span className="ml-auto font-mono text-[11px] tabular-nums text-foreground">
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

/* ── RUNNING mission progress bars ────────────────────────────────────── */
export function MissionProgress({
  runningMissions,
  missionPercent,
}: {
  runningMissions: { id: string; goal?: string }[];
  missionPercent: Record<string, number>;
}) {
  return (
    <Card className="p-6">
      <ChartHeader title="Mission progress" hint={`${runningMissions.length} running`} />
      {runningMissions.length === 0 ? (
        <EmptyNote>No running missions</EmptyNote>
      ) : (
        <div className="space-y-3.5">
          {runningMissions.map((m) => {
            const pct = Math.max(0, Math.min(100, missionPercent[`mission:${m.id}`] ?? 0));
            return (
              <div key={m.id} className="space-y-1.5">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="truncate text-sm">{m.goal || "Mission"}</span>
                  <span className="shrink-0 font-mono text-[11px] tabular-nums text-muted-foreground">
                    {pct}%
                  </span>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${pct}%`, backgroundColor: stateHex("completed") }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}

/* ── Event sparkline (5-min buckets, trailing 2h) ─────────────────────── */
export function Sparkline({ events }: { events: { timestamp?: string }[] }) {
  const BUCKET = 5 * 60_000;
  const N = 24;
  const now = Date.now();
  const start = now - N * BUCKET;
  const buckets = new Array<number>(N).fill(0);
  for (const e of events) {
    const t = Date.parse(e?.timestamp ?? "");
    if (Number.isNaN(t) || t < start || t > now) continue;
    const i = Math.min(N - 1, Math.max(0, Math.floor((t - start) / BUCKET)));
    buckets[i]++;
  }
  const peak = Math.max(1, ...buckets);
  const W = 560;
  const H = 44;
  const pad = 4;
  const x = (i: number) => pad + (i / (N - 1)) * (W - pad * 2);
  const y = (v: number) => H - pad - (v / peak) * (H - pad * 2);
  const pts = buckets.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  const total = buckets.reduce((s, v) => s + v, 0);

  return (
    <Card className="p-6">
      <ChartHeader title="Event rate" hint={`${total} events · last 2h`} />
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" aria-hidden="true">
        <polyline
          points={pts}
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
          strokeLinejoin="round"
          strokeLinecap="round"
          className="text-muted-foreground"
        />
        {buckets.some((v) => v > 0) && (
          <circle
            cx={x(buckets.indexOf(peak))}
            cy={y(peak)}
            r={2.5}
            fill={stateHex("executing")}
          />
        )}
      </svg>
      <div className="mt-1.5 flex justify-between font-mono text-[10px] text-muted-foreground/70">
        <span>-2h</span>
        <span>now</span>
      </div>
      <div className="mt-1 text-[10px] font-mono text-muted-foreground/50">
        peak {peak} events / 5m bucket
      </div>
    </Card>
  );
}

/* ── Outcomes donut (completed vs failed) ─────────────────────────────── */
export function OutcomeDonut({
  completed,
  failed,
}: {
  completed: number;
  failed: number;
}) {
  const total = completed + failed;
  const R = 30;
  const C = 2 * Math.PI * R;
  const done = total > 0 ? (completed / total) * C : 0;
  const fail = total > 0 ? (failed / total) * C : 0;
  const pct = total > 0 ? Math.round((completed / total) * 100) : null;

  return (
    <Card className="p-6">
      <ChartHeader title="Outcomes" hint={total === 0 ? "—" : `${total} tasks`} />
      <div className="flex items-center gap-5">
        <svg viewBox="0 0 80 80" className="h-20 w-20 shrink-0" aria-hidden="true">
          <circle cx={40} cy={40} r={R} fill="none" strokeWidth={8} className="stroke-muted" />
          {total > 0 && done > 0 && (
            <circle
              cx={40}
              cy={40}
              r={R}
              fill="none"
              stroke={stateHex("completed")}
              strokeWidth={8}
              strokeLinecap="butt"
              strokeDasharray={`${done} ${C - done}`}
              transform="rotate(-90 40 40)"
            />
          )}
          {total > 0 && fail > 0 && (
            <circle
              cx={40}
              cy={40}
              r={R}
              fill="none"
              stroke={stateHex("failed")}
              strokeWidth={8}
              strokeLinecap="butt"
              strokeDasharray={`${fail} ${C - done - fail}`}
              strokeDashoffset={-done}
              transform="rotate(-90 40 40)"
            />
          )}
          <text
            x={40}
            y={44}
            textAnchor="middle"
            className="fill-foreground font-mono"
            fontSize={pct === null ? 22 : 15}
          >
            {pct === null ? "–" : `${pct}%`}
          </text>
        </svg>
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-[2px]" style={{ backgroundColor: stateHex("completed") }} />
            <span className="text-sm">Completed</span>
            <span className="ml-auto font-mono text-sm tabular-nums">{completed}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-[2px]" style={{ backgroundColor: stateHex("failed") }} />
            <span className="text-sm">Failed</span>
            <span className="ml-auto font-mono text-sm tabular-nums">{failed}</span>
          </div>
          {total === 0 && (
            <p className="pt-1 font-mono text-[10px] text-muted-foreground">No outcomes yet</p>
          )}
        </div>
      </div>
    </Card>
  );
}

/* ── Costs (rendered only when totalCost > 0) ─────────────────────────── */
export function CostCard({ data }: { data?: { totalCost: number; dimensions: Record<string, number> } }) {
  const total = data?.totalCost ?? 0;
  if (!data || !(total > 0)) return null;
  const dims = Object.entries(data.dimensions || {}).sort((a, b) => b[1] - a[1]);
  const [topName, topValue] = dims[0] || [null, null];
  return (
    <Card className="p-6">
      <ChartHeader title="Observed cost" hint="7d window" />
      <div className="flex items-baseline gap-3">
        <span className="font-mono text-2xl font-semibold tabular-nums">
          ${total.toFixed(2)}
        </span>
        {topName != null && (
          <span className="truncate font-mono text-[11px] text-muted-foreground">
            most in {topName}: ${Number(topValue).toFixed(2)}
          </span>
        )}
      </div>
    </Card>
  );
}

/* ── Composite: Fleet Health section ──────────────────────────────────── */
export function FleetHealth({
  agents,
  runningMissions,
  missionPercent,
  events,
  completed,
  failed,
  costs,
}: {
  agents: any[];
  runningMissions: { id: string; goal?: string }[];
  missionPercent: Record<string, number>;
  events: { timestamp?: string }[];
  completed: number;
  failed: number;
  costs?: { totalCost: number; dimensions: Record<string, number> };
}) {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      <div className="md:col-span-2">
        <StateBar agents={agents} />
      </div>
      <div>
        <OutcomeDonut completed={completed} failed={failed} />
      </div>
      <div className="md:col-span-1">
        <MissionProgress runningMissions={runningMissions} missionPercent={missionPercent} />
      </div>
      <div className="md:col-span-1 lg:col-span-2">
        <Sparkline events={events} />
      </div>
      {costs && (costs.totalCost ?? 0) > 0 && (
        <div className="md:col-span-2 lg:col-span-3">
          <CostCard data={costs} />
        </div>
      )}
    </div>
  );
}