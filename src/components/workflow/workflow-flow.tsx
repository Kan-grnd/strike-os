import React from "react";

/**
 * Simple vertical workflow flow card — no drag/drop needed.
 * Shows the action sequence of a workflow/automation.
 */
export function WorkflowFlow({ actions = [], title }: { actions?: Array<{ type: string; config?: Record<string, unknown> }>; title?: string }) {
  return (
    <div className="space-y-3 p-4 bg-muted/30 rounded-xl border">
      {title && <p className="font-semibold text-sm">{title}</p>}
      <div className="flex flex-col gap-3 relative">
        {/* Vertical connecting line */}
        <div className="absolute left-6 top-2 bottom-2 w-px bg-border" />
        
        {actions.map((action, i) => (
          <div key={i} className="flex items-start gap-3 relative z-10">
            <div className="h-6 w-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold shrink-0 z-10 shadow-sm">
              {i + 1}
            </div>
            <div className="flex-1 min-w-0 rounded-lg border glass px-3 py-2">
              <div className="flex items-center justify-between">
                <span className="font-medium text-sm">{action.type}</span>
                <span className="text-xs text-faint font-mono">{String(action.config?.goal || "no details")}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
