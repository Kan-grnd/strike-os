"use client";
import React from "react";
import { Handle, Position } from "@xyflow/react";
import { stateMeta } from "@/lib/topology";

function countOf(b: Record<string, number>, s: string): number {
  return b[s] ?? 0;
}

/**
 * Colony — structural containment panel. One unified panel geometry; status only
 * affects accent, never shape. Always shows the collapsed-visible summary in
 * the header block (agents / active / blocked / failed + progress/completion)
 * so internal trouble stays legible even when members are hidden behind the
 * panel. A failed colony gets a red bleed stripe + soft glow on the panel edge.
 */
export function ColonyNode({
  data,
}: {
  data: {
    label?: string;
    status?: string;
    agents?: number;
    expanded?: boolean;
    onToggle?: () => void;
    buckets?: Record<string, number>;
  };
}) {
  const meta = stateMeta(data?.status, "COLONY");
  const buckets = data?.buckets ?? {};
  const total = data?.agents ?? 0;
  const activeCnt = Object.entries(buckets).reduce((acc, [s, v]) => acc + (stateMeta(s).active ? v : 0), 0);
  const blockedCnt = countOf(buckets, "blocked");
  const failedCnt = countOf(buckets, "failed");
  const doneCnt = countOf(buckets, "completed");
  const pct = total > 0 ? Math.round((doneCnt / total) * 100) : 0;
  const troubleFailed = failedCnt > 0;
  const troubleBlocked = blockedCnt > 0;

  const extraStates = Object.entries(buckets)
    .filter(([s, v]) => v > 0 && s !== "blocked" && s !== "failed" && s !== "completed")
    .slice(0, 4);

  return (
    <div
      className={`relative rounded-xl border bg-zinc-950/60 backdrop-blur-sm transition-shadow ${
        meta.border
      } ${troubleFailed ? "shadow-[0_0_26px_-10px] shadow-red-500/50" : troubleBlocked ? "shadow-[0_0_22px_-10px] shadow-amber-500/40" : ""}`}
      style={{ width: "100%", height: "100%", minWidth: 320, minHeight: 112 }}
    >
      {/* failure / blocking — visible from the panel itself, even when collapsed */}
      {troubleFailed && <div className="absolute inset-x-0 top-0 h-[2px] rounded-t-xl bg-red-500/90" />}
      {troubleBlocked && !troubleFailed && (
        <div className="absolute inset-x-0 top-0 h-[2px] rounded-t-xl bg-amber-400/80" />
      )}

      <div className="flex h-full flex-col">
        <Handle type="target" position={Position.Left} />
        <button
          type="button"
          onClick={() => data?.onToggle?.()}
          className="flex w-full cursor-pointer items-center gap-2 rounded-t-xl px-4 py-2 text-left"
        >
          <span className={`h-2 w-2 shrink-0 rounded-full ${meta.dot} ${meta.active ? "animate-pulse" : ""}`} />
          <span className="min-w-0 flex-1 truncate text-sm font-semibold text-zinc-100">
            {data?.label || "Colony"}
          </span>
          <span className={`shrink-0 font-mono text-[9px] uppercase tracking-wide ${meta.text}`}>
            {data?.status ?? "active"}
          </span>
          <span className="-mr-1 shrink-0 font-mono text-[12px] leading-none text-zinc-600">
            {data?.expanded ? "▾" : "▸"}
          </span>
        </button>

        {/* collapsed-visible metrics */}
        <div className="mt-0.5 flex items-center gap-1 px-4">
          <Metric label="agents" value={total} tone={total > 0 ? "text-zinc-200" : "text-zinc-600"} />
          <Metric label="active" value={activeCnt} tone={activeCnt > 0 ? "text-cyan-300" : "text-zinc-600"} />
          <Metric label="blocked" value={blockedCnt} tone={troubleBlocked ? "text-amber-300" : "text-zinc-600"} warn={troubleBlocked} />
          <Metric label="failed" value={failedCnt} tone={troubleFailed ? "text-red-300" : "text-zinc-600"} warn={troubleFailed} />
        </div>

        {/* progress / completion */}
        <div className="mt-1.5 flex items-center gap-2 px-4 pb-2">
          <div className="h-[5px] flex-1 overflow-hidden rounded-full bg-zinc-800">
            <div className="h-full rounded-full bg-emerald-500/80" style={{ width: `${pct}%` }} />
          </div>
          <span className="shrink-0 font-mono text-[9px] text-zinc-400">
            {doneCnt}/{total} · {pct}%
          </span>
        </div>

        {extraStates.length > 0 && (
          <div className="flex flex-wrap items-center gap-1 px-4 pb-2">
            {extraStates.map(([s, v]) => {
              const m = stateMeta(s);
              return (
                <span key={s} className={`rounded-[3px] border ${m.border} bg-zinc-900/70 px-1 py-px font-mono text-[8px] ${m.text}`}>
                  {s} {v}
                </span>
              );
            })}
          </div>
        )}
        {total === 0 && extraStates.length === 0 && (
          <span className="px-4 pb-2 font-mono text-[9px] text-zinc-600">no members</span>
        )}
        <Handle type="source" position={Position.Right} />
      </div>
    </div>
  );
}

function Metric({ label, value, tone, warn }: { label: string; value: number; tone: string; warn?: boolean }) {
  return (
    <span className={`flex min-w-0 flex-1 items-center justify-center gap-1 rounded-[3px] border px-1 py-0.5 font-mono text-[9px] ${warn ? "border-amber-900/70" : "border-zinc-800/80"} bg-zinc-900/50`}>
      {warn && <span className="h-1 w-1 shrink-0 animate-pulse rounded-full bg-current" />}
      <span className={tone}>{value}</span>
      <span className="truncate text-zinc-600">{label}</span>
    </span>
  );
}