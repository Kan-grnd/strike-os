"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { useTheme } from "next-themes";
import {
  Settings as SettingsIcon,
  Save,
  Palette,
  Activity,
  KeyRound,
  Workflow,
  AlertTriangle,
  Info,
  Check,
  Loader2,
  Plus,
  Trash2,
  Play,
  Pause,
  Database,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { THEME_PACKS, DEFAULT_THEME } from "@/lib/theme-packs";
import useSWR from "swr";
import {
  useSettings,
  updateSettings,
  resetDatabase,
  cleanContent,
  setAutomationsGlobal,
  type RefreshPreset,
} from "@/hooks/useApi";
import { useAutomations, useColonies } from "@/hooks/useApi";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

const TABS = [
  { id: "workspace", label: "Workspace", icon: SettingsIcon },
  { id: "appearance", label: "Appearance", icon: Palette },
  { id: "live-data", label: "Live Data", icon: Activity },
  { id: "secrets", label: "Secrets", icon: KeyRound },
  { id: "automations", label: "Automations", icon: Workflow },
  { id: "danger", label: "Danger Zone", icon: AlertTriangle },
  { id: "about", label: "About", icon: Info },
] as const;

type TabId = (typeof TABS)[number]["id"];

const PRESETS: { id: RefreshPreset; label: string; ms: number; desc: string }[] = [
  { id: "live", label: "Live", ms: 3000, desc: "~20 req/min — flash for topology & activity" },
  { id: "normal", label: "Normal", ms: 10000, desc: "~6 req/min — balanced default" },
  { id: "relaxed", label: "Relaxed", ms: 30000, desc: "~2 req/min — low overhead" },
  { id: "paused", label: "Paused", ms: 0, desc: "No background polling" },
];

/**
 * Accent overrides (appearance.accent) and corner radii. The theme pack list
 * below is imported from @/lib/theme-packs — the single source of truth also
 * used by the header ThemeSwitcher.
 */

const ACCENTS = [
  { id: "none", label: "Pack default", hex: null as string | null },
  { id: "cyan", label: "Cyan", hex: "#06b6d4" },
  { id: "teal", label: "Teal", hex: "#14b8a6" },
  { id: "sky", label: "Sky", hex: "#0ea5e9" },
  { id: "burnt-orange", label: "Burnt orange", hex: "#ea580c" },
] as const;

const RADII = [
  { value: "0", label: "Sharp (0)" },
  { value: "0.5rem", label: "Default (0.5rem)" },
  { value: "1rem", label: "Rounded (1rem)" },
] as const;

function FormRow({
  label,
  hint,
  wide,
  children,
}: {
  label: string;
  hint?: string;
  wide?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-6 py-3">
      <div>
        <p className="text-sm font-medium">{label}</p>
        {hint && <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>}
      </div>
      <div className={cn("shrink-0", wide ? "min-w-0 flex-1" : "w-64")}>{children}</div>
    </div>
  );
}

export default function SettingsPage() {
  const [tab, setTab] = useState<TabId>("workspace");
  const { settings, mutate, isSaving, save } = useSettingsState();

  useEffect(() => {
    const el = document.documentElement;
    const density = settings?.["appearance.density"] || "comfortable";
    el.dataset.density = density;
    el.dataset.accent = settings?.["appearance.accent"] || "none";
    const radius = settings?.["appearance.radius"];
    if (radius) el.style.setProperty("--radius", radius);
  }, [settings]);

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold">Settings</h1>

      <div className="flex gap-6">
        <nav className="w-48 shrink-0 space-y-1">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                "flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                tab === t.id
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <t.icon className="h-4 w-4" />
              {t.label}
            </button>
          ))}
        </nav>

        <div className="flex-1 min-w-0 space-y-4">
          {tab === "workspace" && (
            <WorkspaceTab settings={settings} save={save} isSaving={isSaving} />
          )}
          {tab === "appearance" && (
            <AppearanceTab settings={settings} save={save} isSaving={isSaving} />
          )}
          {tab === "live-data" && (
            <LiveDataTab settings={settings} save={save} isSaving={isSaving} />
          )}
          {tab === "secrets" && <SecretsTab />}
          {tab === "automations" && (
            <AutomationsTab settings={settings} save={save} isSaving={isSaving} />
          )}
          {tab === "danger" && <DangerZoneTab onReset={async () => { await mutate(); }} />}
          {tab === "about" && <AboutTab />}
        </div>
      </div>
    </div>
  );
}

function useSettingsState() {
  const { data, mutate } = useSettings();
  const [savingKey, setSavingKey] = useState<string | null>(null);

  const isSaving = (key?: string) => (key ? savingKey === key : savingKey !== null);

  const save = async (key: string, value: string) => {
    setSavingKey(key);
    try {
      await updateSettings({ [key]: value });
      await mutate();
    } finally {
      setSavingKey(null);
    }
  };

  return { settings: data?.settings, mutate, isSaving, save };
}

function SaveIndicator({ active }: { active: boolean }) {
  if (!active) return null;
  return (
    <span className="inline-flex items-center gap-1 text-xs text-success">
      <Check className="h-3 w-3" /> Saved
    </span>
  );
}

function WorkspaceTab({
  settings,
  save,
  isSaving,
}: {
  settings?: Record<string, string>;
  save: (k: string, v: string) => Promise<void>;
  isSaving: (k?: string) => boolean;
}) {
  const { data: coloniesData } = useColonies();
  const colonies = coloniesData?.colonies || [];
  const [name, setName] = useState(settings?.["workspace.name"] || "My Workspace");
  useEffect(() => setName(settings?.["workspace.name"] || "My Workspace"), [settings]);

  return (
    <>
      <TabHeader icon={SettingsIcon} title="Workspace" desc="Identity and defaults" />
      <Card className="p-6">
        <FormRow label="Workspace name" hint="Shown across the platform">
          <div className="flex items-center gap-2">
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
        </FormRow>
        <div className="flex justify-end pt-3">
          <Button
            className="gap-2"
            onClick={async () => {
              await save("workspace.name", name);
            }}
          >
            <Save className="h-4 w-4" /> Save name
          </Button>
        </div>
      </Card>

      <Card className="p-6">
        <FormRow label="Default colony" hint="Selected for new agents & missions">
          <select
            className="w-full rounded-md border bg-background px-3 py-2 text-sm h-10"
            value={settings?.["workspace.defaultColonyId"] || ""}
            onChange={(e) => save("workspace.defaultColonyId", e.target.value)}
          >
            <option value="">— No default —</option>
            {colonies.map((c: any) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </FormRow>
      </Card>

      <Card className="p-6">
        <FormRow label="Start sidebar collapsed" hint="Applies on page load. The header chevron overrides it for the current session.">
          <button
            onClick={() =>
              save(
                "workspace.sidebarCollapsed",
                settings?.["workspace.sidebarCollapsed"] === "true" ? "false" : "true"
              )
            }
            className={cn(
              "relative h-6 w-11 rounded-full transition-colors",
              settings?.["workspace.sidebarCollapsed"] === "true" ? "bg-primary" : "bg-muted"
            )}
          >
            <span
              className={cn(
                "absolute top-0.5 h-5 w-5 rounded-full bg-background shadow transition-transform",
                settings?.["workspace.sidebarCollapsed"] === "true"
                  ? "translate-x-[22px]"
                  : "translate-x-0.5"
              )}
            />
          </button>
        </FormRow>
      </Card>
    </>
  );
}

function AppearanceTab({
  settings,
  save,
  isSaving,
}: {
  settings?: Record<string, string>;
  save: (k: string, v: string) => Promise<void>;
  isSaving: (k?: string) => boolean;
}) {
  const { theme, setTheme } = useTheme();
  const activePack = THEME_PACKS.some((p) => p.id === theme) ? theme : DEFAULT_THEME;
  const themeRefs = useRef<(HTMLDivElement | null)[]>([]);

  const focusPack = (index: number) => {
    themeRefs.current[index]?.focus();
  };

  /** WAI-ARIA radiogroup keyboard pattern: arrows move selection + focus; roving tabindex. */
  const handleThemeKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const current = THEME_PACKS.findIndex((p) => p.id === activePack);
    let next: number | null = null;
    if (e.key === "ArrowDown" || e.key === "ArrowRight") next = (current + 1) % THEME_PACKS.length;
    else if (e.key === "ArrowUp" || e.key === "ArrowLeft") next = (current - 1 + THEME_PACKS.length) % THEME_PACKS.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = THEME_PACKS.length - 1;
    if (next !== null) {
      e.preventDefault();
      setTheme(THEME_PACKS[next].id);
      focusPack(next);
    }
  };

  return (
    <>
      <TabHeader icon={Palette} title="Appearance" desc="Theme pack, density, corner radius and accent" />
      <Card className="p-6">
        <FormRow wide label="Theme pack" hint="Applied instantly from the header switcher or here">
          <div
            role="radiogroup"
            aria-label="Theme pack"
            aria-orientation="vertical"
            onKeyDown={handleThemeKey}
            className="flex w-full flex-col gap-2"
          >
            {THEME_PACKS.map((p, idx) => {
              const selected = activePack === p.id;
              return (
                <div
                  key={p.id}
                  ref={(el) => {
                    themeRefs.current[idx] = el;
                  }}
                  role="radio"
                  aria-checked={selected}
                  tabIndex={selected ? 0 : -1}
                  onClick={() => {
                    setTheme(p.id);
                    focusPack(idx);
                  }}
                  className={cn(
                    "flex w-full cursor-pointer items-center gap-3 rounded-lg border p-3 outline-none transition-colors focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                    selected
                      ? "border-primary/60 bg-primary/5 ring-2 ring-primary/25"
                      : "border-border bg-background hover:bg-muted"
                  )}
                >
                  <span className="flex shrink-0 items-end gap-1.5" aria-hidden="true">
                    <span className="h-6 w-6 rounded-md border border-black/10" style={{ background: p.bg }} />
                    <span className="h-6 w-6 rounded-md border border-black/10" style={{ background: p.surface }} />
                    <span className="h-6 w-6 rounded-md border border-black/10" style={{ background: p.accent }} />
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="whitespace-nowrap text-sm font-semibold text-foreground" title={p.name}>
                      {p.name}
                    </span>
                    <span className="whitespace-nowrap text-xs text-muted-foreground" title={p.tagline}>
                      {p.tagline}
                    </span>
                  </span>
                  {selected && (
                    <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-primary px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-primary-foreground">
                      <Check className="h-3 w-3" aria-hidden="true" />
                      Active
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </FormRow>
      </Card>

      <Card className="p-6">
        <FormRow label="Corner radius" hint="Maps to --radius, applied app-wide">
          <select
            className="w-full rounded-md border bg-background px-3 py-2 text-sm h-10"
            value={settings?.["appearance.radius"] || "0.5rem"}
            onChange={(e) => save("appearance.radius", e.target.value)}
          >
            {RADII.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
        </FormRow>
      </Card>

      <Card className="p-6">
        <FormRow label="Accent" hint="Overrides primary + ring; none keeps the pack default">
          <div className="flex flex-wrap gap-2 justify-end">
            {ACCENTS.map((a) => (
              <button
                key={a.id}
                onClick={() => save("appearance.accent", a.id)}
                title={a.label}
                className={cn(
                  "flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium capitalize transition-colors",
                  (settings?.["appearance.accent"] || "none") === a.id
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-background hover:bg-muted"
                )}
              >
                {a.hex ? (
                  <span
                    className="h-3 w-3 rounded-full border border-black/10"
                    style={{ background: a.hex }}
                  />
                ) : (
                  <span className="h-3 w-3 rounded-full border border-current" />
                )}
                {a.label}
              </button>
            ))}
          </div>
        </FormRow>
      </Card>

      <Card className="p-6">
        <FormRow label="Density" hint="Compact reduces card padding & section gaps">
          <div className="flex gap-2 justify-end">
            {["comfortable", "compact"].map((d) => (
              <button
                key={d}
                onClick={() => save("appearance.density", d)}
                className={cn(
                  "rounded-md border px-3 py-1.5 text-xs font-medium capitalize",
                  settings?.["appearance.density"] === d
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-background hover:bg-muted"
                )}
              >
                {d}
              </button>
            ))}
          </div>
        </FormRow>
      </Card>
    </>
  );
}

function LiveDataTab({
  settings,
  save,
  isSaving,
}: {
  settings?: Record<string, string>;
  save: (k: string, v: string) => Promise<void>;
  isSaving: (k?: string) => boolean;
}) {
  const current = (settings?.["refresh.preset"] || "normal") as RefreshPreset;
  return (
    <>
      <TabHeader icon={Activity} title="Live Data" desc="How often the live views refresh" />
      <Card className="p-6 space-y-2">
        {PRESETS.map((p) => (
          <button
            key={p.id}
            onClick={() => save("refresh.preset", p.id)}
            className={cn(
              "flex w-full items-center justify-between rounded-md border p-4 text-left transition-colors",
              current === p.id
                ? "border-primary bg-primary/5"
                : "hover:bg-muted/40"
            )}
          >
            <div>
              <p className="text-sm font-medium">{p.label}</p>
              <p className="text-xs text-muted-foreground">{p.desc}</p>
            </div>
            <Badge variant={current === p.id ? "default" : "outline"}>
              every {p.ms === 0 ? "—" : `${p.ms / 1000}s`}
            </Badge>
          </button>
        ))}
        <p className="pt-2 text-xs text-muted-foreground">
          Controls topology, events, logs, costs, performance &amp; health polling. Paused stops
          background refresh until changed here.
        </p>
        <SaveIndicator active={isSaving()} />
      </Card>
    </>
  );
}

function SecretsTab() {
  const { data, mutate, isLoading } = useSWR<{ secrets: any[] }>("/api/secrets", fetcher, {
    revalidateOnFocus: false,
  });
  const [name, setName] = useState("");
  const [provider, setProvider] = useState("anthropic");
  const [reference, setReference] = useState("ANTHROPIC_API_KEY");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const secrets = data?.secrets || [];

  const add = async () => {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/secrets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, provider, reference }),
      });
      if (!res.ok) throw new Error("Failed to add secret");
      setName("");
      await mutate();
    } catch (e: any) {
      setError(e.message || "Failed to add secret");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    const res = await fetch(`/api/secrets/${id}`, { method: "DELETE" });
    if (res.ok) await mutate();
  };

  return (
    <>
      <TabHeader icon={KeyRound} title="Secrets" desc="Provider credentials — values are never stored or shown" />
      <Card className="p-6">
        <div className="space-y-2">
          {isLoading && secrets.length === 0 ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : secrets.length === 0 ? (
            <p className="text-sm text-muted-foreground">No secrets configured.</p>
          ) : (
            secrets.map((s: any) => (
              <div
                key={s.id}
                className="flex items-center justify-between rounded-md bg-muted/30 p-3 text-sm"
              >
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{s.provider}</Badge>
                  <span className="font-mono">{s.reference}</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>{new Date(s.createdAt).toLocaleDateString()}</span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => remove(s.id)}
                    title="Delete secret"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </Card>

      <Card className="p-6 space-y-4">
        <h3 className="text-sm font-semibold">Add secret</h3>
        <div className="grid grid-cols-3 gap-3">
          <Input placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} />
          <select
            className="rounded-md border bg-background px-3 py-2 text-sm h-10"
            value={provider}
            onChange={(e) => setProvider(e.target.value)}
          >
            <option value="anthropic">Anthropic</option>
            <option value="openai">OpenAI</option>
            <option value="omniroute">OmniRoute</option>
            <option value="other">Other</option>
          </select>
          <Input
            placeholder="Env reference (e.g. ANTHROPIC_API_KEY)"
            value={reference}
            onChange={(e) => setReference(e.target.value)}
          />
        </div>
        {error && <p className="text-xs text-destructive">{error}</p>}
        <Button onClick={add} disabled={busy || !name || !reference} className="gap-2">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          Add secret
        </Button>
      </Card>
    </>
  );
}

function AutomationsTab({
  settings,
  save,
  isSaving,
}: {
  settings?: Record<string, string>;
  save: (k: string, v: string) => Promise<void>;
  isSaving: (k?: string) => boolean;
}) {
  const { data: automationsData, mutate: mutateAutomations } = useAutomations();
  const automations = automationsData?.automations || [];
  const activeCount = automations.filter((a: any) => a.status === "ACTIVE").length;
  const pausedCount = automations.filter((a: any) => a.status === "PAUSED").length;
  const [busy, setBusy] = useState(false);

  const globalToggle = async (paused: boolean) => {
    setBusy(true);
    try {
      await setAutomationsGlobal(paused);
      await mutateAutomations();
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <TabHeader icon={Workflow} title="Automations" desc="Global run policy" />
      <Card className="p-6 space-y-4">
        <div className="flex items-center gap-2">
          <Badge variant="outline">{automations.length} configured</Badge>
          <Badge variant="outline" className="bg-success/10 text-success">
            {activeCount} active
          </Badge>
          {pausedCount > 0 && (
            <Badge variant="outline" className="bg-muted">
              {pausedCount} paused
            </Badge>
          )}
        </div>
        {activeCount > 0 ? (
          <Button
            variant="destructive"
            className="gap-2"
            disabled={busy}
            onClick={() => globalToggle(true)}
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Pause className="h-4 w-4" />}
            Pause all active automations
          </Button>
        ) : pausedCount > 0 ? (
          <Button className="gap-2" disabled={busy} onClick={() => globalToggle(false)}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
            Resume all paused automations
          </Button>
        ) : (
          <p className="text-sm text-muted-foreground">No automations to pause or resume.</p>
        )}
      </Card>

      <Card className="p-6">
        <FormRow
          label="Require approval"
          hint="Missions touching destructive tool categories wait for human approval"
        >
          <button
            onClick={() =>
              save(
                "automations.requireApproval",
                settings?.["automations.requireApproval"] === "true" ? "false" : "true"
              )
            }
            className={cn(
              "relative h-6 w-11 rounded-full transition-colors",
              settings?.["automations.requireApproval"] === "true" ? "bg-primary" : "bg-muted"
            )}
          >
            <span
              className={cn(
                "absolute top-0.5 h-5 w-5 rounded-full bg-background shadow transition-transform",
                settings?.["automations.requireApproval"] === "true"
                  ? "translate-x-[22px]"
                  : "translate-x-0.5"
              )}
            />
          </button>
        </FormRow>
        <SaveIndicator active={isSaving("automations.requireApproval")} />
      </Card>
    </>
  );
}

function DangerZoneTab({ onReset }: { onReset: () => Promise<void> }) {
  const [confirmText, setConfirmText] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState("");
  const [cleaning, setCleaning] = useState(false);

  const run = async () => {
    if (confirmText !== "RESET") return;
    setBusy(true);
    setResult("");
    try {
      const res = await resetDatabase();
      if (res.error) {
        setResult(res.error);
      } else {
        const total = Object.values(res.counts || {}).reduce(
          (s: number, n: any) => s + (n || 0),
          0
        );
        setResult(`Reset complete — ${total} rows removed.`);
        setConfirmText("");
        await onReset();
      }
    } catch (e: any) {
      setResult(e.message || "Reset failed");
    } finally {
      setBusy(false);
    }
  };

  const runClean = async () => {
    const ok = window.confirm(
      "Empty ALL demo/user content (agents, colonies, missions, tasks, chat, memories, events, edits, logs, metrics — everything the app generates).\n\nKEPT: providers, models, tools, secrets, connectors, endpoints, webhooks, integrations, and system settings.\n\nThis cannot be undone."
    );
    if (!ok) return;
    setCleaning(true);
    try {
      const res = await cleanContent();
      if (res.error) {
        toast.error(res.error);
      } else {
        const total = Object.values(res.counts || {}).reduce(
          (s: number, n: any) => s + (n || 0),
          0
        );
        toast.success(`Cleaned ${total} content rows. Catalog (providers, models, tools, secrets, connectors) kept.`);
        setResult(`Clean complete — ${total} content rows removed. Catalog untouched.`);
      }
    } catch (e: any) {
      toast.error(e.message || "Clean failed");
    } finally {
      setCleaning(false);
    }
  };

  return (
    <>
      <TabHeader icon={AlertTriangle} title="Danger Zone" desc="Destructive, irreversible actions" />
      <Card className="border-destructive/40 p-6 space-y-4">
        <div className="flex items-start gap-3">
          <div className="rounded-md bg-destructive/10 p-2 text-destructive">
            <Database className="h-5 w-5" />
          </div>
          <div>
            <p className="font-semibold">Reset demo data</p>
            <p className="text-xs text-muted-foreground">
              Deletes all agents, colonies, missions, tasks, memories, events, automations, tools,
              providers and connections. Settings and the app itself are untouched. Only allowed on
              the local dev database.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Input
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder='Type "RESET" to confirm'
            className="max-w-xs"
          />
          <Button
            variant="destructive"
            disabled={confirmText !== "RESET" || busy}
            onClick={run}
            className="gap-2"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <AlertTriangle className="h-4 w-4" />}
            Reset demo data
          </Button>
        </div>
        {result && <p className="text-xs text-muted-foreground">{result}</p>}
      </Card>
      <Card className="border-destructive/40 p-6 space-y-4">
        <div className="flex items-start gap-3">
          <div className="rounded-md bg-destructive/10 p-2 text-destructive">
            {cleaning ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <AlertTriangle className="h-5 w-5" />
            )}
          </div>
          <div>
            <p className="font-semibold">Clean demo content</p>
            <p className="text-xs text-muted-foreground">
              Empties all demo/user content (agents, colonies, missions, tasks, chat, memories,
              events, edit tickets, logs, metrics…). Keeps the working catalog the app needs:
              providers, models, tools, secrets, connectors, endpoints, webhooks, integrations and
              system settings. Only allowed on the local dev database.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="destructive"
            disabled={cleaning}
            onClick={runClean}
            className="gap-2"
          >
            {cleaning ? <Loader2 className="h-4 w-4 animate-spin" /> : <AlertTriangle className="h-4 w-4" />}
            Clean demo content
          </Button>
        </div>
      </Card>
    </>
  );
}

function AboutTab() {
  const { data } = useSWR("/api/admin/info", fetcher);
  return (
    <>
      <TabHeader icon={Info} title="About" desc="Platform details" />
      <Card className="p-6 space-y-3">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary">
            <SettingsIcon className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <p className="text-sm font-bold">STRIKE OS</p>
            <p className="text-xs text-muted-foreground">{data?.version || "…"} — Adaptive AI Workforce Operating System</p>
          </div>
        </div>
        <FormRow label="Version" hint="From constants">
          <p className="text-sm">{data?.version || "…"}</p>
        </FormRow>
        <FormRow label="Database" hint="Local SQLite dev store">
          <p className="truncate text-sm font-mono">{data?.dbPath || "resolving…"}</p>
        </FormRow>
        <FormRow label="Size" hint="Raw file size on disk">
          <p className="text-sm">
            {data?.dbSizeBytes != null
              ? (data.dbSizeBytes / 1024).toFixed(0) + " KB"
              : "…"}
          </p>
        </FormRow>
      </Card>
    </>
  );
}

function TabHeader({
  icon: Icon,
  title,
  desc,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  desc: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <Icon className="h-4 w-4 text-muted-foreground" />
      <div>
        <h2 className="font-semibold">{title}</h2>
        <p className="text-xs text-muted-foreground">{desc}</p>
      </div>
    </div>
  );
}