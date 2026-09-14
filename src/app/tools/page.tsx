"use client";

import useSWR from "swr";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Wrench, ExternalLink, Globe, Zap, Play } from "lucide-react";
import { useState } from "react";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

const sourceBadge: Record<string, { label: string; color: string }> = {
  NATIVE: { label: "Native", color: "bg-primary/20 text-primary" },
  MCP: { label: "MCP", color: "bg-purple/20 text-purple" },
  API: { label: "API", color: "bg-amber/20 text-amber" },
  INTEGRATION: { label: "Integration", color: "bg-emerald/20 text-emerald" },
};

const healthColor: Record<string, string> = {
  healthy: "bg-success",
  degraded: "bg-warning",
  unknown: "bg-muted-foreground",
  error: "bg-destructive",
};

export default function ToolsPage() {
  const { data } = useSWR("/api/tools", fetcher);
  const [search, setSearch] = useState("");
  const [sourceFilter, setSourceFilter] = useState("");

  const tools = (data?.tools || []).filter((t: any) =>
    (!search ||
      t.name.toLowerCase().includes(search.toLowerCase()) ||
      t.description?.toLowerCase().includes(search.toLowerCase())) &&
    (!sourceFilter || t.source === sourceFilter)
  );

  const sources = Array.from(new Set((data?.tools || []).map((t: any) => t.source))) as string[];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Tools</h1>
          <p className="text-sm text-muted-foreground">Tool Fabric registry — standardized external actions</p>
        </div>
        <Button variant="outline" className="gap-2"><Wrench className="h-4 w-4" /> Add Tool</Button>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-faint" />
          <Input placeholder="Search tools..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <select className="rounded-md border bg-background px-3 py-2 text-sm h-10" value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value)}>
          <option value="">All Sources</option>
          {sources.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {tools.map((t: any) => {
          const sb = sourceBadge[t.source] || { label: t.source, color: "bg-muted" };
          const hc = healthColor[t.health] || "bg-muted-foreground";
          return (
            <Card key={t.id} className="p-5">
              <div className="flex items-start justify-between mb-3">
                <div className="rounded-md bg-muted p-2"><Wrench className="h-5 w-5 text-muted-foreground" /></div>
                <Badge className={sb.color}>{sb.label}</Badge>
              </div>
              <h3 className="font-semibold mb-1">{t.name}</h3>
              <p className="text-xs text-muted-foreground line-clamp-2 mb-3">{t.description || "No description"}</p>
              
              <div className="flex items-center justify-between text-xs mb-3">
                <span className="flex items-center gap-1">
                  <span className={`h-1.5 w-1.5 rounded-full ${hc}`} />
                  <span className="capitalize">{t.health}</span>
                </span>
                <span>${(t.cost || 0).toFixed(4)} / call</span>
              </div>

              <div className="flex flex-wrap gap-1 mb-3">
                <Badge variant="outline" className="text-[10px]">Timeout: {t.timeout ? `${t.timeout / 1000}s` : "—"}</Badge>
                <Badge variant="outline" className="text-[10px]">Calls: {t.totalCalls || 0}</Badge>
              </div>

              <div className="pt-3 border-t flex gap-2">
                <Button size="sm" variant="outline" className="flex-1 gap-1"><Play className="h-3.5 w-3.5" /> Test</Button>
                <Button size="sm" variant="outline" className="flex-1 gap-1"><ExternalLink className="h-3.5 w-3.5" /> Schema</Button>
              </div>
            </Card>
          );
        })}
      </div>

      {!tools.length && <div className="text-center py-12 text-muted-foreground">No tools match your filters</div>}
    </div>
  );
}