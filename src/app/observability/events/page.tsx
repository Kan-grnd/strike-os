"use client";

import { useState, useEffect, useRef } from "react";
import useSWR from "swr";
import { motion } from "motion/react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader, EASE } from "@/components/shared/page-header";
import { cn } from "@/lib/utils";
import {
  Search,
  Activity,
  Sparkles,
  Brain,
  Zap,
  Database,
  Network,
  Radio,
  X,
} from "lucide-react";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

const eventIcon = (type: string) => {
  if (type.includes("agent")) return <Brain className="h-3.5 w-3.5" />;
  if (type.includes("mission")) return <Zap className="h-3.5 w-3.5" />;
  if (type.includes("task")) return <Activity className="h-3.5 w-3.5" />;
  if (type.includes("memory")) return <Database className="h-3.5 w-3.5" />;
  if (type.includes("mcp") || type.includes("tool"))
    return <Network className="h-3.5 w-3.5" />;
  return <Activity className="h-3.5 w-3.5" />;
};

const eventColor = (type: string) => {
  if (type.includes("created") || type.includes("started") || type.includes("completed"))
    return "bg-success/10 text-success";
  if (type.includes("failed")) return "bg-destructive/10 text-destructive";
  return "bg-muted text-muted-foreground";
};

export default function EventsPage() {
  const [filter, setFilter] = useState("");
  const [streaming, setStreaming] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);
  const [events, setEvents] = useState<any[]>([]);

  const { data } = useSWR("/api/events?limit=50", fetcher, {
    revalidateOnFocus: false,
  });

  useEffect(() => {
    if (data?.events) setEvents(data.events);
  }, [data]);

  const startStream = () => {
    if (eventSourceRef.current) return;
    setStreaming(true);
    const es = new EventSource("/api/observability/events");
    eventSourceRef.current = es;
    es.onmessage = (event) => {
      try {
        const incoming = JSON.parse(event.data);
        setEvents((prev) => [incoming, ...prev].slice(0, 200));
      } catch {}
    };
    es.onerror = () => {
      setStreaming(false);
      eventSourceRef.current?.close();
      eventSourceRef.current = null;
    };
  };

  const stopStream = () => {
    eventSourceRef.current?.close();
    eventSourceRef.current = null;
    setStreaming(false);
  };

  useEffect(() => {
    return () => stopStream();
  }, []);

  const visible = events.filter(
    (e: any) => !filter || e.type.toLowerCase().includes(filter.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Activity}
        eyebrow="Observability"
        title="Events"
        description="Live event stream from the workforce."
        actions={
          streaming ? (
            <Button variant="outline" onClick={stopStream} className="gap-2">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-success" />
              </span>
              Disconnect
            </Button>
          ) : (
            <Button onClick={startStream} className="gap-2">
              <Sparkles className="h-4 w-4" /> Connect stream
            </Button>
          )
        }
      />

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" />
        <Input
          placeholder="Filter events…"
          aria-label="Filter events"
          className="pl-9 pr-9"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
        {filter && (
          <button
            type="button"
            onClick={() => setFilter("")}
            aria-label="Clear search"
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {visible.length ? (
        <Card
          tabIndex={0}
          className="max-h-[640px] overflow-auto p-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <div className="divide-y">
            {visible.map((e: any, i: number) => (
              <motion.div
                key={e.id ?? `${e.type}-${i}`}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25, delay: Math.min(i * 0.02, 0.2), ease: EASE }}
                className="flex items-start gap-3 p-2"
              >
                <div className={cn("shrink-0 rounded-md p-2", eventColor(e.type))}>
                  {eventIcon(e.type)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs">{e.type}</span>
                    {e.subject && (
                      <Badge variant="outline" className="text-xs font-normal">
                        {e.subject}
                      </Badge>
                    )}
                    <span className="text-xs tabular-nums text-muted-foreground">
                      {new Date(e.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                  <div className="mt-0.5 truncate text-xs text-muted-foreground">
                    Source: <span className="font-medium text-foreground">{e.source}</span>
                    {e.agentId && (
                      <span className="ml-2">
                        Agent: <span className="font-medium text-foreground">{e.agentId}</span>
                      </span>
                    )}
                  </div>
                  {e.payload && e.payload !== "{}" && (
                    <div className="mt-1 max-w-xl truncate rounded bg-muted/50 px-2 py-1 font-mono text-xs text-muted-foreground">
                      {typeof e.payload === "string"
                        ? e.payload.slice(0, 200)
                        : JSON.stringify(e.payload).slice(0, 200)}
                    </div>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        </Card>
      ) : (
        <EmptyState
          icon={Radio}
          title="No events yet"
          description="Connect the stream to watch the workforce emit events live."
        />
      )}
    </div>
  );
}