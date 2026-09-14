"use client";

import { useReactFlow } from "@xyflow/react";

function ZoomButton({ children, label, onClick }: { children: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      className="flex h-7 w-10 items-center justify-center font-mono text-[11px] text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-cyan-300"
    >
      {children}
    </button>
  );
}

/** Strike viewport cluster — replaces the stock RF <Controls />.
 *  Honors the page's zoom policy (minZoom 0.08 / maxZoom 1): fitView caps at
 *  maxZoom 1 with the page's fit padding, and zoomIn/zoomOut stay clamped by the
 *  viewport constraints. Visual language matches the rail/legend (dark zinc,
 *  mono micro-label, cyan hover accent). */
export default function StrikeControls() {
  const { zoomIn, zoomOut, fitView } = useReactFlow();
  return (
    <div
      role="group"
      aria-label="Strike viewport controls"
      className="absolute bottom-4 right-4 z-10 flex flex-col overflow-hidden rounded-md border border-zinc-800 bg-zinc-950/80 font-mono backdrop-blur-sm"
    >
      <div className="border-b border-zinc-800 px-1.5 py-1 text-center text-[9px] uppercase tracking-wider text-zinc-600">strike</div>
      <ZoomButton label="Zoom in" onClick={() => zoomIn({ duration: 120 })}>+</ZoomButton>
      <ZoomButton label="Zoom out" onClick={() => zoomOut({ duration: 120 })}>−</ZoomButton>
      <div className="border-t border-zinc-800" />
      <ZoomButton label="Fit view" onClick={() => fitView({ padding: 0.12, maxZoom: 1 })}>fit</ZoomButton>
    </div>
  );
}