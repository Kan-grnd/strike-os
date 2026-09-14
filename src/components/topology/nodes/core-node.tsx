"use client";
import React from "react";
import { Handle, Position } from "@xyflow/react";
import { stateMeta } from "@/lib/topology";

/**
 * STRIKE CORE — synthetic orchestration layer between BRAIN and the colonies.
 * Industrial "backplane" treatment: a bus bar with one socket tap per colony.
 * It is infrastructure, never an agent — square corners, trace lines, and
 * per-colony telemetry instead of a generic SaaS card.
 */
export function CoreNode({
  data,
}: {
  data: { label?: string; status?: string; colonies?: number; active?: number };
}) {
  const meta = stateMeta(data?.status);
  const colonies = Math.max(0, Number(data?.colonies ?? 0));
  const active = Math.min(colonies, Math.max(0, Number(data?.active ?? 0)));
  const sockets = Math.min(Math.max(colonies, 1), 32);

  return (
    <div
      className="relative flex items-center gap-3 overflow-hidden rounded-[4px] border border-zinc-700/70 px-4"
      style={{
        width: "100%",
        height: "100%",
        minWidth: 300,
        minHeight: 56,
        background: "linear-gradient(180deg, rgba(24,24,27,0.92), rgba(9,9,11,0.96))",
      }}
    >
      <Handle type="target" position={Position.Left} />

      {/* backplane trace lines */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{ backgroundImage: "repeating-linear-gradient(90deg, rgba(161,161,170,0.10) 0 1px, transparent 1px 34px)" }}
      />

      {/* bus glyph */}
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className={meta.text} aria-hidden>
        <rect x="3" y="3" width="18" height="7" rx="1" />
        <rect x="3" y="14" width="18" height="7" rx="1" />
        <path d="M7 6.5h6M7 17.5h10" strokeLinecap="round" strokeWidth="1.4" />
      </svg>

      <div className="flex min-w-0 flex-col justify-center">
        <div className="flex items-center gap-2">
          <span className="truncate font-mono text-[13px] font-bold uppercase tracking-[0.14em] text-zinc-100">
            {data?.label || "Strike Core"}
          </span>
          <span className="rounded-[2px] border border-zinc-700/80 px-1 py-px font-mono text-[8px] font-bold uppercase tracking-widest text-zinc-400">
            orch
          </span>
        </div>
        <span className={`font-mono text-[9px] uppercase tracking-[0.18em] ${meta.text}`}>
          orchestration bus · {data?.status ?? "active"}
        </span>
      </div>

      <span className="ml-auto flex items-center gap-1.5 font-mono text-[9px]">
        <span className="rounded-[3px] border border-zinc-800 bg-zinc-950/70 px-1.5 py-0.5 text-zinc-300">
          {colonies} colonies
        </span>
        <span className="rounded-[3px] border border-cyan-900/70 bg-cyan-500/10 px-1.5 py-0.5 text-cyan-300">
          {active} active
        </span>
      </span>

      {/* socket taps — one per downstream colony */}
      {colonies > 0 && (
        <div aria-hidden className="absolute inset-x-4 bottom-1.5 flex items-end justify-end gap-[3px]">
          {Array.from({ length: sockets }).map((_, i) => (
            <span
              key={i}
              className={`h-[4px] w-2 rounded-[1px] ${i < active ? "bg-cyan-400/90" : "bg-zinc-700/80"}`}
            />
          ))}
          {colonies > sockets && (
            <span className="font-mono text-[8px] leading-[4px] text-zinc-600">+{colonies - sockets}</span>
          )}
        </div>
      )}

      <Handle type="source" position={Position.Right} />
    </div>
  );
}

/**
 * DECISION / APPROVAL — control-plane gate node. Compact diamond-prefixed chip,
 * not an agent. Kept tight and machine-like.
 */
export function DecisionGateNode({
  data,
}: {
  data: { label?: string; status?: string };
}) {
  const meta = stateMeta(data?.status);
  return (
    <div
      className={`relative flex items-center gap-2 rounded-[4px] border bg-zinc-950/85 px-3 ${meta.border}`}
      style={{ width: "100%", height: "100%" }}
    >
      <Handle type="target" position={Position.Left} />
      <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden>
        <path d="M6 1l5 5-5 5-5-5z" fill="none" stroke="currentColor" strokeWidth="1.2" className={meta.text} />
      </svg>
      <div className="flex min-w-0 flex-col">
        <span className="truncate text-[11px] font-semibold text-zinc-100">{data?.label || "Decision"}</span>
        <span className={`font-mono text-[8px] uppercase tracking-widest ${meta.text}`}>
          gate · {data?.status ?? "unknown"}
        </span>
      </div>
      <Handle type="source" position={Position.Right} />
    </div>
  );
}