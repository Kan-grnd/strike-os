import Link from "next/link";
import { Compass } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";

/**
 * 404 (M4.5). Rendered inside the shell for any unmatched route — an honest
 * "this does not exist" with the way back to the Control Center, rather than the
 * framework default.
 */
export default function NotFound() {
  return (
    <div className="mx-auto max-w-[1400px] py-10">
      <EmptyState
        icon={Compass}
        title="Page not found"
        description="That route does not exist. It may have been moved or retired in a redesign."
        action={
          <Button asChild>
            <Link href="/">Back to Control Center</Link>
          </Button>
        }
      />
    </div>
  );
}
