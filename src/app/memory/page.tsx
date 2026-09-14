"use client";

import { useState } from "react";
import useSWR from "swr";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Database, Plus, Search, Brain, MessageSquare, Users, Target } from "lucide-react";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export default function MemoryPage() {
  const [filter, setFilter] = useState("");
  const [scopeFilter, setScopeFilter] = useState("");
  const { data, isLoading, mutate } = useSWR(`/api/memory?scope=${scopeFilter || ""}`, fetcher);
  const { data: agentsData } = useSWR("/api/agents", fetcher);
  const { data: missionsData } = useSWR("/api/missions", fetcher);
  const agents = agentsData?.agents || [];
  const missions = missionsData?.missions || [];
  const activeAgents = agents.filter((a: any) => a.status === "RUNNING");
  const activeMissions = missions.filter((m: any) => m.status === "RUNNING");
  const memories = (data?.memories || []).filter((m: any) =>
    !filter || m.content.toLowerCase().includes(filter.toLowerCase()) || m.source.toLowerCase().includes(filter.toLowerCase())
  );

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Memory</h1>
          <p className="text-sm text-muted-foreground">Shared context, knowledge, and decisions across the workforce</p>
        </div>
        <Button className="gap-2"><Plus className="h-4 w-4" /> Add Memory</Button>
      </div>

      {/* Now — what's relevant right now across the workforce */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Now</h2>
        <div className="grid gap-4 md:grid-cols-3">
          <Card className="p-6">
            <h3 className="font-semibold mb-4 flex items-center gap-2"><Users className="h-4 w-4" /> Active Agents</h3>
            {activeAgents.length === 0 ? (
              <p className="text-sm text-muted-foreground">No active agents</p>
            ) : (
              <div className="space-y-2">
                {activeAgents.slice(0, 5).map((a: any) => (
                  <div key={a.id} className="flex items-center justify-between text-sm p-2 rounded-md bg-muted/30">
                    <span className="font-medium">{a.name}</span>
                    <Badge variant="outline" className="text-xs">{a.type}</Badge>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card className="p-6">
            <h3 className="font-semibold mb-4 flex items-center gap-2"><Brain className="h-4 w-4" /> Active Missions</h3>
            {activeMissions.length === 0 ? (
              <p className="text-sm text-muted-foreground">No active missions</p>
            ) : (
              <div className="space-y-2">
                {activeMissions.slice(0, 5).map((m: any) => (
                  <div key={m.id} className="flex items-center justify-between text-sm p-2 rounded-md bg-muted/30">
                    <span className="font-medium truncate">{m.goal.slice(0, 40)}</span>
                    <Badge variant="outline" className="text-xs">{m.status}</Badge>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card className="p-6">
            <h3 className="font-semibold mb-4 flex items-center gap-2"><Target className="h-4 w-4" /> Quick Stats</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span>Total Agents</span><span className="font-mono">{agents.length}</span></div>
              <div className="flex justify-between"><span>Running</span><span className="font-mono">{activeAgents.length}</span></div>
              <div className="flex justify-between"><span>Total Missions</span><span className="font-mono">{missions.length}</span></div>
              <div className="flex justify-between"><span>Running</span><span className="font-mono">{activeMissions.length}</span></div>
              <div className="flex justify-between"><span>Total Memories</span><span className="font-mono">{memories.length}</span></div>
            </div>
          </Card>
        </div>
      </section>

      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-faint" />
          <Input placeholder="Search memories..." className="pl-9" value={filter} onChange={(e) => setFilter(e.target.value)} />
        </div>
        <select className="rounded-md border bg-background px-3 py-2 text-sm h-10" value={scopeFilter} onChange={(e) => setScopeFilter(e.target.value)}>
          <option value="">All Scopes</option>
          <option value="GLOBAL">Global</option>
          <option value="USER">User</option>
          <option value="MISSION">Mission</option>
          <option value="AGENT">Agent</option>
          <option value="TOOL">Tool</option>
          <option value="TEMP">Temp</option>
        </select>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {memories.map((m: any) => (
          <Card key={m.id} className="p-5">
            <div className="flex items-start justify-between mb-3">
              <div className="rounded-md bg-muted p-2"><Database className="h-4 w-4 text-muted-foreground" /></div>
              <Badge variant="outline" className="text-xs">{m.scope}</Badge>
            </div>
            <p className="text-sm font-medium leading-relaxed mb-2 line-clamp-3">{m.content}</p>
            <div className="flex items-center justify-between text-xs text-faint">
              <span>From: {m.source}</span>
              <span>Importance: {Math.round(m.importance * 100)}%</span>
            </div>
            <div className="text-xs text-faint">{new Date(m.createdAt).toLocaleDateString()} • Confidence: {Math.round((m.confidence || 1) * 100)}%</div>
          </Card>
        ))}
      </div>

      {isLoading && memories.length === 0 && <div className="text-center py-12 text-muted-foreground">Loading memory...</div>}
      {!isLoading && memories.length === 0 && <div className="text-center py-12 text-muted-foreground">No memories found</div>}
    </div>
  );
}
