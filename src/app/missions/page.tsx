"use client";

import useSWR from "swr";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Brain, Target, ArrowRight } from "lucide-react";
import { useState } from "react";

const fetcher = (url: string) => fetch(url).then((r) => r.json());
const statusColor: Record<string, string> = {
  PLANNING: "bg-muted text-muted-foreground",
  READY: "bg-muted text-muted-foreground",
  RUNNING: "bg-success/10 text-success",
  PAUSED: "bg-info/10 text-info",
  BLOCKED: "bg-warning/10 text-warning",
  COMPLETED: "bg-success/10 text-success",
  FAILED: "bg-destructive/10 text-destructive",
  CANCELLED: "bg-muted text-faint",
};

export default function MissionsPage() {
  const [search, setSearch] = useState("");
  const { data, isLoading } = useSWR("/api/missions", fetcher);
  const missions = (data?.missions || []).filter(
    (m: any) => !search || m.goal.toLowerCase().includes(search.toLowerCase())
  );

  const progress = (m: any) => {
    if (!m.tasks) return 0;
    const completed = m.tasks.filter((t: any) => t.status === "COMPLETED").length;
    return Math.round((completed / m.tasks.length) * 100);
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Missions</h1>
          <p className="text-sm text-muted-foreground">Goals that drive agent execution</p>
        </div>
        <Link href="/missions/new">
          <Button className="gap-2"><Plus className="h-4 w-4" /> New Mission</Button>
        </Link>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Target className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-faint" />
          <Input placeholder="Search missions..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </div>

      {isLoading && missions.length === 0 && <div className="text-center py-12 text-muted-foreground">Loading missions...</div>}
      {!isLoading && missions.length === 0 && (
        <Card className="p-12 text-center">
          <Brain className="h-12 w-12 mx-auto text-faint mb-4" />
          <p className="text-lg font-medium">No missions yet</p>
          <p className="text-sm text-muted-foreground mt-1">Create your first mission</p>
          <Link href="/missions/new"><Button className="mt-4 gap-2"><Plus className="h-4 w-4" /> Create Mission</Button></Link>
        </Card>
      )}

      <div className="grid gap-4">
        {missions.map((m: any) => (
          <Link key={m.id} href={`/missions/${m.id}`}>
            <Card className="p-6 hover:border-primary/40 transition-colors cursor-pointer group">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold">{m.goal}</h3>
                    <Badge className={statusColor[m.status] || "bg-muted text-muted-foreground"}>{m.status}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">Priority {m.priority} • Created {new Date(m.createdAt).toLocaleDateString()}</p>
                  <div className="mt-3">
                    <div className="flex items-center justify-between text-xs mb-1"><span>Progress</span><span>{progress(m)}%</span></div>
                    <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                      <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${progress(m)}%` }} />
                    </div>
                  </div>
                  <div className="flex items-center gap-4 mt-2 text-xs text-faint">
                    <span>{m.tasks?.length || 0} tasks</span>
                    <span>${m.totalCost?.toFixed(4) || "0"}</span>
                    <span>{m.duration ? `${Math.round(m.duration / 1000)}s` : "—"}</span>
                  </div>
                </div>
                <ArrowRight className="h-5 w-5 text-faint group-hover:text-foreground transition-colors shrink-0" />
              </div>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
