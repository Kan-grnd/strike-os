import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";
import { useConnection, useResync } from "@/lib/runtime/useRuntime";

const CONNECTION_STYLES: Record<
  "CONNECTED" | "DISCONNECTED" | "RECONNECTING",
  { dot: string; label: string }
> = {
  CONNECTED: { dot: "bg-emerald-500", label: "Live" },
  DISCONNECTED: { dot: "bg-red-500", label: "Disconnected" },
  RECONNECTING: { dot: "bg-amber-500", label: "Reconnecting…" },
};

export function ConnectionBadge() {
  const connection = useConnection();
  const resync = useResync();
  const style = CONNECTION_STYLES[connection];
  return (
    // top-[4.5rem] clears the 56px shell header. At top-4 the badge sat
    // underneath it, which was invisible while the header was opaque and
    // became a pulsing green halo through it once the header went glass.
    <div className="fixed top-[4.5rem] right-4 z-[60] flex items-center gap-2">
      <span className="glass-elevated pointer-events-auto rounded-full border px-3 py-1.5 text-xs font-medium text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className={`h-1.5 w-1.5 rounded-full ${style.dot} animate-pulse motion-reduce:animate-none`} />
          {style.label}
        </span>
      </span>
      {connection === "DISCONNECTED" && (
        <Button variant="ghost" size="icon" onClick={resync} aria-label="Retry connection">
          <RefreshCw className="h-4 w-4 animate-spin motion-reduce:animate-none" />
        </Button>
      )}
    </div>
  );
}