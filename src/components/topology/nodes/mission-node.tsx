"use client";
import React from "react";
import { Handle, Position } from "@xyflow/react";
import { stateMeta } from "@/lib/topology";

/**
 * Mission — an objective/output, never another worker. Flag + progress keep it
 * visually distinct from agents; the OBJECTIVE tag makes the intent explicit.
 */
export function MissionNode({
  data,
}: {
  data: { label?: string; status?: string; tasks?: number; pct?: number };
}) {
  const meta = stateMeta(data?.status);
  const pct = Math.max(0, Math.min(100, Number(data?.pct ?? 0)));

  return (
    <div className={`relative flex items-center gap-3 rounded-lg border bg-zinc-950/85 px-3 ${meta.border}`} style={{ width: 210, height: 60 }}>
      <Handle type="target" position={Position.Left} />
      <svg width="30" height="34" viewBox="0 0 30 34" className="shrink-0" aria-hidden>
        <path d="M3 2h18l6 8v22H3z" fill="hsl(200 60% 50% / 0.12)" stroke="#67e8f9" strokeWidth="1.3" />
        <path d="M21 2v8h6" fill="none" stroke="#67e8f9" strokeWidth="1.2" />
      </svg>
      <div className="flex min-w-0 flex-col justify-center">
        <div className="flex items-center gap-1.5">
          <span className="truncate text-[12px] font-semibold text-zinc-100">{data?.label || "Mission"}</span>
          <span className="rounded-[2px] border border-zinc-800 bg-zinc-900/70 px-1 font-mono text-[7px] font-bold uppercase tracking-widest text-zinc-500">
            objective
          </span>
        </div>
        <span className={`font-mono text-[9px] uppercase tracking-wide ${meta.text}`}>{data?.status ?? "unknown"}</span>
        {typeof data?.tasks === "number" && (
          <div className="mt-1 flex items-center gap-1.5">
            <div className="h-[4px] w-[64px] overflow-hidden rounded-full bg-zinc-800">
              <div className="h-full rounded-full bg-cyan-500" style={{ width: `${pct}%` }} />
            </div>
            <span className="font-mono text-[9px] text-zinc-400">{pct}%</span>
            <span className="font-mono text-[9px] text-zinc-600">{data.tasks} tasks</span>
          </div>
        )}
      </div>
      <Handle type="source" position={Position.Right} />
    </div>
  );
}