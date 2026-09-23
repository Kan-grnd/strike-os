import { Badge } from "@/components/ui/badge";
import { useConnection } from "@/lib/runtime/useRuntime";

const CONNECTION_STYLES: Record<
  "CONNECTED" | "DISCONNECTED" | "RECONNECTING",
  { variant?: "success" | "destructive" | "warning"; dot: string; label: string }
> = {
  CONNECTED: { variant: "success", dot: "bg-emerald-500", label: "Live" },
  DISCONNECTED: { variant: "destructive", dot: "bg-red-500", label: "Disconnected" },
  RECONNECTING: { variant: "warning", dot: "bg-amber-500", label: "Reconnecting…" },
};

export function ConnectionBadge() {
  const connection = useConnection();
  const style = CONNECTION_STYLES[connection];
  return (
    <div className="fixed top-4 right-4 z-50">
      <Badge variant={style.variant}>
        <span className="flex items-center gap-1.5">
          <span className={`h-1.5 w-1.5 rounded-full ${style.dot} animate-pulse`} />
          {style.label}
        </span>
      </Badge>
    </div>
  );
}