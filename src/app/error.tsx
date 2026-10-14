"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/shared/error-state";

/**
 * App-level error boundary (M4.5). Catches a render/data error anywhere inside
 * the shell so the operator sees an honest, retryable surface instead of a blank
 * frame. `reset()` re-renders the segment; the digest is shown muted for support.
 */
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Surface it in the console too — the boundary is the last line of defence.
    console.error("Route error:", error);
  }, [error]);

  return (
    <div className="mx-auto max-w-[1400px] py-10">
      <ErrorState
        title="This surface failed to load"
        description="Something broke while rendering this page. Retrying is safe — nothing was submitted."
        detail={error.digest || error.message}
        onRetry={reset}
        secondary={
          <Button variant="outline" asChild>
            <Link href="/">Back to Control Center</Link>
          </Button>
        }
      />
    </div>
  );
}
