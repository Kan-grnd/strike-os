"use client";

import Link from "next/link";
import useSWR from "swr";
import { Card } from "@/components/ui/card";
import { Badge, badgeVariants } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Target, RotateCcw, AlertCircle } from "lucide-react";
import { CAPABILITY_CATALOG } from "@/lib/capabilities";
import { cn, safeJsonArray } from "@/lib/utils";

const fetcher = (url: string) =>
  fetch(url).then((r) => {
    if (!r.ok) throw new Error(`Request failed: ${r.status}`);
    return r.json();
  });

export default function CapabilitiesPage() {
  const { data, isLoading, error, mutate } = useSWR("/api/agents", fetcher);
  const agents = data?.agents || [];

  const capabilityAgents: Record<string, any[]> = {};
  agents.forEach((a: any) => {
    const caps = safeJsonArray(a.capabilities);
    caps.forEach((c) => {
      if (!capabilityAgents[c]) capabilityAgents[c] = [];
      capabilityAgents[c].push(a);
    });
  });

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Capabilities</h1>
        <p className="text-sm text-muted-foreground">Registry of capabilities and the agents that provide them</p>
      </div>

      {error && (
        <Card className="p-8 text-center">
          <AlertCircle className="h-10 w-10 mx-auto text-destructive mb-3" />
          <p className="text-lg font-medium">Couldn't load capabilities</p>
          <p className="text-sm text-muted-foreground mt-1">Something went wrong fetching the workforce registry.</p>
          <Button variant="outline" className="mt-4 gap-2" onClick={() => mutate()}>
            <RotateCcw className="h-4 w-4" /> Retry
          </Button>
        </Card>
      )}

      {!error && isLoading && agents.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">Loading capabilities...</div>
      )}

      {!error && (
        <div className="space-y-6">
          {Object.entries(CAPABILITY_CATALOG).map(([category, caps]) => (
            <div key={category}>
              <h2 className="text-sm font-semibold text-muted-foreground mb-3 uppercase tracking-wider">{category}</h2>
              <div className="grid gap-3 md:grid-cols-2">
                {caps.map((cap) => {
                  const providers = capabilityAgents[cap] || [];
                  return (
                    <Card key={cap} className="p-4">
                      <div className="flex items-start gap-3">
                        <div className="rounded-md p-2 bg-muted shrink-0">
                          <Target className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-mono text-sm font-medium">{cap}</p>
                          {!isLoading && (
                            <p className="text-xs text-muted-foreground mt-1">
                              {providers.length > 0 ? (
                                <>
                                  {providers.length} agent{providers.length > 1 ? "s" : ""} provide{providers.length === 1 ? "s" : ""} this
                                </>
                              ) : (
                                <span className="text-warning">No agent provides this yet</span>
                              )}
                            </p>
                          )}
                          {providers.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-2">
                              {providers.slice(0, 3).map((p) => (
                                <Link
                                  key={p.id}
                                  href={`/agents/${p.id}`}
                                  className={cn(
                                    badgeVariants({ variant: "outline" }),
                                    "text-xs hover:border-primary/40 hover:text-foreground transition-colors"
                                  )}
                                >
                                  {p.name}
                                </Link>
                              ))}
                              {providers.length > 3 && (
                                <Badge variant="outline" className="text-xs">+{providers.length - 3}</Badge>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}