"use client";

import { useState } from "react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Boxes, Users, Plus, ChevronRight, Loader2, RotateCcw, AlertCircle, X, CheckCircle2 } from "lucide-react";
import { useColonies, createColony } from "@/hooks/useApi";
import { ATTENTION_STATES } from "@/lib/agent-meta";

export default function ColoniesPage() {
  const { data, isLoading, error, mutate } = useColonies();
  const colonies = data?.colonies || [];

  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formMsg, setFormMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const handleCreate = async () => {
    if (!name.trim()) {
      setFormMsg({ ok: false, text: "Colony name is required." });
      return;
    }
    setSubmitting(true);
    setFormMsg(null);
    try {
      const res = await createColony({ name: name.trim(), description: description.trim() });
      if (res.error) {
        setFormMsg({ ok: false, text: res.error });
      } else {
        setFormMsg({ ok: true, text: `Colony "${res.colony?.name ?? name}" created.` });
        setName("");
        setDescription("");
        setCreating(false);
        mutate();
      }
    } catch (err: any) {
      setFormMsg({ ok: false, text: err.message ?? "Failed to create colony" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">Colonies</h1>
          <p className="text-sm text-muted-foreground">Logical groupings of agents in your workforce</p>
        </div>
        <Button className="gap-2" onClick={() => { setFormMsg(null); setCreating((c) => !c); }}>
          <Plus className="h-4 w-4" />
          {creating ? "Cancel" : "New Colony"}
        </Button>
      </div>

      {formMsg && (
        <p className={formMsg.ok ? "text-sm text-success" : "text-sm text-destructive"}>{formMsg.text}</p>
      )}

      {creating && (
        <Card className="p-5 space-y-4">
          <div>
            <h2 className="text-sm font-semibold">New Colony</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Create a new grouping for agents.</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="text-sm font-medium" htmlFor="colony-name">Colony Name</label>
              <Input
                id="colony-name"
                placeholder="e.g. Research Division"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-2"
              />
            </div>
            <div>
              <label className="text-sm font-medium" htmlFor="colony-description">Description</label>
              <Input
                id="colony-description"
                placeholder="What does this colony focus on?"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="mt-2"
              />
            </div>
          </div>
          <div className="flex justify-end gap-3">
            <Button variant="outline" size="sm" onClick={() => { setCreating(false); setFormMsg(null); }}>
              Cancel
            </Button>
            <Button size="sm" className="gap-2" onClick={handleCreate} disabled={submitting}>
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              Create Colony
            </Button>
          </div>
        </Card>
      )}

      {error && (
        <Card className="p-8 text-center">
          <AlertCircle className="h-10 w-10 mx-auto text-destructive mb-3" />
          <p className="text-lg font-medium">Couldn't load colonies</p>
          <p className="text-sm text-muted-foreground mt-1">Something went wrong fetching your colonies.</p>
          <Button variant="outline" className="mt-4 gap-2" onClick={() => mutate()}>
            <RotateCcw className="h-4 w-4" /> Retry
          </Button>
        </Card>
      )}

      {!error && isLoading && colonies.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">Loading colonies...</div>
      )}
      {!error && !isLoading && colonies.length === 0 && (
        <Card className="p-12 text-center">
          <Boxes className="h-12 w-12 mx-auto text-faint mb-4" />
          <p className="text-lg font-medium">No colonies yet</p>
          <p className="text-sm text-muted-foreground mt-1">Create colonies to organize your agents</p>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {colonies.map((colony: any) => {
          const runningCount = colony.agents.filter((a: any) => a.status === "RUNNING").length;
          const idleCount = colony.agents.filter((a: any) => a.status === "IDLE").length;
          const attentionCount = colony.agents.filter((a: any) => ATTENTION_STATES.has(a.runtimeState)).length;
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
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                  <span className="flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-success" />
                    {runningCount} running
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground" />
                    {idleCount} idle
                  </span>
                  {attentionCount > 0 && (
                    <span className="flex items-center gap-1.5">
                      <span className="h-1.5 w-1.5 rounded-full bg-warning" />
                      {attentionCount} need{attentionCount === 1 ? "s" : ""} attention
                    </span>
                  )}
                </div>
                <Link href={`/agents?colonyId=${colony.id}`}>
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