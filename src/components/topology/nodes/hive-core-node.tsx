"use client";
import React from "react";
import { Handle, Position } from "@xyflow/react";
import { stateMeta } from "@/lib/topology";

/**
 * Hive Core — the BRAIN / CEO. The one-of-a-kind hexagonal plate silhouette:
 * larger framing and higher line-height than every node beneath it. No other
 * layer reuses this geometry. Minimal chrome, no neon — presence comes from
 * the silhouette and the teal rim, not decoration.
 */
export function HiveCoreNode({ data }: { data: { label?: string; count?: string; status?: string } }) {
  const meta = stateMeta(data?.status);

  return (
    <div className="relative" style={{ width: "100%", height: "100%", minWidth: 300, minHeight: 56 }}>
      <Handle type="target" position={Position.Left} />

      {/* Hexagon plate — the unique brain silhouette */}
      <svg width="100%" height="100%" viewBox="0 0 300 60" preserveAspectRatio="none" className="absolute inset-0" aria-hidden>
        <defs>
          <linearGradient id="brain-plate" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#155e75" stopOpacity="0.5" />
            <stop offset="0.5" stopColor="#071218" stopOpacity="0.95" />
            <stop offset="1" stopColor="#164e63" stopOpacity="0.45" />
          </linearGradient>
          <linearGradient id="brain-rim" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#22d3ee" stopOpacity="0.95" />
            <stop offset="0.6" stopColor="#0891b2" stopOpacity="0.55" />
            <stop offset="1" stopColor="#155e75" stopOpacity="0.35" />
          </linearGradient>
        </defs>
        <polygon points="0,30 75,0 225,0 300,30 225,60 75,60" fill="url(#brain-plate)" stroke="url(#brain-rim)" strokeWidth="1.5" />
        <polygon points="7,30 77,4 223,4 293,30 223,56 77,56" fill="none" stroke="#22d3ee" strokeOpacity="0.08" strokeWidth="1" />
      </svg>

      <div className="absolute inset-x-7 inset-y-0 flex items-center gap-3">
        {/* Hex emblem */}
        <svg width="34" height="34" viewBox="0 0 40 40" className="shrink-0" aria-hidden>
          <polygon points="20,1 37.5,10.5 37.5,29.5 20,39 2.5,29.5 2.5,10.5" fill="hsl(200 90% 60% / 0.12)" stroke="#67e8f9" strokeWidth="1.2" />
          <circle cx="20" cy="20" r="4.5" fill="#67e8f9" />
          <circle cx="20" cy="20" r="1.5" fill="#0a0a0b" />
        </svg>

        <div className="flex min-w-0 flex-col justify-center">
          <div className="flex items-center gap-2">
            <span className="truncate text-[15px] font-black uppercase tracking-[0.16em] text-zinc-50">
              {data?.label || "Strike OS"}
            </span>
            <span className="rounded-[2px] border border-cyan-500/40 bg-cyan-500/10 px-1 py-px font-mono text-[8px] font-bold uppercase tracking-widest text-cyan-300">
              ceo
            </span>
          </div>
          <span className="font-mono text-[9px] uppercase tracking-[0.28em] text-cyan-100/60">
            prime intelligence · live topology
          </span>
        </div>

        <div className="ml-auto flex items-center gap-2">
          {typeof data?.count === "string" && (
            <span className="rounded-[3px] border border-zinc-800 bg-zinc-950/70 px-2 py-1 font-mono text-[10px] text-cyan-100/90">
              {data.count}
            </span>
          )}
          <span className={`flex h-2 w-2 rounded-full ${meta.dot}`} />
        </div>
      </div>

      <Handle type="source" position={Position.Right} />
    </div>
  );
}