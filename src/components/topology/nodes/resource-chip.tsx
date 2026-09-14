"use client";
import React from "react";
import { Handle, Position } from "@xyflow/react";
import { stateMeta } from "@/lib/topology";

/** Compact resource chip — shared by TOOL / MCP / AUTOMATION / MEMORY. */
export function ResourceChip({
  data,
  glyph,
  kind,
}: {
  data: { label?: string; status?: string };
  glyph: React.ReactNode;
  kind: string;
}) {
  const meta = stateMeta(data?.status);
  return (
    <div className={`relative flex items-center gap-2 rounded-md border bg-zinc-950/80 px-2.5 ${meta.border}`} style={{ width: 180, height: 44 }}>
      <Handle type="target" position={Position.Left} />
      <span className={`flex h-5 w-5 shrink-0 items-center justify-center ${meta.text}`}>{glyph}</span>
      <span className="min-w-0 flex-1 truncate text-[11px] text-zinc-200">{data?.label || "resource"}</span>
      <span className="shrink-0 rounded-[2px] border border-zinc-800 bg-zinc-900/80 px-1 py-px font-mono text-[7px] font-bold uppercase tracking-widest text-zinc-500">
        {kind}
      </span>
      <span className={`shrink-0 font-mono text-[9px] ${meta.text}`}>{data?.status ?? "unknown"}</span>
      <Handle type="source" position={Position.Right} />
    </div>
  );
}

export function ToolNode({ data }: { data: { label?: string; status?: string } }) {
  return (
    <ResourceChip
      data={data}
      kind="tool"
      glyph={
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
        </svg>
      }
    />
  );
}

export function MCPCNode({ data }: { data: { label?: string; status?: string } }) {
  return (
    <ResourceChip
      data={data}
      kind="mcp"
      glyph={
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          <path d="M4 6h16M4 12h16M4 18h16" strokeLinecap="round" />
        </svg>
      }
    />
  );
}

export function AutomationNode({ data }: { data: { label?: string; status?: string } }) {
  return (
    <ResourceChip
      data={data}
      kind="auto"
      glyph={
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          <path d="M12 2v4m0 12v4M4.9 4.9l2.8 2.8m8.6 8.6 2.8 2.8M2 12h4m12 0h4M4.9 19.1l2.8-2.8m8.6-8.6 2.8-2.8" strokeLinecap="round" />
        </svg>
      }
    />
  );
}

export function MemoryNode({ data }: { data: { label?: string; status?: string } }) {
  return (
    <ResourceChip
      data={data}
      kind="mem"
      glyph={
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
          <rect x="4" y="4" width="16" height="16" rx="2" />
          <path d="M8 11h8M8 15h5" strokeLinecap="round" />
        </svg>
      }
    />
  );
}