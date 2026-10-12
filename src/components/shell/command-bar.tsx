"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { mutate } from "swr";
import { formatDistanceToNow } from "date-fns";
import {
  BookOpen,
  Check,
  ListTodo,
  MessageCircle,
  Network,
  Plus,
  Rocket,
  Settings,
  TriangleAlert,
  Users,
  Workflow,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { StrikeMark } from "@/components/ui/logo";
import { createMission, useAgents, useEvents, useMissions } from "@/hooks/useApi";
import { cn } from "@/lib/utils";

/* Dispatch control: type a goal and send it to start work, or jump to a page.
 * Flat platform styling only — card/popover surfaces, hairline borders,
 * accent hovers, mono micro-labels. No blur, no glow, no new tokens.
 * Pill layout left to right: [Ctrl+K hint] [input] [logo hit button]. */

type SendState = "ready" | "sending" | "success" | "error";

interface FleetAgent {
  status?: string | null;
}
interface RecentMission {
  id: string;
  goal: string;
  status: string;
  updatedAt: string;
}
interface PanelEvent {
  timestamp: string;
}

const STALL_AFTER_MS = 60000;
const SUCCESS_HOLD_MS = 6000;
const CHECK_HOLD_MS = 1500;

const OFFLINE_RE = /offline|error|failed|dead|stale/i;

/* Mono uppercase micro-label, same as the hero status line. */
const MICRO_LABEL = "font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground";
/* Small bordered icon chip, same as the KPI cards at a smaller size. */
const ICON_CHIP = "flex size-6 shrink-0 items-center justify-center rounded-md border border-border";

const PAGE_LINKS: Array<{ title: string; href: string; Icon: LucideIcon }> = [
  { title: "Agents", href: "/agents", Icon: Users },
  { title: "Missions", href: "/missions", Icon: ListTodo },
  { title: "Tasks", href: "/tasks", Icon: Zap },
  { title: "Live topology", href: "/topology", Icon: Network },
  { title: "Knowledge", href: "/knowledge", Icon: BookOpen },
  { title: "Workflows", href: "/workflows", Icon: Workflow },
  { title: "Settings", href: "/settings", Icon: Settings },
];

type RowKind = "start" | "ask" | "action" | "mission" | "page";
interface Row {
  key: string;
  kind: RowKind;
  title: string;
  hint?: string;
  dotClass?: string;
  Icon?: LucideIcon;
  run: () => void;
}

function missionDot(status: string) {
  if (/complete/i.test(status)) return "bg-success";
  if (/fail|cancel/i.test(status)) return "bg-destructive";
  if (/run|execut|progress|plan|think|delegat|retry|initial/i.test(status)) return "bg-primary";
  return "bg-warning";
}

export function CommandBar() {
  const router = useRouter();
  const listId = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const timers = useRef<number[]>([]);
  const lastAction = useRef<"mission" | "chat">("mission");
  const sendStateRef = useRef<SendState>("ready");

  const [text, setText] = useState("");
  const [open, setOpen] = useState(false);
  const [focused, setFocused] = useState(false);
  const [sendState, setSendState] = useState<SendState>("ready");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [success, setSuccess] = useState<{ id: string; title: string } | null>(null);
  const [showCheck, setShowCheck] = useState(false);
  const [shakeKey, setShakeKey] = useState(0);
  const [activeIndex, setActiveIndex] = useState(0);
  const [mounted, setMounted] = useState(false);
  const [isMac, setIsMac] = useState(false);

  const { data: agentsData, error: agentsError } = useAgents({}, { poll: true });
  const { data: missionsData } = useMissions();
  const { data: eventsData } = useEvents({ limit: "1" });

  const setSend = (s: SendState) => {
    sendStateRef.current = s;
    setSendState(s);
  };
  const later = (fn: () => void, ms: number) => {
    timers.current.push(window.setTimeout(fn, ms));
  };
  useEffect(() => () => timers.current.forEach((t) => window.clearTimeout(t)), []);

  // Platform for the keycap hint, detected after mount (no hydration mismatch).
  useEffect(() => {
    setMounted(true);
    const plat = navigator.platform || navigator.userAgent || "";
    setIsMac(/mac|iphone|ipad|ipod|darwin/i.test(plat));
  }, []);

  const focusInput = () => {
    inputRef.current?.focus();
    setOpen(true);
  };

  const resetSend = () => {
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];
    setSend("ready");
    setErrorMsg(null);
    setSuccess(null);
    setShowCheck(false);
  };

  const closePanel = () => {
    setOpen(false);
    setActiveIndex(0);
    if (sendStateRef.current !== "sending") resetSend();
  };

  const go = (href: string) => {
    setText("");
    setOpen(false);
    setActiveIndex(0);
    resetSend();
    inputRef.current?.blur();
    router.push(href);
  };

  async function submitMission() {
    const goal = text.trim();
    if (!goal || sendStateRef.current === "sending" || sendStateRef.current === "success") return;
    lastAction.current = "mission";
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];
    setErrorMsg(null);
    setSuccess(null);
    setSend("sending");
    try {
      const res: any = await createMission({ goal });
      if (!res || res.error || !res.mission?.id) {
        throw new Error(typeof res?.error === "string" ? res.error : "Mission failed to start");
      }
      setSuccess({ id: res.mission.id, title: res.mission.goal || goal });
      setText("");
      setActiveIndex(0);
      setSend("success");
      setShowCheck(true);
      mutate("/api/missions");
      later(() => setShowCheck(false), CHECK_HOLD_MS);
      later(() => {
        resetSend();
        setOpen(false);
      }, SUCCESS_HOLD_MS);
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : "Mission failed to start");
      setShakeKey((k) => k + 1);
      setSend("error");
    }
  }

  async function askChat() {
    const content = text.trim();
    if (!content || sendStateRef.current === "sending" || sendStateRef.current === "success") return;
    lastAction.current = "chat";
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];
    setErrorMsg(null);
    setSuccess(null);
    setSend("sending");
    try {
      const created: any = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: content.length > 48 ? content.slice(0, 48) + "…" : content }),
      }).then((r) => r.json());
      const id = created?.conversation?.id;
      if (!id) throw new Error(typeof created?.error === "string" ? created.error : "Chat failed to start");
      const sent: any = await fetch(`/api/chat/${id}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      }).then((r) => r.json());
      if (sent?.error) throw new Error(typeof sent.error === "string" ? sent.error : "Chat failed to start");
      setSend("ready");
      go(`/chat?c=${id}`);
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : "Chat failed to start");
      setShakeKey((k) => k + 1);
      setSend("error");
    }
  }

  const retry = () => {
    if (lastAction.current === "chat") askChat();
    else submitMission();
  };

  // Ctrl/Cmd+K focuses the input and opens the panel. No clash: the only
  // other modifier shortcut is the sidebar's Ctrl/Cmd+B.
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        inputRef.current?.focus();
        setOpen(true);
      }
    };
    window.addEventListener("keydown", down);
    return () => window.removeEventListener("keydown", down);
  }, []);

  // Click outside closes.
  useEffect(() => {
    if (!open) return;
    const out = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) closePanel();
    };
    document.addEventListener("pointerdown", out);
    return () => document.removeEventListener("pointerdown", out);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open ]);

  // Fleet availability.
  const agents = useMemo(() => (agentsData?.agents ?? []) as FleetAgent[], [agentsData]);
  const fleetLoading = !agentsData && !agentsError;
  const fleetFailed = !!agentsError;
  const totalAgents = agents.length;
  const availAgents = agents.filter((a) => !OFFLINE_RE.test(String(a.status ?? "IDLE"))).length;
  const lastEventAt = useMemo(() => {
    const list = ((eventsData?.events ?? []) as PanelEvent[])
      .map((e) => Date.parse(e.timestamp))
      .filter((n) => !Number.isNaN(n));
    return list.length ? Math.max(...list) : null;
  }, [eventsData]);
  const stalled = availAgents > 0 && lastEventAt !== null && Date.now() - lastEventAt > STALL_AFTER_MS;

  // Recent missions (latest 3 by update).
  const recentMissions = useMemo(() => {
    const list = ((missionsData?.missions ?? []) as RecentMission[]).slice();
    list.sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt));
    return list.slice(0, 3);
  }, [missionsData]);

  const q = text.trim();

  const groups = useMemo(() => {
    const out: Array<{ label: string | null; rows: Row[] }> = [];
    if (!q) {
      out.push({
        label: null,
        rows: [
          { key: "new-mission", kind: "action", title: "Start a mission", Icon: Rocket, run: focusInput },
          { key: "topology", kind: "action", title: "Open live topology", Icon: Network, run: () => go("/topology") },
          { key: "new-chat", kind: "action", title: "New AI chat", Icon: Plus, run: () => go("/chat") },
        ],
      });
      if (recentMissions.length > 0) {
        out.push({
          label: "Recent",
          rows: recentMissions.map((m) => ({
            key: `mission-${m.id}`,
            kind: "mission" as const,
            title: m.goal,
            hint: formatDistanceToNow(new Date(m.updatedAt), { addSuffix: true }),
            dotClass: missionDot(m.status),
            run: () => go(`/missions/${m.id}`),
          })),
        });
      }
      out.push({
        label: "Go to",
        rows: PAGE_LINKS.map((p) => ({
          key: `page-${p.href}`,
          kind: "page" as const,
          title: p.title,
          Icon: p.Icon,
          run: () => go(p.href),
        })),
      });
      return out;
    }
    const needle = q.toLowerCase();
    const rows: Row[] = [
      {
        key: "start-text",
        kind: "start",
        title: `Start mission: "${q}"`,
        hint: availAgents === 0 && !fleetLoading ? "will wait in the queue" : undefined,
        Icon: Rocket,
        run: submitMission,
      },
      { key: "ask-text", kind: "ask", title: `Ask AI Chat: "${q}"`, Icon: MessageCircle, run: askChat },
    ];
    out.push({ label: "Dispatch", rows });
    const matched = recentMissions.filter((m) => m.goal.toLowerCase().includes(needle));
    if (matched.length > 0) {
      out.push({
        label: "Recent",
        rows: matched.map((m) => ({
          key: `mission-${m.id}`,
          kind: "mission" as const,
          title: m.goal,
          hint: formatDistanceToNow(new Date(m.updatedAt), { addSuffix: true }),
          dotClass: missionDot(m.status),
          run: () => go(`/missions/${m.id}`),
        })),
      });
    }
    const pages = PAGE_LINKS.filter((p) => p.title.toLowerCase().includes(needle));
    if (pages.length > 0) {
      out.push({
        label: "Go to",
        rows: pages.map((p) => ({
          key: `page-${p.href}`,
          kind: "page" as const,
          title: p.title,
          Icon: p.Icon,
          run: () => go(p.href),
        })),
      });
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, recentMissions, availAgents, fleetLoading]);

  const flat = useMemo(() => groups.flatMap((g) => g.rows), [groups]);
  useEffect(() => {
    setActiveIndex((i) => Math.min(i, Math.max(0, flat.length - 1)));
  }, [flat.length ]);

  const onInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setActiveIndex((i) => (flat.length ? (i + 1) % flat.length : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setOpen(true);
      setActiveIndex((i) => (flat.length ? (i - 1 + flat.length) % flat.length : 0));
    } else if (e.key === "Home") {
      e.preventDefault();
      setActiveIndex(0);
    } else if (e.key === "End") {
      e.preventDefault();
      setActiveIndex(Math.max(0, flat.length - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (sendStateRef.current === "error") retry();
      else flat[activeIndex]?.run();
    } else if (e.key === "Escape") {
      e.preventDefault();
      if (text) {
        setText("");
        setActiveIndex(0);
      } else {
        closePanel();
        inputRef.current?.blur();
      }
    }
  };

  const hasText = q.length > 0;
  const sending = sendState === "sending";
  const succeeded = sendState === "success";
  const failed = sendState === "error";

  const buttonLabel = sending
    ? "Starting mission"
    : succeeded
      ? "Mission started"
      : failed
        ? "Retry sending"
        : hasText
          ? "Send to Strike OS"
          : "Focus the command bar";

  const onButtonClick = () => {
    if (sending || succeeded) return;
    if (failed) retry();
    else if (hasText) submitMission();
    else focusInput();
  };

  const activeId = flat.length ? `${listId}-opt-${activeIndex}` : undefined;
  let optionCursor = -1;

  return (
    <div ref={rootRef} className="relative mx-auto w-full min-w-0 max-w-xl flex-1 px-4">
      <style>{`@keyframes cmdshake{10%,90%{transform:translateX(-1px)}20%,80%{transform:translateX(2px)}30%,50%,70%{transform:translateX(-3px)}40%,60%{transform:translateX(3px)}}`}</style>
      <div className="group flex h-10 w-full items-center rounded-full border border-border bg-background pl-1 pr-1 text-sm hover:border-primary/40 focus-within:border-primary/40 focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2 focus-within:ring-offset-background">
        <span
          aria-hidden
          className={cn(
            "flex w-12 shrink-0 items-center pl-3 font-mono text-[11px] text-muted-foreground transition-opacity",
            focused || hasText ? "opacity-0" : "opacity-45 group-hover:opacity-70",
          )}
        >
          {mounted ? (isMac ? "⌘ K" : "Ctrl K") : ""}
        </span>
        <input
          ref={inputRef}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setActiveIndex(0);
            if (sendStateRef.current === "error") {
              setSend("ready");
              setErrorMsg(null);
            }
          }}
          onFocus={() => {
            setFocused(true);
            setOpen(true);
          }}
          onBlur={() => setFocused(false)}
          onKeyDown={onInputKeyDown}
          readOnly={sending || succeeded}
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-activedescendant={activeId}
          aria-autocomplete="list"
          aria-label="Command bar"
          placeholder="What would you like Strike OS to do?"
          className="h-full min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
        />
        <button
          type="button"
          onClick={onButtonClick}
          disabled={sending || succeeded}
          aria-label={buttonLabel}
          className={cn(
            "flex h-8 w-8 shrink-0 items-center justify-center rounded-full border transition-colors",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
            sending || (hasText && !succeeded)
              ? "border-transparent bg-primary text-primary-foreground hover:bg-primary/90"
              : succeeded || showCheck
                ? "border-transparent bg-success text-success-foreground"
                : failed
                  ? "border-destructive text-destructive"
                  : "border-border text-muted-foreground hover:text-foreground",
          )}
        >
          {sending ? (
            <span className="relative flex h-4 w-4 items-center justify-center">
              <StrikeMark className="h-4 w-4" />
              <span
                aria-hidden
                className="absolute -inset-0.5 rounded-full border-2 border-transparent border-t-current motion-safe:animate-spin"
              />
            </span>
          ) : succeeded || showCheck ? (
            <Check className="h-4 w-4" aria-hidden />
          ) : (
            <span key={shakeKey} className={cn("flex", failed && "motion-safe:animate-[cmdshake_0.4s_ease-in-out]")}>
              <StrikeMark className="h-4 w-4" />
            </span>
          )}
        </button>
      </div>

      {open && (
        <div className="absolute left-4 right-4 top-[calc(100%+8px)] z-50 rounded-lg border bg-popover p-1 text-popover-foreground">
          {sending ? (
            <div className="flex items-center gap-2.5 px-2 py-3" role="status">
              <span
                aria-hidden
                className="h-4 w-4 shrink-0 rounded-full border-2 border-primary/30 border-t-primary motion-safe:animate-spin"
              />
              <p className="text-sm">
                Starting mission...
                {availAgents === 0 && !fleetLoading && (
                  <span className="text-muted-foreground"> No agents free — it will wait in the queue.</span>
                )}
              </p>
            </div>
          ) : succeeded && success ? (
            <div className="px-2 py-3" role="status">
              <div className="flex items-center gap-2 text-sm font-medium text-success">
                <Check className="h-4 w-4" aria-hidden />
                Mission started
              </div>
              <p className="mt-1 truncate text-sm text-muted-foreground">{success.title}</p>
              <Link
                href={`/missions/${success.id}`}
                onClick={() => closePanel()}
                className="mt-2 inline-block text-sm font-medium text-primary underline-offset-4 hover:underline"
              >
                Open mission
              </Link>
            </div>
          ) : failed ? (
            <div className="px-2 py-3" role="alert">
              <div className="flex items-center gap-2 text-sm font-medium text-destructive">
                <TriangleAlert className="h-4 w-4" aria-hidden />
                Couldn&apos;t start that
              </div>
              <p className="mt-1 text-sm text-muted-foreground">{errorMsg ?? "Something went wrong."}</p>
              <button
                type="button"
                onClick={retry}
                className="mt-2 rounded-md border border-border px-3 py-1 text-xs font-medium hover:bg-accent hover:text-accent-foreground"
              >
                Try again
              </button>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2 px-2 py-1.5" role="status">
                <span
                  aria-hidden
                  className={cn(
                    "size-2 shrink-0 rounded-full",
                    fleetLoading || fleetFailed
                      ? "bg-muted-foreground"
                      : totalAgents === 0 || availAgents === 0
                        ? "bg-destructive"
                        : stalled
                          ? "bg-warning"
                          : "bg-success",
                    fleetLoading && "motion-safe:animate-pulse",
                  )}
                />
                <span className={MICRO_LABEL}>
                  {fleetLoading
                    ? "Checking fleet…"
                    : fleetFailed
                      ? "Fleet status unavailable"
                      : totalAgents === 0 || availAgents === 0
                        ? "No agents available. Work will wait in the queue"
                        : stalled
                          ? `Possible stall · last event ${lastEventAt ? formatDistanceToNow(new Date(lastEventAt), { addSuffix: true }) : "unknown"}`
                          : `${availAgents} of ${totalAgents} agents available`}
                </span>
              </div>
              <div aria-hidden className="-mx-1 h-px bg-border" />
              <ul role="listbox" id={listId} aria-label="Commands" className="max-h-[min(24rem,60vh)] overflow-auto">
                {groups.map((g) => (
                  <div key={g.label ?? "top"}>
                    {g.label && <li aria-hidden className={cn(MICRO_LABEL, "px-2 pb-1 pt-2")}>{g.label}</li>}
                    {g.rows.map((row) => {
                      optionCursor += 1;
                      const idx = optionCursor;
                      const id = `${listId}-opt-${idx}`;
                      const Icon = row.Icon;
                      return (
                        <li
                          key={row.key}
                          id={id}
                          role="option"
                          aria-selected={idx === activeIndex}
                          onMouseEnter={() => setActiveIndex(idx)}
                          onClick={() => row.run()}
                          className={cn(
                            "flex cursor-pointer select-none items-center gap-2.5 rounded-sm px-2 py-1.5 text-sm outline-none",
                            idx === activeIndex ? "bg-accent text-accent-foreground" : "text-foreground",
                          )}
                        >
                          {row.dotClass ? (
                            <span aria-hidden className={cn("size-2 shrink-0 rounded-full", row.dotClass)} />
                          ) : Icon ? (
                            <span className={ICON_CHIP} aria-hidden>
                              <Icon className="size-3 text-muted-foreground" aria-hidden />
                            </span>
                          ) : null}
                          <span className="min-w-0 flex-1 truncate">{row.title}</span>
                          {row.hint && <span className="shrink-0 text-xs text-muted-foreground">{row.hint}</span>}
                        </li>
                      );
                    })}
                  </div>
                ))}
              </ul>
            </>
          )}
        </div>
      )}
    </div>
  );
}
