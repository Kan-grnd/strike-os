"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import {
  runtimeStateMeta,
  stateDotClass,
  stateTextClass,
} from "@/lib/runtime-state-meta";

export function StateDot({
  state,
  className,
  size = 8,
}: {
  state?: string | null;
  className?: string;
  size?: number;
}) {
  const { tone, pulse } = runtimeStateMeta(state);
  return (
    <span
      aria-hidden
      className={cn("relative inline-flex shrink-0", className)}
      style={{ width: size, height: size }}
    >
      {pulse && (
        <span
          className={cn(
            "absolute inline-flex h-full w-full animate-ping rounded-full opacity-60",
            stateDotClass(tone)
          )}
        />
      )}
      <span
        className={cn(
          "relative inline-flex h-full w-full rounded-full",
          stateDotClass(tone)
        )}
      />
    </span>
  );
}

export function StatePill({
  state,
  className,
}: {
  state?: string | null;
  className?: string;
}) {
  const { tone, label, pulse } = runtimeStateMeta(state);
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 font-mono text-[10px] font-medium",
        className
      )}
    >
      <StateDot state={state} size={6} />
      <span className={stateTextClass(tone)}>{label}</span>
      {pulse && <span className="sr-only">live</span>}
    </span>
  );
}