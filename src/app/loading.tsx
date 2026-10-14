import { PageSkeleton } from "@/components/shared/page-skeleton";

/**
 * App-level loading UI (M4.5). Shown while a route segment resolves, inside the
 * shell, so navigation never flashes an empty content area.
 */
export default function Loading() {
  return <PageSkeleton />;
}
