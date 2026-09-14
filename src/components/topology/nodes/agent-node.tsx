"use client";
import React from "react";
import { Handle, Position } from "@xyflow/react";
import { stateMeta, agentRoleLabel, ACTIVE_STATES, stateHex } from "@/lib/topology";

/** Compact id for "waiting on" hints: agent:xyz / mission:xyz / colony:xyz. */
function shortOf(id: string | null | undefined): string | null {
  if (!id) return null;
  const part = id.split(":")[1];
  return (part ?? id).slice(0, 13);
}

/**
 * Agent — ONE unified base shape for every role. Geometry is never role- or
 * state-dependent (only rank-by-size: sub-agents render narrower). Role reads
 * through the glyph + label; runtime state reads through the left accent,
 * status dot, restrained glow and metadata — never the silhouette.
 */
export function AgentNode({
  data,
}: {
  id?: string;
  data: {
    label?: string;
    status?: string;
    role?: string;
    reason?: string | null;
    blockedBy?: string | null;
    currentTask?: string | null;
    pausedFrom?: string | null;
    flash?: boolean;
    isSub?: boolean;
  };
}) {
  const meta = stateMeta(data?.status);
  const role = (data?.role as string) || "WORKER";
  const status = data?.status ?? "idle";
  const isBusy = meta.active === true;
  const sub = data?.isSub === true;
  const width = sub ? 186 : 200;
  const blocked = status === "blocked";
  const reason = blocked ? data?.reason ?? null : null;
  const waits = blocked && data?.blockedBy ? shortOf(data.blockedBy) : null;
  const glow = isBusy
    ? `0 0 20px -8px ${stateHex(status)}cc`
    : blocked
    ? "0 0 16px -8px rgba(251,191,36,0.55)"
    : "inset 0 1px 0 rgba(255,255,255,0.04)";

  return (
    <div
      className={`relative flex rounded-lg border bg-zinc-950/85 transition-colors ${
        blocked ? "border-amber-400/70" : meta.border
      } ${data?.flash ? "agent-flash" : ""}`}
      style={{ width, height: 58, boxShadow: glow }}
    >
      <Handle type="target" position={Position.Left} />
      <div className={`w-1 shrink-0 rounded-l-lg ${blocked ? "bg-amber-400" : meta.bar}`} />
      <div className="flex min-w-0 flex-1 flex-col justify-center px-2.5 py-1.5">
        <div className="flex items-center gap-1.5">
          <span
            className={`flex h-4 w-4 shrink-0 items-center justify-center rounded font-mono text-[9px] font-bold ${
              meta.active ? "bg-cyan-500/15 text-cyan-300" : "bg-zinc-800 text-zinc-400"
            }`}
          >
            {agentRoleLabel(role)}
          </span>
          <span className="truncate text-[12px] font-semibold text-zinc-100">{data?.label || "Agent"}</span>
          {blocked && (
            <span className="ml-auto shrink-0 rounded-[3px] border border-amber-400/50 bg-amber-400/10 px-1 font-mono text-[8px] font-bold uppercase tracking-widest text-amber-300">
              blocked
            </span>
          )}
        </div>

        <span className="mt-0.5 flex items-center gap-1.5 font-mono text-[10px]">
          <span
            className={`h-1.5 w-1.5 shrink-0 rounded-full ${meta.dot} ${isBusy ? "animate-pulse" : ""}`}
          />
          <span className={`truncate ${meta.text}`}>
            {status}
            {data?.pausedFrom && status === "paused" ? ` from ${data.pausedFrom}` : ""}
          </span>
        </span>

        {blocked && (
          <span className="mt-0.5 flex items-center gap-1 font-mono text-[9px] text-amber-300/90">
            <LockGlyph />
            <span className="truncate">
              {reason || "awaiting input"}
              {waits ? ` · waits ${waits}` : ""}
            </span>
          </span>
        )}
        {!blocked && status === "waiting_for_approval" && (
          <span className="mt-0.5 flex items-center gap-1 font-mono text-[9px] text-violet-300/90">
            <span aria-hidden>◈</span>
            <span className="truncate">awaiting approval</span>
          </span>
        )}
        {!blocked && data?.currentTask && (
          <span className="mt-0.5 truncate font-mono text-[9px] text-zinc-500">▸ {data.currentTask}</span>
        )}
      </div>
      <Handle type="source" position={Position.Right} />
    </div>
  );
}

function LockGlyph() {
  return (
    <svg width="8" height="10" viewBox="0 0 8 10" className="shrink-0" fill="none" stroke="currentColor" strokeWidth="1.3" aria-hidden>
      <rect x="1" y="4.5" width="6" height="4.5" rx="1" />
      <path d="M2.5 4.5v-1.8a1.5 1.5 0 0 1 3 0v1.8" strokeLinecap="round" />
    </svg>
  );
}

export function agentNodeNeedsActiveTask(s?: string): boolean {
  return ACTIVE_STATES.includes(s ?? "");
}