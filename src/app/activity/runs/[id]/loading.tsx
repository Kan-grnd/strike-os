import { PageSkeleton } from "@/components/shared/page-skeleton";

/* Detail-route loading UI (M4.5): a header + body skeleton while the run/mission/task loads. */
export default function Loading() {
  return <PageSkeleton kpis={0} rows={5} />;
}
