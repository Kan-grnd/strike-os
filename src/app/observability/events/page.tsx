"use client";

import { useState, useEffect, useRef } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Activity, Sparkles, Play, Brain, Zap, Database, Network } from "lucide-react";
import { cn } from "@/lib/utils";
import useSWR from "swr";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

const eventIcon = (type: string) => {
  if (type.includes("agent")) return <Brain className="h-3.5 w-3.5" />;
  if (type.includes("mission")) return <Zap className="h-3.5 w-3.5" />;
  if (type.includes("task")) return <Activity className="h-3.5 w-3.5" />;
  if (type.includes("memory")) return <Database className="h-3.5 w-3.5" />;
  if (type.includes("mcp") || type.includes("tool")) return <Network className="h-3.5 w-3.5" />;
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

  const { data } = useSWR("/api/events?limit=50", fetcher, { revalidateOnFocus: false });

  // Initialize events from SWR
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
        const data = JSON.parse(event.data);
        if (data.type && !filter || data.type.toLowerCase().includes(filter.toLowerCase())) {
          setEvents((prev) => [data, ...prev].slice(0, 200));
        }
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

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Events</h1>
          <p className="text-sm text-muted-foreground">Live event stream from the workforce</p>
        </div>
        <div className="flex items-center gap-2">
          {streaming ? (
            <Button variant="outline" onClick={() => { /* stopStream() */ }} className="gap-2">
              <Play className="h-4 w-4" /> Resume
            </Button>
          ) : (
            <Button onClick={startStream} className="gap-2">
              <Sparkles className="h-4 w-4" /> Connect Stream
            </Button>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-faint" />
          <input
            placeholder="Filter events..."
            className="pl-9 h-10 rounded-md border bg-background px-3 text-sm"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          />
        </div>
      </div>

      <Card className="p-4">
        <div className="space-y-1 max-h-[600px] overflow-auto">
          {events
            .filter((e: any) => !filter || e.type.toLowerCase().includes(filter.toLowerCase()))
            .map((e: any) => (
              <div key={e.id} className="flex items-start gap-3 text-sm p-2 hover:bg-muted/30 rounded">
                <div className={cn("rounded-md p-2 shrink-0", eventColor(e.type))}>
                  {eventIcon(e.type)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs">{e.type}</span>
                    {e.subject && (
                      <Badge variant="outline" className="text-xs font-normal">{e.subject}</Badge>
                    )}
                    <span className="text-xs text-faint">{new Date(e.timestamp).toLocaleTimeString()}</span>
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5 truncate">
                    Source: <span className="font-medium text-foreground">{e.source}</span>
                    {e.agentId && (
                      <span className="ml-2">Agent: <span className="font-medium text-foreground">{e.agentId}</span></span>
                    )}
                  </div>
                  {e.payload && e.payload !== "{}" && (
                    <div className="text-xs text-faint mt-1 bg-muted/50 rounded px-2 py-1 font-mono truncate max-w-xl">
                      {typeof e.payload === "string" ? e.payload.slice(0, 200) : JSON.stringify(e.payload).slice(0, 200)}
                    </div>
                  )}
                </div>
              </div>
            ))}
        </div>
      </Card>
    </div>
  );
}