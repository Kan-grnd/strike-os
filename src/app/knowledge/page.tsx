"use client";

import useSWR, { useSWRConfig } from "swr";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Network, Brain, RefreshCw } from "lucide-react";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export default function KnowledgePage() {
  const { mutate } = useSWRConfig();
  const { data: relationshipsData } = useSWR("/api/relationships", fetcher);
  const { data: memoriesData } = useSWR("/api/memory", fetcher);

  const relationships = relationshipsData?.relationships || [];
  const memories = memoriesData?.memories || [];

  const nodeMap = new Map<string, { id: string; label: string; type: string; count: number }>();

  memories.forEach((m: any) => {
    const key = `memory:${m.id}`;
    nodeMap.set(key, { id: key, label: m.content.slice(0, 40), type: "memory", count: 1 });
  });

  relationships.forEach((r: any) => {
    const fromKey = `${r.fromType}:${r.fromId}`;
    const toKey = `${r.toType}:${r.toId}`;
    if (!nodeMap.has(fromKey)) nodeMap.set(fromKey, { id: fromKey, label: r.fromType, type: r.fromType, count: 1 });
    if (!nodeMap.has(toKey)) nodeMap.set(toKey, { id: toKey, label: r.toType, type: r.toType, count: 1 });
  });

  const nodes = Array.from(nodeMap.values()).slice(0, 50);
  const edges = relationships.slice(0, 100);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Knowledge Graph</h1>
          <p className="text-sm text-muted-foreground">Structured relationships across the workforce</p>
        </div>
        <button onClick={() => mutate(["/api/relationships", "/api/memory"])} className="gap-2 px-3 py-1.5 rounded-md border bg-background hover:bg-accent">Refresh</button>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="p-6 lg:col-span-2 rounded-lg border bg-card">
          <h2 className="font-semibold mb-4 flex items-center gap-2"><span style={{display: 'inline-block', width: '16px', height: '16px', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', borderRadius: '50%'}} /> Graph</h2>
          <div className="rounded-lg bg-muted/30 p-4 min-h-[400px]">
            <div className="space-y-2 max-h-[350px] overflow-auto">
              {nodes.map((node: any) => (
                <div key={node.id} className="flex items-center gap-3 p-3 rounded-lg bg-card border">
                  <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                    <span style={{fontSize: '16px'}}>🧠</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{node.label}</p>
                    <p className="text-xs text-faint">{node.type}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="p-6 rounded-lg border bg-card">
          <h2 className="font-semibold mb-4">Connections</h2>
          <div className="space-y-2 max-h-[300px] overflow-auto">
            {edges.slice(0, 20).map((edge: any, i: number) => (
              <div key={i} className="text-xs text-muted-foreground flex items-center gap-2">
                <span className="font-mono">{edge.fromType}</span>
                <span className="text-faint">→</span>
                <span className="font-mono">{edge.relation}</span>
                <span className="text-faint">→</span>
                <span className="font-mono">{edge.toType}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
