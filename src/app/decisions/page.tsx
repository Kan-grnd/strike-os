"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, BookOpen, Brain, Calendar, Scale } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { useDecisions } from "@/hooks/useApi";

export default function DecisionsPage() {
  const [search, setSearch] = useState("");
  const { data, isLoading } = useDecisions(search ? { q: search } : undefined);

  const decisions = data?.decisions || [];

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Decisions</h1>
          <p className="text-sm text-muted-foreground">
            Recorded decisions and their reasoning across the workforce
          </p>
        </div>
        <Button className="gap-2">
          <BookOpen className="h-4 w-4" /> Log Decision
        </Button>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-faint" />
          <Input
            placeholder="Search decisions..."
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <Card className="p-6">
        <h2 className="font-semibold mb-4">Decision Log</h2>
        {isLoading ? (
          <div className="space-y-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="animate-pulse rounded-md bg-muted/30 border p-4">
                <div className="h-4 w-2/3 rounded bg-muted" />
                <div className="mt-2 h-3 w-full rounded bg-muted" />
                <div className="mt-2 h-3 w-1/2 rounded bg-muted" />
              </div>
            ))}
          </div>
        ) : decisions.length === 0 ? (
          <EmptyState
            icon={Scale}
            title="No decisions recorded yet"
            description="Decisions made by the workforce and the architect will appear here."
          />
        ) : (
          <div className="space-y-3">
            {decisions.map((d: any) => (
              <div key={d.id} className="rounded-md bg-muted/30 p-4 border">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-semibold">{d.content}</h4>
                    </div>
                    <p className="text-sm text-muted-foreground mb-2">
                      {d.subjectId ? `Ref: ${d.subjectId}` : "Workforce decision"}
                    </p>
                    <div className="flex items-center gap-4 text-xs text-faint">
                      <span>
                        <Calendar className="h-3 w-3" /> {new Date(d.createdAt).toLocaleDateString()}
                      </span>
                      <span>
                        <Brain className="h-3 w-3" /> {d.agentId ? "Agent" : "Architect"}
                      </span>
                      <span>
                        Confidence{" "}
                        {d.confidence != null ? Math.round(d.confidence * 100) + "%" : "—"}
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <Badge variant={d.scope === "GLOBAL" ? "default" : "outline"}>{d.scope}</Badge>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <Brain className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}