"use client";

import { useState } from "react";
import useSWR from "swr";
import { motion } from "motion/react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader, EASE } from "@/components/shared/page-header";
import {
  Globe,
  Cpu,
  Zap,
  Play,
  Plus,
  Wrench,
  Network,
  Webhook,
  Cable,
} from "lucide-react";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

const authBadge: Record<string, { label: string; className: string }> = {
  API_KEY: { label: "API Key", className: "bg-blue/20 text-blue" },
  BEARER: { label: "Bearer Token", className: "bg-purple/20 text-purple" },
  BASIC: { label: "Basic Auth", className: "bg-amber/20 text-amber" },
  OAUTH: { label: "OAuth", className: "bg-emerald/20 text-emerald" },
  NONE: { label: "None", className: "bg-muted" },
};

function Stat({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number | string;
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

export default function ConnectorsPage() {
  const [activeTab, setActiveTab] = useState("connections");
  const { data: connectionsData } = useSWR("/api/connectors", fetcher);
  const connections = connectionsData?.connections || [];
  const { data: endpointsData } = useSWR("/api/connectors/endpoints", fetcher);
  const endpoints = endpointsData?.endpoints || [];
  const { data: webhooksData } = useSWR("/api/connectors/webhooks", fetcher);
  const webhooks = webhooksData?.webhooks || [];

  return (
    <div className="mx-auto max-w-[1400px] space-y-6">
      <PageHeader
        backHref="/"
        icon={Globe}
        eyebrow="Integrations"
        title="Connectors"
        description="External API integrations, endpoints, and webhooks."
        actions={
          <Button className="gap-2">
            <Plus className="h-4 w-4" /> Add connection
          </Button>
        }
      />

      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border bg-border lg:grid-cols-4">
        <Stat icon={Globe} label="Connections" value={connections.length} />
        <Stat icon={Network} label="Endpoints" value={endpoints.length} />
        <Stat icon={Webhook} label="Webhooks" value={webhooks.length} />
        <Stat
          icon={Cable}
          label="Active webhooks"
          value={webhooks.filter((w: any) => w.status === "active").length}
        />
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="w-full">
          <TabsTrigger className="flex-1" value="connections">
            API connections
          </TabsTrigger>
          <TabsTrigger className="flex-1" value="endpoints">
            Endpoints
          </TabsTrigger>
          <TabsTrigger className="flex-1" value="webhooks">
            Webhooks
          </TabsTrigger>
          <TabsTrigger className="flex-1" value="integrations">
            Integrations
          </TabsTrigger>
        </TabsList>

        <TabsContent value="connections" className="pt-6">
          {connections.length === 0 ? (
            <EmptyState
              icon={Globe}
              title="No API connections yet"
              description="Add an external API to convert its endpoints into tools."
              action={
                <Button className="gap-2">
                  <Plus className="h-4 w-4" /> Add connection
                </Button>
              }
            />
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {connections.map((c: any, i: number) => {
                const ab = authBadge[c.authType] || {
                  label: c.authType,
                  className: "bg-muted",
                };
                return (
                  <motion.div
                    key={c.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.35, delay: Math.min(i * 0.05, 0.4), ease: EASE }}
                  >
                    <Card className="flex h-full flex-col p-5 transition-colors hover:border-ring/40">
                      <div className="mb-3 flex items-start justify-between">
                        <div className="rounded-md bg-muted p-2">
                          <Globe className="h-5 w-5 text-muted-foreground" />
                        </div>
                        <Badge className={ab.className}>{ab.label}</Badge>
                      </div>
                      <h3 className="mb-1 font-semibold">{c.name}</h3>
                      <p className="mb-3 truncate font-mono text-xs text-muted-foreground">
                        {c.baseUrl}
                      </p>
                      <div className="mb-3 flex items-center gap-2 text-xs">
                        <Badge variant="outline">{c.endpoints || 0} endpoints</Badge>
                        <Badge variant="outline">{c.webhooks || 0} webhooks</Badge>
                      </div>
                      <div className="mt-auto flex gap-2 border-t pt-3">
                        <Button size="sm" variant="outline" className="flex-1 gap-1">
                          <Play className="h-3.5 w-3.5" /> Test
                        </Button>
                        <Button size="sm" variant="outline" className="flex-1 gap-1">
                          <Cpu className="h-3.5 w-3.5" /> Import schema
                        </Button>
                      </div>
                    </Card>
                  </motion.div>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="endpoints" className="pt-6">
          {endpoints.length ? (
            <div className="grid gap-3">
              {endpoints.map((e: any, i: number) => (
                <motion.div
                  key={e.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: Math.min(i * 0.03, 0.3), ease: EASE }}
                >
                  <Card className="flex flex-wrap items-center justify-between gap-3 p-4 transition-colors hover:border-ring/40">
                    <div className="flex min-w-0 items-center gap-3">
                      <Badge variant="outline" className="font-mono">
                        {e.method}
                      </Badge>
                      <span className="truncate font-mono text-sm">{e.path}</span>
                      <Badge variant="outline">{e.connectionName || "Unknown"}</Badge>
                    </div>
                    <Button variant="outline" size="sm" className="gap-1">
                      <Wrench className="h-3.5 w-3.5" /> Convert to tool
                    </Button>
                  </Card>
                </motion.div>
              ))}
            </div>
          ) : (
            <EmptyState
              icon={Network}
              title="No endpoints imported yet"
              description="Add a connection and import its schema to see endpoints here."
            />
          )}
        </TabsContent>

        <TabsContent value="webhooks" className="pt-6">
          {webhooks.length ? (
            <div className="grid gap-3 md:grid-cols-2">
              {webhooks.map((w: any, i: number) => (
                <motion.div
                  key={w.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: Math.min(i * 0.04, 0.3), ease: EASE }}
                >
                  <Card className="flex items-center justify-between gap-3 p-4 transition-colors hover:border-ring/40">
                    <div className="min-w-0">
                      <p className="truncate font-mono text-sm">{w.url}</p>
                      <p className="text-xs text-muted-foreground">
                        {w.events?.join(", ") || "All events"}
                      </p>
                    </div>
                    <Badge variant={w.status === "active" ? "success" : "destructive"}>
                      {w.status}
                    </Badge>
                  </Card>
                </motion.div>
              ))}
            </div>
          ) : (
            <EmptyState
              icon={Webhook}
              title="No webhooks configured"
              description="Inbound webhooks from your connections will be listed here."
            />
          )}
        </TabsContent>

        <TabsContent value="integrations" className="pt-6">
          <EmptyState
            icon={Zap}
            title="No custom integrations yet"
            description="Add custom integration code for complex workflows."
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}