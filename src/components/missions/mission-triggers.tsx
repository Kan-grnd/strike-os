"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SectionLabel } from "@/components/shared/page-header";
import { Plus, Zap, Clock, Webhook, CalendarClock, Hand, Trash2, Play, Pause, AlertCircle } from "lucide-react";
import { createAutomation } from "@/hooks/useApi";
import { AUTOMATION_STATUS_COLOR } from "@/lib/execution-meta";
import { formatCadence } from "@/lib/missions";
import { formatRelativeTime, safeJson } from "@/lib/utils";

/* Triggers are the mission's recurring inputs, modelled as automations linked
 * by `missionId` (M4.2). This panel is where they are managed — there is no
 * separate Automations surface. Everything here writes real records: create
 * links a new trigger, enable/disable flips its status, delete removes it.
 * Nothing here invents a schedule: "Next run" is shown only when the automation
 * actually carries a `nextRun`, and a mission with no cadence and no triggers
 * reads as "Manual". */

const TRIGGER_TYPES: { value: string; label: string }[] = [
  { value: "manual", label: "Manual" },
  { value: "schedule", label: "On a schedule" },
  { value: "webhook", label: "Webhook" },
  { value: "event", label: "On an event" },
];

const TRIGGER_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  manual: Hand,
  schedule: CalendarClock,
  webhook: Webhook,
  event: Zap,
};

const CADENCE_PRESETS: { value: string; label: string }[] = [
  { value: "", label: "Manual (no cadence)" },
  { value: "1h", label: "Every hour" },
  { value: "6h", label: "Every 6 hours" },
  { value: "1d", label: "Every day" },
  { value: "1w", label: "Every week" },
];

interface Props {
  missionId: string;
  cadence?: string | null;
  triggers: any[];
  onChanged: () => void | Promise<unknown>;
}

export function MissionTriggers({ missionId, cadence, triggers, onChanged }: Props) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");

  // cadence editing
  const [editCadence, setEditCadence] = useState(false);
  const [cadenceValue, setCadenceValue] = useState(cadenceEvery(cadence));

  // add-trigger form
  const [showAdd, setShowAdd] = useState(false);
  const [name, setName] = useState("");
  const [type, setType] = useState("manual");

  const run = async (key: string, fn: () => Promise<void>) => {
    if (busy) return;
    setBusy(key);
    setError("");
    try {
      await fn();
      await onChanged();
    } catch (e: any) {
      setError(e?.message || "Action failed. Try again.");
    } finally {
      setBusy(null);
    }
  };

  const saveCadence = () =>
    run("cadence", async () => {
      const res = await fetch(`/api/missions/${missionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cadence: cadenceValue ? { every: cadenceValue } : null }),
      });
      if (!res.ok) throw new Error("Failed to update cadence");
      setEditCadence(false);
    });

  const addTrigger = () =>
    run("add", async () => {
      if (!name.trim()) throw new Error("Give the trigger a name");
      const data = await createAutomation({
        name: name.trim().slice(0, 80),
        trigger: { type },
        actions: [],
        status: "ACTIVE",
        missionId,
      });
      if (!data.automation) throw new Error(data.error || "Failed to create trigger");
      setName("");
      setType("manual");
      setShowAdd(false);
    });

  const setStatus = (id: string, status: string) =>
    run(`status-${id}`, async () => {
      const res = await fetch(`/api/automations/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error("Failed to update trigger");
    });

  const remove = (id: string) =>
    run(`del-${id}`, async () => {
      const res = await fetch(`/api/automations/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete trigger");
    });

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <SectionLabel>Cadence &amp; triggers</SectionLabel>
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Clock className="h-3.5 w-3.5" />
          {formatCadence(cadence)}
        </span>
        {!editCadence && (
          <Button variant="ghost" size="sm" onClick={() => { setCadenceValue(cadenceEvery(cadence)); setEditCadence(true); }}>
            Edit cadence
          </Button>
        )}
        <div className="ml-auto">
          {!showAdd && (
            <Button variant="outline" size="sm" onClick={() => setShowAdd(true)} className="gap-2">
              <Plus className="h-3.5 w-3.5" /> Add trigger
            </Button>
          )}
        </div>
      </div>

      {error && (
        <p className="flex items-center gap-2 rounded-xl border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" /> {error}
        </p>
      )}

      {editCadence && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border bg-background p-3">
          <Select value={cadenceValue || "none"} onValueChange={(v) => setCadenceValue(v === "none" ? "" : v)}>
            <SelectTrigger className="w-[220px]" aria-label="Mission cadence">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CADENCE_PRESETS.map((p) => (
                <SelectItem key={p.label} value={p.value || "none"}>
                  {p.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button size="sm" onClick={saveCadence} disabled={busy !== null}>Save</Button>
          <Button size="sm" variant="ghost" onClick={() => setEditCadence(false)} disabled={busy !== null}>Cancel</Button>
        </div>
      )}

      {showAdd && (
        <div className="flex flex-wrap items-end gap-2 rounded-xl border border-primary/30 bg-background p-3">
          <div className="min-w-[200px] flex-1">
            <label htmlFor="trigger-name" className="mb-1 block text-xs text-muted-foreground">Trigger name</label>
            <Input id="trigger-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Daily inbox sweep" />
          </div>
          <div>
            <label className="mb-1 block text-xs text-muted-foreground">Fires</label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger className="w-[180px]" aria-label="Trigger type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TRIGGER_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={addTrigger} disabled={busy !== null} className="gap-2">
            <Plus className="h-4 w-4" /> {busy === "add" ? "Adding…" : "Add"}
          </Button>
          <Button variant="ghost" onClick={() => setShowAdd(false)} disabled={busy !== null}>Cancel</Button>
        </div>
      )}

      {triggers.length > 0 ? (
        <div className="divide-y rounded-xl border bg-background">
          {triggers.map((a) => {
            const t = safeJson<{ type?: string }>(a.trigger, {});
            const Icon = TRIGGER_ICON[String(t.type)] || Zap;
            const active = String(a.status).toUpperCase() === "ACTIVE";
            return (
              <div key={a.id} className="flex flex-wrap items-center gap-3 p-3">
                <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                <div className="min-w-[160px] flex-1">
                  <p className="text-sm font-medium">{a.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {String(t.type || "manual")}
                    {a.runCount ? ` · ${a.runCount} run${a.runCount === 1 ? "" : "s"}` : ""}
                    {a.lastRun ? ` · last ${formatRelativeTime(a.lastRun)}` : ""}
                    {a.nextRun ? ` · next ${new Date(a.nextRun).toLocaleString()}` : ""}
                  </p>
                </div>
                <Badge className={AUTOMATION_STATUS_COLOR[a.status] || "bg-muted text-muted-foreground"}>{a.status}</Badge>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={busy !== null}
                  onClick={() => setStatus(a.id, active ? "PAUSED" : "ACTIVE")}
                  aria-label={active ? `Pause ${a.name}` : `Activate ${a.name}`}
                  className="gap-1.5"
                >
                  {active ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
                  {active ? "Pause" : "Activate"}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  disabled={busy !== null}
                  onClick={() => remove(a.id)}
                  aria-label={`Delete ${a.name}`}
                  className="text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          No triggers. This mission runs only when you start it.
        </p>
      )}
    </section>
  );
}

/* Read the interval out of a stored cadence ({every:"1d"}), for the editor. */
function cadenceEvery(cadence?: string | null): string {
  if (!cadence) return "";
  try {
    const c = JSON.parse(cadence);
    return typeof c?.every === "string" ? c.every : "";
  } catch {
    return "";
  }
}
