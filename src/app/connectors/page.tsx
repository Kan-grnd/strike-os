"use client";

import { useState } from "react";
import useSWR from "swr";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Globe, Cpu, Zap, Play, ExternalLink, Plus, Wrench } from "lucide-react";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

const authBadge: Record<string, { label: string; color: string }> = {
  API_KEY: { label: "API Key", color: "bg-blue/20 text-blue" },
  BEARER: { label: "Bearer Token", color: "bg-purple/20 text-purple" },
  BASIC: { label: "Basic Auth", color: "bg-amber/20 text-amber" },
  OAUTH: { label: "OAuth", color: "bg-emerald/20 text-emerald" },
  NONE: { label: "None", color: "bg-muted" },
};

export default function ConnectorsPage() {
  const [activeTab, setActiveTab] = useState("connections");
  const { data: connectionsData } = useSWR("/api/connectors", fetcher);
  const connections = connectionsData?.connections || [];
  const { data: endpointsData } = useSWR("/api/connectors/endpoints", fetcher);
  const endpoints = endpointsData?.endpoints || [];
  const { data: webhooksData } = useSWR("/api/connectors/webhooks", fetcher);
  const webhooks = webhooksData?.webhooks || [];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">API Connections</h1>
          <p className="text-sm text-muted-foreground">External API integrations, endpoints, and webhooks</p>
        </div>
        <Button className="gap-2"><Plus className="h-4 w-4" /> Add Connection</Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="w-full">
          <TabsTrigger className="flex-1" value="connections">API Connections</TabsTrigger>
          <TabsTrigger className="flex-1" value="endpoints">Endpoints</TabsTrigger>
          <TabsTrigger className="flex-1" value="webhooks">Webhooks</TabsTrigger>
          <TabsTrigger className="flex-1" value="integrations">Integrations</TabsTrigger>
        </TabsList>

        <TabsContent value="connections" className="pt-6">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {connections.map((c: any) => {
              const ab = authBadge[c.authType] || { label: c.authType, color: "bg-muted" };
              return (
                <Card key={c.id} className="p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div className="rounded-md bg-muted p-2"><Globe className="h-5 w-5 text-muted-foreground" /></div>
                    <Badge className={ab.color}>{ab.label}</Badge>
                  </div>
                  <h3 className="font-semibold mb-1">{c.name}</h3>
                  <p className="text-xs text-muted-foreground mb-3">{c.baseUrl}</p>
                  <div className="flex items-center gap-3 text-xs mb-3">
                    <Badge variant="outline">{c.endpoints || 0} endpoints</Badge>
                    <Badge variant="outline">{c.webhooks || 0} webhooks</Badge>
                  </div>
                  <div className="pt-3 border-t flex gap-2">
                    <Button size="sm" variant="outline" className="flex-1 gap-1"><Play className="h-3.5 w-3.5" /> Test</Button>
                    <Button size="sm" variant="outline" className="flex-1 gap-1"><Cpu className="h-3.5 w-3.5" /> Import Schema</Button>
                  </div>
                </Card>
              );
            })}
            {!connections.length && (
              <Card className="p-12 text-center col-span-full">
                <Globe className="h-12 w-12 mx-auto text-faint mb-4" />
                <p className="text-lg font-medium">No API connections yet</p>
                <p className="text-sm text-muted-foreground mt-1">Add an external API to convert its endpoints into tools</p>
              </Card>
            )}
          </div>
        </TabsContent>

        <TabsContent value="endpoints" className="pt-6">
          <div className="grid gap-3">
            {endpoints.map((e: any) => (
              <Card key={e.id} className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Badge variant="outline">{e.method}</Badge>
                    <span className="font-mono text-sm">{e.path}</span>
                    <Badge variant="outline">{e.connectionName || "Unknown"}</Badge>
                  </div>
                  <Button variant="outline" size="sm" className="gap-1"><Wrench className="h-3.5 w-3.5" /> Convert to Tool</Button>
                </div>
              </Card>
            ))}
            {!endpoints.length && <p className="text-muted-foreground text-center py-12">No endpoints imported yet. Add a connection and import its schema.</p>}
          </div>
        </TabsContent>

        <TabsContent value="webhooks" className="pt-6">
          <div className="grid gap-3 md:grid-cols-2">
            {webhooks.map((w: any) => (
              <Card key={w.id} className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-mono text-sm">{w.url}</p>
                    <p className="text-xs text-muted-foreground">{w.events?.join(", ") || "All events"}</p>
                  </div>
                  <Badge variant={w.status === "active" ? "success" : "destructive"}>{w.status}</Badge>
                </div>
              </Card>
            ))}
            {!webhooks.length && <p className="text-muted-foreground text-center py-12">No webhooks configured</p>}
          </div>
        </TabsContent>

        <TabsContent value="integrations" className="pt-6">
          <Card className="p-12 text-center">
            <Zap className="h-12 w-12 mx-auto text-faint mb-4" />
            <p className="text-lg font-medium">No custom integrations yet</p>
            <p className="text-sm text-muted-foreground mt-1">Add custom integration code for complex workflows</p>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}