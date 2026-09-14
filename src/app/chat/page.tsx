"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import useSWR from "swr";
import Link from "next/link";
import {
  User,
  Bot,
  Plus,
  Send,
  Loader2,
  ChevronLeft,
  Search,
  X,
  Copy,
  Check,
  ThumbsUp,
  ThumbsDown,
  CornerDownLeft,
  KeyRound,
  List,
  Code,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

type Conversation = {
  id: string;
  title: string;
  modelId: string | null;
  createdAt: string;
  updatedAt: string;
  lastMessage: string | null;
  lastRole: string | null;
};

type ChatMessage = {
  id: string;
  conversationId: string;
  role: string;
  content: string;
  tokens: number | null;
  cost: number | null;
  createdAt: string;
};

type ModelInfo = {
  id: string;
  name: string;
  provider: { name: string };
};

type ChatError = {
  message: string;
  code: string;
  provider: string | null;
  noKey: boolean;
};

const RAIL_KEY = "strike.chat.rail";

const SUGGESTIONS: { label: string; q: string; icon: typeof List }[] = [
  { label: "Summary", q: "Summarize mission status", icon: List },
  { label: "Code", q: "Show me what the Coder branch changed", icon: Code },
  { label: "Design", q: "How should the report be structured?", icon: Sparkles },
  { label: "Research", q: "Which agents are blocked?", icon: Search },
];

function partOfDay(): string {
  const h = new Date().getHours();
  if (h < 12) return "Morning";
  if (h < 18) return "Afternoon";
  return "Evening";
}

function bucketGroup(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const day = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const diff = Math.round((today - day) / 86400000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  if (diff <= 7) return "7 Days Ago";
  return "Older";
}

const GROUP_ORDER = ["Today", "Yesterday", "7 Days Ago", "Older"];

const MOTION_CSS = `
.rise.enter > * { animation: rise .18s ease-out both; }
.rise.enter > *:nth-child(2) { animation-delay: .04s; }
.rise.enter > *:nth-child(3) { animation-delay: .08s; }
.rise.enter > *:nth-child(4) { animation-delay: .12s; }
.rise.enter > *:nth-child(5) { animation-delay: .16s; }
.rise.enter > *:nth-child(6) { animation-delay: .2s; }
.rise.enter > *:nth-child(n+7) { animation-delay: .24s; }
@keyframes rise {
  from { opacity: 0; transform: translateY(6px); }
  to { opacity: 1; transform: none; }
}
.orb { animation: orb-breathe 7s ease-in-out infinite; }
@keyframes orb-breathe {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.025); }
}
.shimmer-line {
  background: linear-gradient(100deg, hsl(var(--muted-foreground)) 30%, hsl(var(--foreground)) 50%, hsl(var(--muted-foreground)) 70%);
  background-size: 200% 100%;
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  animation: shimmer 1.6s linear infinite;
}
@keyframes shimmer {
  to { background-position: -200% 0; }
}
.msgacts button { transition: background-color .12s ease-out, color .12s ease-out, transform .1s ease-out; }
.msgacts button:active { transform: scale(.9); }
.rail-list {
  -webkit-mask-image: linear-gradient(to bottom, transparent 0, black 8px, black calc(100% - 8px), transparent 100%);
  mask-image: linear-gradient(to bottom, transparent 0, black 8px, black calc(100% - 8px), transparent 100%);
}
@media (prefers-reduced-motion: reduce) {
  .rise.enter > *, .orb, .shimmer-line, .spin-icon, .msgacts button { animation: none !important; }
  .rail, .send-icon, .pressable { transition: none !important; }
  .pressable:active { transform: none !important; }
}
`;

function metaLine(m: ChatMessage): string | null {
  if (m.role !== "assistant") return null;
  if (m.tokens == null && m.cost == null) return null;
  const parts: string[] = [];
  if (m.tokens != null) parts.push(`${m.tokens} tokens`);
  if (m.cost != null) parts.push(`$${m.cost.toFixed(4)}`);
  return parts.join(" · ");
}

export default function ChatPage() {
  const { data: listData, mutate: mutateList } = useSWR<{ conversations: Conversation[] }>(
    "/api/chat",
    fetcher,
    { revalidateOnFocus: false }
  );
  const { data: modelsData } = useSWR<{ models: ModelInfo[] }>("/api/models", fetcher, {
    revalidateOnFocus: false,
  });

  const conversations = listData?.conversations ?? [];
  const models = modelsData?.models ?? [];

  const [activeId, setActiveId] = useState<string | null>(null);
  const { data: threadData, mutate: mutateThread } = useSWR<
    { conversation: { messages: ChatMessage[]; title: string } }
  >(activeId ? `/api/chat/${activeId}` : null, fetcher);

  const messages = activeId && threadData ? threadData.conversation.messages : [];
  const threadTitle = activeId && threadData ? threadData.conversation.title : null;

  const [modelId, setModelId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<ChatError | null>(null);

  const [search, setSearch] = useState("");
  const [railCollapsed, setRailCollapsed] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [votes, setVotes] = useState<Record<string, "up" | "down" | null>>({});
  const [entered, setEntered] = useState(false);

  const threadRef = useRef<HTMLDivElement | null>(null);
  const composerRef = useRef<HTMLTextAreaElement | null>(null);
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Rail collapse state is presentation-only and persists locally.
  useEffect(() => {
    let stored: string | null = null;
    try {
      stored = window.localStorage.getItem(RAIL_KEY);
    } catch {
      /* storage unavailable — default to expanded */
    }
    if (stored === null && window.innerWidth < 760) setRailCollapsed(true);
    else setRailCollapsed(stored === "closed");
  }, []);

  const toggleRail = () => {
    const next = !railCollapsed;
    setRailCollapsed(next);
    try {
      window.localStorage.setItem(RAIL_KEY, next ? "closed" : "open");
    } catch {
      /* ignore */
    }
  };

  // Default to the cheapest model after models load.
  useEffect(() => {
    if (!modelId && models.length > 0) setModelId(models[0].id);
  }, [models, modelId]);

  // Auto-scroll to the latest message whenever the thread grows or a reply is pending.
  useEffect(() => {
    const el = threadRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length, sending, activeId]);

  // Rise-in plays only when switching threads — never again on send.
  useEffect(() => {
    setEntered(true);
    const t = setTimeout(() => setEntered(false), 320);
    return () => clearTimeout(t);
  }, [activeId]);

  useEffect(() => () => {
    if (copyTimer.current) clearTimeout(copyTimer.current);
  }, []);

  // Composer autosize: grow with content, cap at 200px, reset when cleared.
  useEffect(() => {
    const el = composerRef.current;
    if (!el) return;
    if (draft === "") {
      el.style.height = "";
      return;
    }
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, [draft]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return conversations;
    return conversations.filter(
      (c) =>
        c.title.toLowerCase().includes(q) ||
        (c.lastMessage ?? "").toLowerCase().includes(q)
    );
  }, [conversations, search]);

  const grouped = useMemo(() => {
    const map = new Map<string, Conversation[]>();
    for (const c of filtered) {
      const g = bucketGroup(c.updatedAt);
      const list = map.get(g) ?? [];
      list.push(c);
      map.set(g, list);
    }
    return GROUP_ORDER.filter((g) => map.has(g)).map((g) => [g, map.get(g)!] as const);
  }, [filtered]);

  const startNew = () => {
    setActiveId(null);
    setSendError(null);
    composerRef.current?.focus();
  };

  const deleteConversation = async (id: string) => {
    await fetch(`/api/chat/${id}`, { method: "DELETE" });
    if (activeId === id) {
      setActiveId(null);
      setSendError(null);
    }
    await mutateList();
  };

  const send = async (e: FormEvent) => {
    e.preventDefault();
    const content = draft.trim();
    if (!content || sending) return;
    setSending(true);
    setSendError(null);

    try {
      let conversationId = activeId;
      if (!conversationId) {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: content.length > 48 ? content.slice(0, 48) + "…" : content,
            modelId,
          }),
        });
        const created = await res.json();
        if (!res.ok) throw new Error(created.error || "Failed to start chat");
        conversationId = created.conversation.id;
        setActiveId(conversationId);
        await mutateList();
      }

      const res = await fetch(`/api/chat/${conversationId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content, modelId }),
      });
      const data = await res.json();

      if (!res.ok) {
        const err: ChatError =
          typeof data.error === "object" && data.error !== null
            ? data.error
            : { message: data.error || "Send failed", code: "unknown", provider: null, noKey: false };
        setSendError(err);
        setDraft("");
        await Promise.all([mutateList(), mutateThread()]);
        return;
      }

      setDraft("");
      await Promise.all([mutateList(), mutateThread()]);
      setSendError(null);
      composerRef.current?.focus();
    } catch (err: any) {
      setSendError({ message: err.message || "Send failed", code: "network", provider: null, noKey: false });
    } finally {
      setSending(false);
    }
  };

  const onComposerKey = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send(e as unknown as FormEvent);
    }
  };

  const copyMessage = async (m: ChatMessage) => {
    try {
      await navigator.clipboard.writeText(m.content);
      setCopiedId(m.id);
      if (copyTimer.current) clearTimeout(copyTimer.current);
      copyTimer.current = setTimeout(() => setCopiedId(null), 1200);
    } catch {
      /* clipboard unavailable — nothing to show */
    }
  };

  const toggleVote = (id: string, which: "up" | "down") => {
    setVotes((v) => ({ ...v, [id]: v[id] === which ? null : which }));
  };

  const ready = draft.trim().length > 0 && !sending;

  return (
    <div className="flex h-[calc(100vh-6.5rem)] gap-2 py-1 sm:gap-3">
      <style dangerouslySetInnerHTML={{ __html: MOTION_CSS }} />

      {/* ── history rail ── */}
      <aside
        className={cn(
          "rail flex flex-col overflow-hidden rounded-2xl border border-border bg-card transition-[width] [transition-duration:180ms] ease-out motion-reduce:transition-none",
          railCollapsed ? "w-[68px]" : "w-[220px] sm:w-[264px]"
        )}
        aria-label="Chat history"
      >
        <div className={cn("flex items-center gap-2 py-2.5", railCollapsed ? "justify-center px-0" : "px-3")}>
          <button
            type="button"
            onClick={toggleRail}
            aria-label={railCollapsed ? "Expand history panel" : "Collapse history panel"}
            aria-expanded={!railCollapsed}
            title={railCollapsed ? "Expand history panel" : "Collapse history panel"}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-border text-muted-foreground hover:border-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:outline-none"
          >
            <ChevronLeft className={cn("h-3.5 w-3.5 transition-transform duration-200", railCollapsed && "rotate-180")} />
          </button>
          {!railCollapsed && (
            <div className="flex min-w-0 flex-1 items-center gap-2 rounded-lg border border-border bg-background px-2.5 py-1.5 text-muted-foreground">
              <Search className="h-3 w-3 shrink-0" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search chats…"
                aria-label="Search chats"
                className="min-w-0 flex-1 bg-transparent text-base text-foreground outline-none placeholder:text-muted-foreground sm:text-[12.5px]"
              />
            </div>
          )}
        </div>

        <div className="rail-list flex-1 space-y-1 overflow-y-auto px-1.5 py-1">
          {conversations.length === 0 ? (
            railCollapsed ? null : (
              <div className="px-3.5 py-5 text-[12.5px] leading-relaxed text-muted-foreground">
                <strong className="font-semibold text-foreground">No chats yet.</strong>
                <br />
                Start one below — or press New Chat.
              </div>
            )
          ) : grouped.length === 0 ? (
            railCollapsed ? null : (
              <p className="px-3.5 py-3 text-[11.5px] uppercase tracking-wider text-muted-foreground">No matches</p>
            )
          ) : (
            grouped.map(([group, items]) => (
              <div key={group}>
                {!railCollapsed && <p className="px-3 pb-0.5 pt-2 text-[11.5px] text-muted-foreground">{group}</p>}
                {items.map((c) => (
                  <div key={c.id} className="group flex items-center gap-0.5">
                    <button
                      type="button"
                      onClick={() => {
                        setActiveId(c.id);
                        setSendError(null);
                      }}
                      title={c.title}
                      className={cn(
                        "min-w-0 flex-1 truncate rounded-lg text-left text-[13px]",
                        railCollapsed ? "flex justify-center p-0" : "px-3 py-2",
                        c.id === activeId
                          ? "bg-accent text-accent-foreground"
                          : "text-foreground hover:bg-accent"
                      )}
                    >
                      {railCollapsed && (
                        <span className={cn(
                          "mx-auto flex h-9 w-9 items-center justify-center rounded-[10px] border text-[13.5px] font-bold transition-transform [transition-duration:120ms] ease-out active:scale-95",
                          c.id === activeId
                            ? "border-transparent bg-primary text-primary-foreground"
                            : "border-border bg-muted text-foreground"
                        )}>
                          {c.title.trim().charAt(0).toUpperCase()}
                        </span>
                      )}
                      {!railCollapsed && <span className="block truncate">{c.title}</span>}
                    </button>
                    {!railCollapsed && (
                      <button
                        type="button"
                        aria-label={`Delete conversation: ${c.title}`}
                        title="Delete"
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteConversation(c.id);
                        }}
                        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-muted-foreground opacity-0 transition-opacity hover:bg-accent hover:text-foreground focus:opacity-100 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none group-hover:opacity-100 group-focus-within:opacity-100"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            ))
          )}
        </div>

        <div className="border-t border-border/60 p-2.5">
          <button
            type="button"
            onClick={startNew}
            aria-label="New chat"
            title="New chat"
            className={cn(
              "pressable flex h-9 items-center justify-center gap-2 rounded-lg bg-primary font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:outline-none",
              railCollapsed ? "mx-auto w-9" : "w-full"
            )}
          >
            <Plus className="h-4 w-4" />
            {!railCollapsed && <span className="text-[13px] font-bold">New Chat</span>}
          </button>
        </div>
      </aside>

      {/* ── stage ── */}
      <main className="flex min-w-0 flex-1 flex-col">
        <a
          href="#chat-composer"
          className="sr-only rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-[95] focus:ring-2 focus:ring-ring"
        >
          Skip to composer
        </a>

        <div
          ref={threadRef}
          role="log"
          aria-live="polite"
          aria-label="Conversation"
          className="flex-1 overflow-y-auto"
        >
          <div
            className={cn(
              "mx-auto flex min-h-full max-w-[820px] flex-col gap-5 px-6 py-10",
              !activeId && "justify-center"
            )}
          >
            {!activeId || messages.length === 0 ? (
              <div key={`welcome-${activeId ?? "new"}`} className={cn("rise", entered && "enter")}>
                {/* welcome hero */}
                <div className="flex flex-col items-center px-3 pb-2 text-center">
                  <div
                    role="img"
                    aria-label="Strike intelligence orb"
                    className="orb mb-6 h-[148px] w-[148px] rounded-full"
                    style={{
                      background: [
                        "radial-gradient(circle at 62% 30%, hsl(var(--primary) / 0.65) 0%, transparent 52%)",
                        "radial-gradient(circle at 38% 62%, hsl(var(--secondary) / 0.5) 0%, transparent 55%)",
                        "radial-gradient(circle at 55% 55%, hsl(var(--background)) 0%, hsl(var(--card)) 72%)",
                      ].join(", "),
                      boxShadow:
                        "0 0 60px hsl(var(--primary) / 0.16), 0 0 120px hsl(var(--secondary) / 0.1), inset -14px -18px 44px hsl(var(--background) / 0.75)",
                    }}
                  >
                    <span className="absolute left-[30%] top-[40%] h-px w-px rounded-full bg-foreground/60" />
                    <span className="absolute left-[62%] top-[58%] h-px w-px rounded-full bg-foreground/60" />
                    <span className="absolute left-[48%] top-[30%] h-[1.5px] w-[1.5px] rounded-full bg-foreground/60" />
                    <span className="absolute left-[70%] top-[34%] h-px w-px rounded-full bg-foreground/60" />
                    <span className="absolute left-[40%] top-[66%] h-px w-px rounded-full bg-foreground/60" />
                  </div>
                  <h1 className="text-[30px] font-extrabold leading-tight tracking-tight">
                    Good {partOfDay()}, Operator
                  </h1>
                  <p className="mt-0.5 text-[30px] font-extrabold leading-tight tracking-tight text-muted-foreground">
                    How Can I <span className="text-primary">Assist You Today?</span>
                  </p>
                  <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
                    {SUGGESTIONS.map((s) => (
                      <button
                        key={s.label}
                        type="button"
                        onClick={() => {
                          setDraft(s.q);
                          composerRef.current?.focus();
                        }}
                        className="pressable flex h-8 items-center gap-2 rounded-full border border-border bg-card px-4 text-[12.5px] font-semibold text-card-foreground transition-colors hover:border-primary hover:text-primary focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                      >
                        <s.icon className="h-3.5 w-3.5" />
                        {s.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <>
                <h1 className="text-xl font-semibold">{threadTitle}</h1>
                <div key={`thread-${activeId}`} className={cn("flex flex-col gap-5", "rise", entered && "enter")}>
                  {messages.map((m) => {
                    const meta = metaLine(m);
                    const isUser = m.role === "user";
                    return (
                      <div
                        key={m.id}
                        className={cn("flex w-full gap-3", isUser ? "justify-end" : "justify-start")}
                      >
                        <div className={cn("flex max-w-[85%] gap-3", isUser && "flex-row-reverse")}>
                          <div
                            className={cn(
                              "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg",
                              isUser
                                ? "bg-primary text-primary-foreground"
                                : "bg-muted text-muted-foreground"
                            )}
                          >
                            {isUser ? <User className="h-3.5 w-3.5" /> : <Bot className="h-3.5 w-3.5" />}
                          </div>
                          <div className="min-w-0">
                            <div
                              className={cn(
                                "rounded-xl px-3.5 py-2.5 text-[13.5px] leading-relaxed [overflow-wrap:anywhere]",
                                isUser
                                  ? "bg-primary text-primary-foreground"
                                  : "border border-border bg-card text-card-foreground"
                              )}
                            >
                              <p className="whitespace-pre-wrap">{m.content}</p>
                              {meta && (
                                <p className="mt-1.5 font-mono text-[10.5px] leading-none text-muted-foreground">
                                  {meta}
                                </p>
                              )}
                            </div>
                            {!isUser && (
                              <div className="msgacts mt-1.5 flex items-center gap-0.5 pl-1">
                                <button
                                  type="button"
                                  aria-label="Copy message"
                                  title="Copy"
                                  onClick={() => copyMessage(m)}
                                  className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                                >
                                  {copiedId === m.id ? (
                                    <Check className="h-3.5 w-3.5 text-success" />
                                  ) : (
                                    <Copy className="h-3.5 w-3.5" />
                                  )}
                                </button>
                                <button
                                  type="button"
                                  aria-label="Good response"
                                  aria-pressed={votes[m.id] === "up"}
                                  title="Good response"
                                  onClick={() => toggleVote(m.id, "up")}
                                  className={cn(
                                    "flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                                    votes[m.id] === "up" && "text-primary"
                                  )}
                                >
                                  <ThumbsUp className="h-3.5 w-3.5" />
                                </button>
                                <button
                                  type="button"
                                  aria-label="Bad response"
                                  aria-pressed={votes[m.id] === "down"}
                                  title="Bad response"
                                  onClick={() => toggleVote(m.id, "down")}
                                  className={cn(
                                    "flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                                    votes[m.id] === "down" && "text-primary"
                                  )}
                                >
                                  <ThumbsDown className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  {sending && (
                    <div className="flex w-full gap-3">
                      <div className="flex max-w-[85%] gap-3">
                        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                          <Bot className="h-3.5 w-3.5" />
                        </div>
                        <div className="flex items-center gap-3 px-1 py-1.5">
                          <span className="shimmer-line text-[13.5px] font-semibold">Thinking…</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </>
            )}

            {sendError && (
              <div
                role="status"
                className="mt-2 flex items-start gap-3 rounded-xl border border-warning/40 bg-warning/5 px-4 py-3"
              >
                <KeyRound className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
                <div className="min-w-0 text-sm">
                  <p className="font-medium text-foreground">No reply — model provider unreachable</p>
                  <p className="mt-0.5 text-muted-foreground">{sendError.message}</p>
                  {sendError.noKey && (
                    <p className="mt-1.5 text-muted-foreground">
                      Add your provider API key in{" "}
                      <Link
                        href="/settings"
                        className="font-medium text-foreground underline underline-offset-2 hover:text-primary"
                      >
                        Settings → Secrets
                      </Link>{" "}
                      and try again. Strike OS never fabricates replies.
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── composer ── */}
        <form onSubmit={send} className="shrink-0 px-6 pb-6">
          <div className="mx-auto max-w-[820px] overflow-hidden rounded-2xl border border-border bg-card focus-within:border-foreground/30">
            <textarea
              id="chat-composer"
              ref={composerRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={onComposerKey}
              placeholder="Ask me anything…"
              aria-label="Message"
              rows={2}
              enterKeyHint="send"
              disabled={sending}
              className="block h-auto min-h-[52px] w-full resize-none overflow-x-hidden bg-transparent px-4 pb-1 pt-3.5 text-[13.5px] leading-relaxed text-foreground outline-none [overflow-wrap:anywhere] placeholder:text-muted-foreground disabled:opacity-60"
            />
            <div className="flex items-center gap-2 px-3 pb-3">
              <select
                value={modelId ?? ""}
                onChange={(e) => setModelId(e.target.value || null)}
                disabled={sending || models.length === 0}
                aria-label="Model"
                className="h-8 max-w-[240px] rounded-full border border-border bg-background px-3 text-[12px] text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
              >
                {models.length === 0 ? (
                  <option value="">No models configured</option>
                ) : (
                  models.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} · {m.provider.name}
                    </option>
                  ))
                )}
              </select>
              <span className="hidden flex-1 items-center gap-1 text-[11px] text-faint sm:flex">
                <CornerDownLeft className="h-3 w-3" />
                Enter to send
              </span>
              <button
                type="submit"
                disabled={!ready}
                aria-label="Send message"
                aria-busy={sending}
                className={cn(
                  "send-icon flex h-9 w-9 items-center justify-center rounded-full transition-transform [transition-duration:100ms] ease-out focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                  ready
                    ? "bg-primary text-primary-foreground hover:bg-primary/90"
                    : "bg-muted text-muted-foreground",
                  ready && "active:scale-90"
                )}
              >
                {sending ? (
                  <Loader2 className="spin-icon h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>
        </form>
      </main>
    </div>
  );
}