"use client";

/* Activity → Events. The Observatory split is retired (D23): this surface folds
 * the old Events, Logs and Metrics pages into one tabbed history console, and
 * cost lives with the run itself (/activity/runs/[id]). "One word — Activity". */

import { useState, useEffect, useRef } from "react";
import useSWR from "swr";
import { motion } from "motion/react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader, SectionLabel, EASE } from "@/components/shared/page-header";
import { cn } from "@/lib/utils";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  ScrollText,
  Gauge,
  Clock,
  TriangleAlert,
  CheckCircle2,
} from "lucide-react";

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

const levelColor: Record<string, string> = {
  DEBUG: "bg-muted text-muted-foreground",
  INFO: "bg-success/10 text-success",
  WARN: "bg-warning/10 text-warning",
  ERROR: "bg-destructive/10 text-destructive",
};

const RANGES = ["1h", "24h", "7d", "30d"];

function Stat({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="bg-background p-4">
      <div className="flex items-center gap-2 text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
        <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.16em]">
          {label}
        </span>
      </div>
      <div className="mt-1 text-2xl font-bold tabular-nums">{value}</div>
    </div>
  );
}

/* ── Events (live stream) ──────────────────────────────────────────────────── */
function EventsView() {
  const [filter, setFilter] = useState("");
  const [streaming, setStreaming] = useState(false);
  const eventSourceRef = useRef<EventSource | null>(null);
  const [events, setEvents] = useState<any[]>([]);

  const { data } = useSWR("/api/events?limit=50", fetcher, { revalidateOnFocus: false });

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

  useEffect(() => () => stopStream(), []);

  const visible = events.filter(
    (e: any) => !filter || e.type.toLowerCase().includes(filter.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative max-w-sm flex-1 min-w-[200px]">
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
        {streaming ? (
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
                <div className={cn("shrink-0 rounded-xl p-2", eventColor(e.type))}>
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
                      {typeof e.payload === "string" ? e.payload.slice(0, 200) : JSON.stringify(e.payload).slice(0, 200)}
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

/* ── Logs (folded in) ──────────────────────────────────────────────────────── */
function LogsView() {
  const [filter, setFilter] = useState("");
  const [levelFilter, setLevelFilter] = useState("");
  const { data } = useSWR("/api/observability/logs?limit=200", fetcher);

  const logs = (data?.logs || []).filter(
    (l: any) =>
      (!filter || l.message.toLowerCase().includes(filter.toLowerCase())) &&
      (!levelFilter || l.level === levelFilter)
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-faint" />
          <Input
            placeholder="Search logs…"
            aria-label="Search logs"
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
        <Select value={levelFilter || "all"} onValueChange={(v) => setLevelFilter(v === "all" ? "" : v)}>
          <SelectTrigger className="w-[150px]" aria-label="Filter by level">
            <SelectValue placeholder="Level" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All levels</SelectItem>
            <SelectItem value="DEBUG">Debug</SelectItem>
            <SelectItem value="INFO">Info</SelectItem>
            <SelectItem value="WARN">Warn</SelectItem>
            <SelectItem value="ERROR">Error</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {logs.length ? (
        <Card
          tabIndex={0}
          className="max-h-[640px] overflow-auto p-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <div className="divide-y">
            {logs.map((l: any) => (
              <div
                key={l.id}
                className="flex items-center gap-3 px-2 py-2 text-xs transition-colors hover:bg-muted/40"
              >
                <Badge variant="outline" className={`shrink-0 text-[11px] ${levelColor[l.level] || ""}`}>
                  {l.level}
                </Badge>
                <span className="shrink-0 tabular-nums text-muted-foreground">
                  {new Date(l.createdAt).toLocaleTimeString()}
                </span>
                <span className="shrink-0 text-muted-foreground">{l.service}</span>
                <span className="truncate font-mono">{l.message}</span>
              </div>
            ))}
          </div>
        </Card>
      ) : (
        <EmptyState
          icon={ScrollText}
          title="No logs match"
          description="Try a different search term or level."
        />
      )}
    </div>
  );
}

/* ── Metrics (folded in) ───────────────────────────────────────────────────── */
function MetricsView() {
  const [range, setRange] = useState("7d");
  const { data } = useSWR(`/api/observability/performance?range=${range}`, fetcher);
  const stats = data || {};
  const byAgent: any[] = stats.byAgent || [];

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <div className="inline-flex items-center gap-1 rounded-xl border bg-card p-1">
          {RANGES.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRange(r)}
              className={cn(
                "relative rounded-xl px-3 py-1 text-sm font-medium transition-colors",
                range === r ? "text-foreground" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {range === r && (
                <motion.span
                  layoutId="activity-metric-range"
                  transition={{ type: "spring", stiffness: 400, damping: 32 }}
                  className="absolute inset-0 rounded-xl bg-muted"
                />
              )}
              <span className="relative z-10">{r}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border bg-border lg:grid-cols-4">
        <Stat icon={Activity} label="Traces" value={stats.totalTraces || 0} />
        <Stat icon={Clock} label="Avg latency" value={`${stats.avgLatencyMs || 0}ms`} />
        <Stat
          icon={TriangleAlert}
          label="Error rate"
          value={stats.errorRate ? `${(stats.errorRate * 100).toFixed(1)}%` : "0%"}
        />
        <Stat icon={CheckCircle2} label="Completed" value={stats.completedTasks || 0} />
      </div>

      <section className="space-y-3">
        <SectionLabel>Metrics · by agent</SectionLabel>
        {byAgent.length === 0 ? (
          <Card className="p-8 text-center text-sm text-muted-foreground">
            Per-agent metrics appear here once traces are recorded for the selected window.
          </Card>
        ) : (
          <Card className="divide-y p-2">
            {byAgent.map((agent: any, i: number) => (
              <motion.div
                key={agent.agent}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: Math.min(i * 0.03, 0.3), ease: EASE }}
                className="flex items-center justify-between gap-3 px-3 py-2.5 text-sm"
              >
                <span className="truncate font-mono">{agent.agent}</span>
                <span className="shrink-0 tabular-nums text-muted-foreground">
                  {agent.count} calls · {agent.avgLatencyMs}ms avg · ${agent.totalCost?.toFixed(3)}
                </span>
              </motion.div>
            ))}
          </Card>
        )}
      </section>
    </div>
  );
}

export default function ActivityEventsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        icon={Radio}
        eyebrow="Activity"
        title="Events"
        description="Everything the workforce emitted — the event stream, application logs and performance metrics in one history."
      />

      <Tabs defaultValue="events">
        <TabsList aria-label="History views">
          <TabsTrigger value="events" className="gap-2">
            <Radio className="h-4 w-4" /> Events
          </TabsTrigger>
          <TabsTrigger value="logs" className="gap-2">
            <ScrollText className="h-4 w-4" /> Logs
          </TabsTrigger>
          <TabsTrigger value="metrics" className="gap-2">
            <Gauge className="h-4 w-4" /> Metrics
          </TabsTrigger>
        </TabsList>

        <TabsContent value="events" className="mt-6">
          <EventsView />
        </TabsContent>
        <TabsContent value="logs" className="mt-6">
          <LogsView />
        </TabsContent>
        <TabsContent value="metrics" className="mt-6">
          <MetricsView />
        </TabsContent>
      </Tabs>
    </div>
  );
}
