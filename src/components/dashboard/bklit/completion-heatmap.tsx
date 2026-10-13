"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Empty, Panel } from "./panel";
import { completionHeatmap } from "./chart-data";

const GAP = 3;
const NARROW_QUERY = "(max-width: 640px)";
const NARROW_WEEKS = 13;

const LEVEL_COLORS = [
  "color-mix(in oklab, hsl(var(--success)) 15%, hsl(var(--card)))",
  "color-mix(in oklab, hsl(var(--success)) 35%, hsl(var(--card)))",
  "color-mix(in oklab, hsl(var(--success)) 55%, hsl(var(--card)))",
  "color-mix(in oklab, hsl(var(--success)) 75%, hsl(var(--card)))",
  "color-mix(in oklab, hsl(var(--success)) 95%, hsl(var(--card)))",
] as const;

const EMPTY_CELL_COLOR = "hsl(var(--muted))";
const ROW_LABELS = ["", "M", "", "W", "", "F", ""];

function levelIndex(count: number, max: number): number {
  if (count <= 0 || max <= 0) return -1;
  const idx = Math.ceil((count / max) * LEVEL_COLORS.length);
  return Math.min(LEVEL_COLORS.length, Math.max(1, idx)) - 1;
}

interface TooltipState {
  x: number;
  y: number;
  count: number;
  date: Date;
}

export function CompletionHeatmap({ tasks }: { tasks: any[] }) {
  const { columns, total } = useMemo(() => completionHeatmap(tasks), [tasks]);

  // Squares get too small to read below ~640px, so show the last few weeks
  // instead of shrinking every cell. Mirrors CommandDeckHalo's matchMedia.
  const [narrow, setNarrow] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(NARROW_QUERY);
    const sync = () => setNarrow(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  const visible = useMemo(
    () => (narrow ? columns.slice(-NARROW_WEEKS) : columns),
    [columns, narrow],
  );
  const max = useMemo(
    () => visible.reduce((m, c) => Math.max(m, ...c.bins.map((b) => b.count)), 0),
    [visible],
  );

  const wrapRef = useRef<HTMLDivElement>(null);
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);

  function showTooltip(el: HTMLElement, count: number, date: Date): void {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const wr = wrap.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    const x = Math.max(46, Math.min(wr.width - 46, r.left - wr.left + r.width / 2));
    setTooltip({ x, y: r.top - wr.top, count, date });
  }

  return (
    <Panel
      title="Completion rhythm"
      hint={`${total} completion${total === 1 ? "" : "s"} · 6 months`}
      className="overflow-hidden"
    >
      {total === 0 ? (
        <Empty>No tasks completed in the last six months</Empty>
      ) : (
        <div ref={wrapRef} className="relative flex w-full min-w-0 flex-col gap-1">
          {/* month labels */}
          <div className="flex w-full" style={{ gap: GAP }}>
            <div className="w-4 shrink-0" />
            <div className="relative h-3 min-w-0 flex-1">
              {visible.map((col, i) => {
                const d = col.bins[0].date;
                const prev = i > 0 ? visible[i - 1].bins[0].date : null;
                if (prev && d.getMonth() === prev.getMonth()) return null;
                return (
                  <span
                    key={i}
                    className="absolute top-0 whitespace-nowrap text-[10px] leading-none text-muted-foreground"
                    style={{ left: `${(i / visible.length) * 100}%` }}
                  >
                    {d.toLocaleString("en-US", { month: "short" })}
                  </span>
                );
              })}
            </div>
          </div>

          {/* grid + row labels */}
          <div className="flex w-full" style={{ gap: GAP }}>
            <div
              className="grid w-4 shrink-0 self-stretch"
              style={{ gridTemplateRows: "repeat(7, minmax(0, 1fr))", gap: GAP }}
            >
              {ROW_LABELS.map((label, i) => (
                <span
                  key={i}
                  className="flex items-center justify-end pr-0.5 text-[10px] leading-none text-muted-foreground"
                >
                  {label}
                </span>
              ))}
            </div>
            <div
              className="grid min-w-0 flex-1"
              style={{
                gridAutoFlow: "column",
                // 7 auto rows make auto-flow pack 7 cells per column (one week);
                // height stays content-sized so the square cells can never
                // outgrow the card.
                gridTemplateRows: "repeat(7, auto)",
                gridAutoColumns: "minmax(0, 1fr)",
                gap: GAP,
              }}
            >
              {visible.flatMap((col, ci) =>
                col.bins.map((bin, ri) => {
                  const lvl = levelIndex(bin.count, max);
                  return (
                    <div
                      key={`${ci}-${ri}`}
                      className="rounded-[2px]"
                      style={{
                        width: "100%",
                        aspectRatio: "1 / 1",
                        background: lvl < 0 ? EMPTY_CELL_COLOR : LEVEL_COLORS[lvl],
                      }}
                      onMouseEnter={(e) =>
                        showTooltip(e.currentTarget, bin.count, bin.date)
                      }
                      onMouseLeave={() => setTooltip(null)}
                    />
                  );
                }),
              )}
            </div>
          </div>

          {/* legend */}
          <div className="mt-1 hidden items-center justify-end gap-1 sm:flex">
            <span className="text-[10px] leading-none text-muted-foreground">
              Less
            </span>
            <span
              className="h-2.5 w-2.5 rounded-[2px]"
              style={{ background: EMPTY_CELL_COLOR }}
            />
            {LEVEL_COLORS.map((c, i) => (
              <span
                key={i}
                className="h-2.5 w-2.5 rounded-[2px]"
                style={{ background: c }}
              />
            ))}
            <span className="text-[10px] leading-none text-muted-foreground">
              More
            </span>
          </div>

          {/* tooltip */}
          {tooltip && (
            <div
              className="pointer-events-none absolute z-20 w-max -translate-x-1/2 -translate-y-full rounded-xl border bg-popover px-2 py-1 shadow-sm"
              style={{ left: tooltip.x, top: tooltip.y - 6 }}
            >
              <div className="text-[11px] font-medium leading-tight">
                {tooltip.date.toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </div>
              <div className="text-[10px] leading-tight text-muted-foreground">
                {tooltip.count} completion{tooltip.count === 1 ? "" : "s"}
              </div>
            </div>
          )}
        </div>
      )}
    </Panel>
  );
}
