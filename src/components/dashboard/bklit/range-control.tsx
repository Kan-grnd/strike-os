"use client";

import { cn } from "@/lib/utils";
import { RANGES, type RangeKey } from "./chart-data";

export function RangeControl({
  value,
  onChange,
}: {
  value: RangeKey;
  onChange: (range: RangeKey) => void;
}) {
  return (
    <div
      role="group"
      aria-label="Time range"
      className="inline-flex items-center rounded-full border bg-card p-1"
    >
      {RANGES.map((r) => (
        <button
          key={r.key}
          type="button"
          onClick={() => onChange(r.key)}
          aria-pressed={value === r.key}
          className={cn(
            "rounded-full px-3.5 py-1 font-mono text-[11px] font-semibold uppercase tracking-wider transition-colors",
            value === r.key
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {r.label}
        </button>
      ))}
    </div>
  );
}
