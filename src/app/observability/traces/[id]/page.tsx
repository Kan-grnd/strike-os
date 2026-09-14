"use client";

import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, Activity, Zap } from "lucide-react";
import useSWR from "swr";
import Link from "next/link";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export default function TraceDetailPage({ params }: { params: { id: string } }) {
  const { data } = useSWR(`/api/observability/traces/${params.id}`, fetcher);
  const trace = data?.trace;

  if (!trace) return <div className="p-6">Loading trace...</div>;

  return (
    <div className="p-6 space-y-6">
      <Link href="/observability/traces">
        <Button variant="ghost" size="sm" className="gap-2"><ArrowLeft className="h-4 w-4" /> Back to Traces</Button>
      </Link>

      <div>
        <div className="flex items-center gap-2 mb-1">
          <h1 className="text-2xl font-bold">Trace</h1>
          <Badge variant="outline">{trace.id?.slice(0, 8)}</Badge>
        </div>
        <p className="text-sm text-muted-foreground">Execution trace — mission → agent → model → tool</p>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <Card className="p-4"><p className="text-xs text-muted-foreground">Mission</p><p className="font-mono text-sm">{trace.missionId?.slice(0, 8) || "—"}</p></Card>
        <Card className="p-4"><p className="text-xs text-muted-foreground">Task</p><p className="font-mono text-sm">{trace.taskId?.slice(0, 8) || "—"}</p></Card>
        <Card className="p-4"><p className="text-xs text-muted-foreground">Agent</p><p className="font-mono text-sm">{trace.agentId?.slice(0, 8) || "—"}</p></Card>
        <Card className="p-4"><p className="text-xs text-muted-foreground">Duration</p><p className="font-bold">{trace.duration ? `${trace.duration}ms` : "—"}</p></Card>
      </div>

      <Card className="p-6">
        <h2 className="font-semibold mb-3 flex items-center gap-2"><Zap className="h-4 w-4" /> Trace Events</h2>
        <div className="space-y-2">
          {JSON.parse(trace.events || "[]").map((e: any, i: number) => (
            <div key={i} className="flex items-center gap-3 text-sm p-2 rounded-md bg-muted/30">
              <Activity className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="font-mono text-xs">{e.type || "event"}</span>
              <span className="text-xs text-faint">{new Date(e.timestamp || Date.now()).toLocaleTimeString()}</span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}