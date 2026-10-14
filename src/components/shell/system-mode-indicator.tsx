"use client";

import { useEffect, useState } from "react";
import { FlaskConical } from "lucide-react";

/**
 * App-wide simulation-mode indicator.
 *
 * Shown in the persistent header, so it is present on every top-level surface.
 * Reads /api/health; when no model provider is configured, every task result is
 * simulated — never disguised as real. [D18]
 */
export function SystemModeIndicator() {
  const [simulated, setSimulated] = useState<boolean | null>(null);

  useEffect(() => {
    let alive = true;
    fetch("/api/health")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (alive) setSimulated(d?.simulated === true);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  if (simulated !== true) return null;

  return (
    <span
      role="status"
      aria-label="Simulation mode: no model provider is configured, so all task output is simulated, not real."
      title="No model provider is configured. All task output is simulated, not real."
      className="inline-flex items-center gap-1.5 rounded-full border border-warning/30 bg-warning/10 px-2.5 py-1 text-[11px] font-medium uppercase tracking-wide text-warning"
    >
      <FlaskConical className="h-3 w-3" aria-hidden="true" />
      Simulated
    </span>
  );
}
