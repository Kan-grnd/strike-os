"use client";

import useSWR from "swr";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plug, Globe, Cpu, Play, RefreshCw, Wrench } from "lucide-react";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

const statusColor: Record<string, string> = {
  CONNECTED: "bg-success",
  DISCONNECTED: "bg-muted-foreground",
  ERROR: "bg-destructive",
  PENDING: "bg-warning",
};

export default function MCPPage() {
  const { data } = useSWR("/api/mcp", fetcher);
  const connections = data?.connections || [];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">MCP Servers</h1>
          <p className="text-sm text-muted-foreground">Model Context Protocol connections — tool and resource providers</p>
        </div>
        <Button className="gap-2"><Plug className="h-4 w-4" /> Add Connection</Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {connections.map((c: any) => {
          const tools = JSON.parse(c.tools || "[]") as string[];
          const sc = statusColor[c.status] || "bg-muted-foreground";
          return (
            <Card key={c.id} className="p-5">
              <div className="flex items-start justify-between mb-3">
                <div className="rounded-md bg-muted p-2"><Plug className="h-5 w-5 text-muted-foreground" /></div>
                <Badge className={sc}>{c.status}</Badge>
              </div>
              <h3 className="font-semibold mb-1">{c.name}</h3>
              <p className="text-xs text-muted-foreground mb-3">{c.baseUrl}</p>
              
              <div className="flex items-center gap-3 text-xs mb-3">
                <span className="flex items-center gap-1"><Wrench className="h-3 w-3" /> {tools.length} tools</span>
                <span className="flex items-center gap-1"><Globe className="h-3 w-3" /> {c.baseUrl}</span>
              </div>

              <div className="pt-3 border-t flex gap-2">
                <Button size="sm" variant="outline" className="flex-1 gap-1"><Play className="h-3.5 w-3.5" /> Test</Button>
                <Button size="sm" variant="outline" className="flex-1 gap-1"><RefreshCw className="h-3.5 w-3.5" /> Sync Tools</Button>
              </div>
            </Card>
          );
        })}
      </div>

      {!connections.length && (
        <Card className="p-12 text-center">
          <Plug className="h-12 w-12 mx-auto text-faint mb-4" />
          <p className="text-lg font-medium">No MCP connections yet</p>
          <p className="text-sm text-muted-foreground mt-1">Add an MCP server to extend your workforce's capabilities</p>
        </Card>
      )}
    </div>
  );
}