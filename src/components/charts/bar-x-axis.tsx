"use client";

import { motion } from "motion/react";
import { memo, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";
import { useChart, useChartStable } from "./chart-context";

export interface BarXAxisProps {
  /** Width of the date ticker box for fade calculation. Default: 50 */
  tickerHalfWidth?: number;
  /** Whether to show all labels or skip some for dense data. Default: false */
  showAllLabels?: boolean;
  /** Maximum number of labels to show. Default: 12 */
  maxLabels?: number;
  /**
   * Minimum px between labels before density is reduced to fit the plot width.
   * Default: 52
   */
  minLabelSpacing?: number;
}

interface BarXAxisLabelProps {
  label: string;
  x: number;
  crosshairX: number | null;
  isHovering: boolean;
  tickerHalfWidth: number;
  /** Clamp the label inside the plot at the first/last tick. */
  edge?: "start" | "end";
}

function BarXAxisLabel({
  label,
  x,
  crosshairX,
  isHovering,
  tickerHalfWidth,
  edge,
}: BarXAxisLabelProps) {
  const fadeBuffer = 20;
  const fadeRadius = tickerHalfWidth + fadeBuffer;

  let opacity = 1;
  if (isHovering && crosshairX !== null) {
    const distance = Math.abs(x - crosshairX);
    if (distance < tickerHalfWidth) {
      opacity = 0;
    } else if (distance < fadeRadius) {
      opacity = (distance - tickerHalfWidth) / fadeBuffer;
    }
  }

  // Zero-width container approach for perfect centering
  return (
    <div
      className="absolute"
      style={{
        left: x,
        bottom: 12,
        width: 0,
        display: "flex",
        justifyContent:
          edge === "start"
            ? "flex-start"
            : edge === "end"
              ? "flex-end"
              : "center",
      }}
    >
      <motion.span
        animate={{ opacity }}
        className={cn("whitespace-nowrap text-chart-label text-xs")}
        initial={{ opacity: 1 }}
        transition={{ duration: 0.4, ease: "easeInOut" }}
      >
        {label}
      </motion.span>
    </div>
  );
}

export function BarXAxis(props: BarXAxisProps) {
  const { containerRef, barScale } = useChartStable();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const container = containerRef.current;
  if (!(mounted && container)) {
    return null;
  }

  if (!barScale) {
    return null;
  }

  return <BarXAxisInner {...props} container={container} />;
}

const BarXAxisInner = memo(function BarXAxisInner({
  tickerHalfWidth = 50,
  showAllLabels = false,
  maxLabels = 12,
  minLabelSpacing = 52,
  container,
}: BarXAxisProps & { container: HTMLDivElement }) {
  const { margin, tooltipData, barScale, bandWidth, barXAccessor, data } =
    useChart();

  // Shrink the label budget when the plot is narrow so labels never collide.
  const plotWidth = Math.max(container.clientWidth - margin.left - margin.right, 0);
  const densityCap = Math.max(2, Math.floor(plotWidth / minLabelSpacing));
  const effectiveMaxLabels = Math.min(maxLabels, densityCap);

  // Generate labels for each bar
  const labelsToShow = useMemo(() => {
    if (!(barScale && bandWidth && barXAccessor)) {
      return [];
    }

    const allLabels = data.map((d) => {
      const label = barXAccessor(d);
      const bandX = barScale(label) ?? 0;
      // Center the label under the bar group
      const x = bandX + bandWidth / 2 + margin.left;
      return { label, x };
    });

    // If showAllLabels is true or we have fewer than maxLabels, show all
    if (showAllLabels || allLabels.length <= effectiveMaxLabels) {
      return allLabels;
    }

    // Otherwise, skip some labels to avoid crowding
    const step = Math.ceil(allLabels.length / effectiveMaxLabels);
    return allLabels.filter((_, i) => i % step === 0);
  }, [
    barScale,
    bandWidth,
    barXAccessor,
    data,
    margin.left,
    showAllLabels,
    effectiveMaxLabels,
  ]);

  const isHovering = tooltipData !== null;
  const crosshairX = tooltipData ? tooltipData.x + margin.left : null;

  return createPortal(
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {labelsToShow.map((item, i) => (
        <BarXAxisLabel
          crosshairX={crosshairX}
          edge={
            i === 0
              ? "start"
              : i === labelsToShow.length - 1
                ? "end"
                : undefined
          }
          isHovering={isHovering}
          key={`${item.label}-${item.x}`}
          label={item.label}
          tickerHalfWidth={tickerHalfWidth}
          x={item.x}
        />
      ))}
    </div>,
    container
  );
});

BarXAxis.displayName = "BarXAxis";

export default BarXAxis;
