"use client";

import useSWR from "swr";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Boxes, Users, Plus, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

export default function ColoniesPage() {
  const { data, isLoading } = useSWR("/api/colonies", fetcher);
  const colonies = data?.colonies || [];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Colonies</h1>
          <p className="text-sm text-muted-foreground">Logical groupings of agents in your workforce</p>
        </div>
      </div>

      {isLoading && colonies.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">Loading colonies...</div>
      )}
      {!isLoading && colonies.length === 0 && (
        <Card className="p-12 text-center">
          <Boxes className="h-12 w-12 mx-auto text-faint mb-4" />
          <p className="text-lg font-medium">No colonies yet</p>
          <p className="text-sm text-muted-foreground mt-1">Create colonies to organize your agents</p>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {colonies.map((colony: any) => {
          const idleCount = colony.agents.filter((a: any) => a.status === "IDLE").length;
          const runningCount = colony.agents.filter((a: any) => a.status === "RUNNING").length;
          return (
            <Card key={colony.id} className="p-6 hover:border-primary/40 transition-colors">
              <div className="space-y-4">
                <div className="flex items-start justify-between">
                  <div className="rounded-lg p-2 bg-muted">
                    <Boxes className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <Badge variant="outline">{colony.agents.length} agents</Badge>
                </div>
                <div>
                  <h3 className="font-semibold text-lg">{colony.name}</h3>
                  <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{colony.description}</p>
                </div>
                <div className="flex items-center gap-3 text-xs">
                  <span className="flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-success" />
                    {runningCount} running
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground" />
                    {idleCount} idle
                  </span>
                </div>
                <Link href="/agents">
                  <Button variant="outline" size="sm" className="w-full gap-2">
                    <Users className="h-3.5 w-3.5" />
                    View Agents
                    <ChevronRight className="h-3.5 w-3.5 ml-auto" />
                  </Button>
                </Link>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
