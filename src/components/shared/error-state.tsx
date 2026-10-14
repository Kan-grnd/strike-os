import * as React from "react";
import { AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Honest, retryable error presentation (M4.5). Used by the app-level error
 * boundary and inline data errors. Never a blank pane, never a bare spinner:
 * it says what failed, keeps the detail available, and offers a way forward.
 */
export function ErrorState({
  title = "Something went wrong",
  description = "The surface failed to load. You can retry, or head back.",
  detail,
  onRetry,
  retryLabel = "Try again",
  secondary,
  icon: Icon = AlertTriangle,
  className,
}: {
  title?: string;
  description?: string;
  /** The raw message/code, shown muted so it is useful but not shouting. */
  detail?: string;
  onRetry?: () => void;
  retryLabel?: string;
  secondary?: React.ReactNode;
  icon?: React.ComponentType<{ className?: string }>;
  className?: string;
}) {
  return (
    <div
      role="alert"
      className={cn(
        "flex flex-col items-center justify-center rounded-xl border border-destructive/30 bg-destructive/5 px-6 py-12 text-center",
        className
      )}
    >
      <div className="mb-3 rounded-xl bg-destructive/10 p-3">
        <Icon className="h-6 w-6 text-destructive" />
      </div>
      <p className="text-sm font-medium">{title}</p>
      <p className="mt-1 max-w-md text-xs text-muted-foreground">{description}</p>
      {detail && (
        <p className="mt-2 max-w-md truncate font-mono text-[11px] text-muted-foreground/80">{detail}</p>
      )}
      <div className="mt-4 flex items-center gap-2">
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
          >
            {retryLabel}
          </button>
        )}
        {secondary}
      </div>
    </div>
  );
}
