"use client";

import { useState } from "react";
import useSWR from "swr";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Activity, Clock, TrendingUp, Zap, CheckCircle2, AlertCircle } from "lucide-react";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export default function ObservabilityPerformancePage() {
  const [range, setRange] = useState("7d");
  const { data } = useSWR(`/api/observability/performance?range=${range}`, fetcher);

  const stats = data || {};

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Performance</h1>
          <p className="text-sm text-muted-foreground">Agent, model, provider, and tool performance metrics</p>
        </div>
        <div className="flex gap-2">
          {["1h", "24h", "7d", "30d"].map((r) => (
            <button key={r} onClick={() => setRange(r)} className={`rounded-md px-3 py-1 text-sm border ${range === r ? "bg-primary text-primary-foreground" : "bg-background"}`}>{r}</button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <Card className="p-4"><p className="text-xs text-muted-foreground">Traces</p><p className="font-bold text-xl">{stats.totalTraces || 0}</p></Card>
        <Card className="p-4"><p className="text-xs text-muted-foreground">Avg Latency</p><p className="font-bold text-xl">{stats.avgLatencyMs || 0}ms</p></Card>
        <Card className="p-4"><p className="text-xs text-muted-foreground">Error Rate</p><p className="font-bold text-xl">{stats.errorRate ? (stats.errorRate * 100).toFixed(1) + "%" : "0%"}</p></Card>
        <Card className="p-4"><p className="text-xs text-muted-foreground">Completed</p><p className="font-bold text-xl">{stats.completedTasks || 0}</p></Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card className="p-6">
          <h2 className="font-semibold mb-4">Agent Performance</h2>
          <div className="space-y-2">
            {(stats.byAgent || []).map((agent: any) => (
              <div key={agent.agent} className="flex items-center justify-between p-2 rounded-md bg-muted/30 text-sm">
                <span className="font-mono truncate">{agent.agent}</span>
                <span>{agent.count} calls • {agent.avgLatencyMs}ms avg</span>
                <span>${agent.totalCost?.toFixed(3)}</span>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="font-semibold mb-4">Provider Health</h2>
          <div className="space-y-2">
            {[{ name: "OmniRoute", lat: 142, ok: true }, { name: "Anthropic", lat: 287, ok: true }, { name: "OpenAI", lat: 198, ok: true }].map((p) => (
              <div key={p.name} className="flex items-center justify-between p-2 rounded-md bg-muted/30">
                <div className="flex items-center gap-2"><span className={`h-2 w-2 rounded-full ${p.ok ? "bg-success" : "bg-destructive"}`} /> <span>{p.name}</span></div>
                <span className="font-mono text-xs">{p.lat}ms</span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
