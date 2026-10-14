import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/**
 * A shell-shaped loading skeleton (M4.5). Every route's `loading.tsx` renders
 * this so navigation never flashes a blank content area or a bare spinner — the
 * placeholder has the same header + KPI + body rhythm the real page will.
 *
 * It is intentionally structural, not a pixel copy: a skeleton that pretends to
 * know the exact layout lies twice (once while loading, once when it reflows).
 */
export function PageSkeleton({
  kpis = 4,
  rows = 6,
  className,
}: {
  kpis?: number;
  rows?: number;
  className?: string;
}) {
  return (
    <div
      className={cn("mx-auto max-w-[1400px] space-y-6", className)}
      role="status"
      aria-live="polite"
      aria-label="Loading"
    >
      {/* header */}
      <div className="flex items-start gap-3">
        <Skeleton className="h-10 w-10 shrink-0 rounded-xl" />
        <div className="space-y-2">
          <Skeleton className="h-3 w-24 rounded-md" />
          <Skeleton className="h-6 w-56 rounded-lg" />
          <Skeleton className="h-3 w-80 rounded-md" />
        </div>
      </div>

      {/* KPI row */}
      {kpis > 0 && (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {Array.from({ length: kpis }).map((_, i) => (
            <div key={i} className="rounded-xl border bg-card p-4">
              <Skeleton className="h-3 w-20 rounded-md" />
              <Skeleton className="mt-3 h-7 w-16 rounded-lg" />
              <Skeleton className="mt-2 h-3 w-28 rounded-md" />
            </div>
          ))}
        </div>
      )}

      {/* body rows */}
      <div className="overflow-hidden rounded-xl border bg-card">
        <div className="flex items-center gap-4 border-b px-4 py-3">
          <Skeleton className="h-4 w-32 rounded-md" />
          <Skeleton className="h-4 w-20 rounded-md" />
          <Skeleton className="ml-auto h-4 w-24 rounded-md" />
        </div>
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 border-b px-4 py-3.5 last:border-b-0">
            <Skeleton className="h-4 flex-1 rounded-md" />
            <Skeleton className="h-4 w-24 rounded-md" />
            <Skeleton className="h-5 w-16 rounded-full" />
            <Skeleton className="h-4 w-16 rounded-md" />
          </div>
        ))}
      </div>
    </div>
  );
}

export default PageSkeleton;
