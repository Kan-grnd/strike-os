import { missionProgress } from "@/lib/execution-meta";
import { cn } from "@/lib/utils";

/**
 * The one mission progress bar.
 *
 * Percentages are rounded per segment, so a mission whose tasks are mostly
 * failed or cancelled could sum past 100% and overflow the track (the list used
 * to do exactly that). Each segment is clamped to the width that is actually
 * left, so the bar is filled exactly once no matter what the mix is.
 *
 * Both /work and the mission detail render this, so the same mission can never
 * show two different bars.
 */
export function MissionProgressBar({
  mission,
  className,
}: {
  mission: { tasks?: Array<{ status: string }> } | null | undefined;
  className?: string;
}) {
  const prog = missionProgress(mission);
  const failedPct = prog.total ? Math.round((prog.failed / prog.total) * 100) : 0;
  const cancelledPct = prog.total ? Math.round((prog.cancelled / prog.total) * 100) : 0;

  let used = 0;
  const seg = (w: number) => {
    const clamped = Math.min(Math.max(w, 0), 100 - used);
    used += clamped;
    return clamped;
  };
  const widths = [seg(prog.pct), seg(failedPct), seg(cancelledPct)];
  const visible = widths.filter((w) => w > 0).length;

  return (
    <div
      className={cn("h-1.5 w-full rounded-full bg-muted overflow-hidden flex", className)}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(used)}
      aria-label="Mission progress"
    >
      {widths[0] > 0 && <div className="h-full rounded-l-full bg-primary" style={{ width: `${widths[0]}%` }} />}
      {widths[1] > 0 && <div className="h-full bg-destructive" style={{ width: `${widths[1]}%` }} />}
      {widths[2] > 0 && (
        <div
          className={cn("h-full bg-muted-foreground/40", visible === 1 && "rounded-r-full")}
          style={{ width: `${widths[2]}%` }}
        />
      )}
    </div>
  );
}