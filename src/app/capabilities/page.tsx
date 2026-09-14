"use client";

import useSWR from "swr";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Target } from "lucide-react";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

const CAPABILITY_CATALOG: Record<string, string[]> = {
  "Research & Intel": ["intel.research", "source.evaluation", "authority.rating", "report.synthesis", "web.analysis", "cadence.tracking"],
  "Code & Engineering": ["system.design", "pipeline.architecture", "code.python", "data.pipelines"],
  "Data & Analysis": ["quality.validation", "accuracy.audit"],
};

export default function CapabilitiesPage() {
  const { data: agentsData } = useSWR("/api/agents", fetcher);
  const agents = agentsData?.agents || [];

  const capabilityAgents: Record<string, any[]> = {};
  agents.forEach((a: any) => {
    const caps = JSON.parse(a.capabilities || "[]") as string[];
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
                        <p className="text-xs text-muted-foreground mt-1">
                          {providers.length > 0 ? (
                            <>
                              {providers.length} agent{providers.length > 1 ? "s" : ""} provide{providers.length === 1 ? "s" : ""} this
                            </>
                          ) : (
                            <span className="text-warning">No agent provides this yet</span>
                          )}
                        </p>
                        {providers.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-2">
                            {providers.slice(0, 3).map((p) => (
                              <Badge key={p.id} variant="outline" className="text-xs">{p.name}</Badge>
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
    </div>
  );
}
