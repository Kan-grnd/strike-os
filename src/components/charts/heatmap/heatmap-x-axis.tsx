"use client";

import { memo, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";
import { useHeatmap } from "./heatmap-context";
import { getHeatmapColumnMonthAnchor } from "./heatmap-utils";

export interface HeatmapXAxisProps {
  /** Additional class name for labels */
  className?: string;
}

const monthFmt = new Intl.DateTimeFormat("en-US", { month: "short" });

/** Minimum px between month labels before the denser ones are dropped. */
const MIN_MONTH_LABEL_SPACING = 46;

export const HeatmapXAxis = memo(function HeatmapXAxis({
  className,
}: HeatmapXAxisProps) {
  const { containerRef, data, margin, xScale } = useHeatmap();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const labels = useMemo(() => {
    const ticks: { label: string; x: number; key: string }[] = [];
    let lastMonthKey = "";

    for (let columnIndex = 0; columnIndex < data.length; columnIndex++) {
      const column = data[columnIndex];
      if (!column) {
        continue;
      }

      const monthAnchor = getHeatmapColumnMonthAnchor(
        column,
        columnIndex === 0
      );
      if (!monthAnchor) {
        continue;
      }

      const monthKey = `${monthAnchor.getFullYear()}-${monthAnchor.getMonth()}`;
      if (monthKey === lastMonthKey) {
        continue;
      }

      ticks.push({
        label: monthFmt.format(monthAnchor),
        x: margin.left + xScale(columnIndex),
        key: monthKey,
      });
      lastMonthKey = monthKey;
    }

    // Month anchors can land close together (a range starting mid-month puts
    // the leading partial week next to a real 1st-of-month), so drop labels
    // that would collide with the one before them. The final label is
    // right-clamped at the plot edge, so it always wins its slot.
    const spaced: typeof ticks = [];
    for (const tick of ticks) {
      const prev = spaced[spaced.length - 1];
      if (!prev || tick.x - prev.x >= MIN_MONTH_LABEL_SPACING) {
        spaced.push(tick);
      }
    }
    const last = ticks[ticks.length - 1];
    if (last && spaced[spaced.length - 1] !== last) {
      const prev = spaced[spaced.length - 1];
      if (!prev || last.x - prev.x < MIN_MONTH_LABEL_SPACING) {
        spaced[spaced.length - 1] = last;
      } else {
        spaced.push(last);
      }
    }

    return spaced;
  }, [data, margin.left, xScale]);

  const container = containerRef.current;
  if (!(mounted && container)) {
    return null;
  }

  return createPortal(
    labels.map((tick, i) => (
      <div
        className="pointer-events-none absolute"
        key={tick.key}
        style={{
          top: 0,
          left: tick.x,
          width: 0,
          display: "flex",
          justifyContent: i === labels.length - 1 ? "flex-end" : "flex-start",
        }}
      >
        <span
          className={cn(
            "whitespace-nowrap text-chart-label text-xs",
            className
          )}
        >
          {tick.label}
        </span>
      </div>
    )),
    container
  );
});

HeatmapXAxis.displayName = "HeatmapXAxis";

export default HeatmapXAxis;
