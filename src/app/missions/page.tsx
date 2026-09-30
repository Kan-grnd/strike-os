"use client";

import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Brain, Target, ArrowRight, RefreshCw } from "lucide-react";
import { useState } from "react";
import { useMissions } from "@/hooks/useApi";
import { formatCost, formatDuration } from "@/lib/utils";
import { MISSION_STATUS_COLOR, missionProgress } from "@/lib/execution-meta";

export default function MissionsPage() {
  const [search, setSearch] = useState("");
  const { data, error, isLoading, mutate } = useMissions();
  const missions = (data?.missions || []).filter(
    (m: any) => !search || m.goal.toLowerCase().includes(search.toLowerCase())
  );

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

      {error && (
        <Card className="p-12 text-center space-y-4">
          <p className="text-lg font-medium text-destructive">Failed to load missions</p>
          <p className="text-sm text-muted-foreground">{error.message}</p>
          <Button variant="outline" onClick={() => mutate()} className="gap-2">
            <RefreshCw className="h-4 w-4" /> Retry
          </Button>
        </Card>
      )}

      {isLoading && !error && missions.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">Loading missions...</div>
      )}

      {!isLoading && !error && missions.length === 0 && (
        <Card className="p-12 text-center">
          <Brain className="h-12 w-12 mx-auto text-faint mb-4" />
          <p className="text-lg font-medium">No missions yet</p>
          <p className="text-sm text-muted-foreground mt-1">Create your first mission</p>
          <Link href="/missions/new"><Button className="mt-4 gap-2"><Plus className="h-4 w-4" /> Create Mission</Button></Link>
        </Card>
      )}

      <div className="grid gap-4">
        {missions.map((m: any) => {
          const prog = missionProgress(m);
          const failedPct = prog.total ? Math.round((prog.failed / prog.total) * 100) : 0;
          const cancelledPct = prog.total ? Math.round((prog.cancelled / prog.total) * 100) : 0;
          return (
            <Link key={m.id} href={`/missions/${m.id}`}>
              <Card className="p-6 hover:border-primary/40 transition-colors cursor-pointer group">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold">{m.goal}</h3>
                      <Badge className={MISSION_STATUS_COLOR[m.status] || "bg-muted text-muted-foreground"}>{m.status}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">Priority {m.priority} • Created {new Date(m.createdAt).toLocaleDateString()}</p>
                    <div className="mt-3">
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span>Progress</span>
                        <span>
                          {prog.pct}%
                          {prog.failed > 0 && <span className="text-destructive">{` · ${prog.failed} failed`}</span>}
                          {prog.cancelled > 0 && <span className="text-faint">{` · ${prog.cancelled} cancelled`}</span>}
                        </span>
                      </div>
                      <div
                        className="h-2 w-full rounded-full bg-muted overflow-hidden flex"
                        role="progressbar"
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-valuenow={prog.pct}
                        aria-label="Mission progress"
                      >
                        {prog.pct > 0 && <div className="h-full rounded-l-full bg-primary" style={{ width: `${prog.pct}%` }} />}
                        {failedPct > 0 && <div className="h-full bg-destructive" style={{ width: `${failedPct}%` }} />}
                        {cancelledPct > 0 && <div className="h-full rounded-r-full bg-muted-foreground/40" style={{ width: `${cancelledPct}%` }} />}
                      </div>
                    </div>
                    <div className="flex items-center gap-4 mt-2 text-xs text-faint">
                      <span>{prog.total} tasks</span>
                      <span>{formatCost(m.totalCost)}</span>
                      <span>{formatDuration(m.duration)}</span>
                    </div>
                  </div>
                  <ArrowRight className="h-5 w-5 text-faint group-hover:text-foreground transition-colors shrink-0" />
                </div>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}