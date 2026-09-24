"use client";

import { Suspense, useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import useSWR from "swr";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  User,
  Bot,
  Send,
  Loader2,
  Search,
  Copy,
  Check,
  ThumbsUp,
  ThumbsDown,
  KeyRound,
  List,
  Code,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Conversation } from "@/lib/chat-groups";
import { PromptComposer, PromptTextarea } from "@/components/chat/prompt-composer";
import { ModelPicker } from "@/components/chat/model-picker";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

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
@media (prefers-reduced-motion: reduce) {
  .rise.enter > *, .orb, .shimmer-line, .spin-icon, .msgacts button { animation: none !important; }
  .send-icon, .pressable { transition: none !important; }
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

function ChatPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();

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

  const activeId = searchParams.get("c");
  const { data: threadData, mutate: mutateThread } = useSWR<
    { conversation: { messages: ChatMessage[]; title: string } }
  >(activeId ? `/api/chat/${activeId}` : null, fetcher);

  const messages = activeId && threadData ? threadData.conversation.messages : [];
  const threadTitle = activeId && threadData ? threadData.conversation.title : null;

  const [modelId, setModelId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<ChatError | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [votes, setVotes] = useState<Record<string, "up" | "down" | null>>({});
  const [entered, setEntered] = useState(false);

  const threadRef = useRef<HTMLDivElement | null>(null);
  const composerRef = useRef<HTMLTextAreaElement | null>(null);
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Default to the first model after models load.
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
        router.replace(`/chat?c=${conversationId}`);
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
    <div className="flex h-full min-h-0 flex-col">
      <style dangerouslySetInnerHTML={{ __html: MOTION_CSS }} />

      {/* ── open chat layer ── */}
      <main className="flex min-h-0 min-w-0 flex-1 flex-col">
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
          className="min-h-0 flex-1 overflow-y-auto"
        >
          <div
            className={cn(
              "mx-auto flex min-h-full max-w-[820px] flex-col gap-4 px-4 py-6 sm:px-6 sm:py-8",
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
                    className="orb mb-3 h-[112px] w-[112px] rounded-full [@media(min-height:640px)]:mb-5 [@media(min-height:640px)]:h-[124px] [@media(min-height:640px)]:w-[124px]"
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
                  <h1 className="text-[24px] font-extrabold leading-tight tracking-tight sm:text-[30px]">
                    Good {partOfDay()}, Operator
                  </h1>
                  <p className="mt-0.5 text-[24px] font-extrabold leading-tight tracking-tight text-muted-foreground sm:text-[30px]">
                    How Can I <span className="text-primary">Assist You Today?</span>
                  </p>
                  <div className="mt-3 flex flex-wrap items-center justify-center gap-2 [@media(min-height:640px)]:mt-5">
                    {SUGGESTIONS.map((s) => (
                      <Button
                        key={s.label}
                        type="button"
                        variant="outline"
                        onClick={() => {
                          setDraft(s.q);
                          composerRef.current?.focus();
                        }}
                        className="pressable h-8 gap-2 rounded-full px-4 text-[12.5px] font-semibold"
                      >
                        <s.icon className="h-3.5 w-3.5" />
                        {s.label}
                      </Button>
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
                                <div className="mt-1.5">
                                  <Badge variant="secondary" className="font-mono text-[10.5px] font-normal leading-none">
                                    {meta}
                                  </Badge>
                                </div>
                              )}
                            </div>
                            {!isUser && (
                              <div className="msgacts mt-1.5 flex items-center gap-0.5 pl-1">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  aria-label="Copy message"
                                  title="Copy"
                                  onClick={() => copyMessage(m)}
                                  className="h-8 w-8 rounded-md"
                                >
                                  {copiedId === m.id ? (
                                    <Check className="h-3.5 w-3.5 text-success" />
                                  ) : (
                                    <Copy className="h-3.5 w-3.5" />
                                  )}
                                </Button>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  aria-label="Good response"
                                  aria-pressed={votes[m.id] === "up"}
                                  title="Good response"
                                  onClick={() => toggleVote(m.id, "up")}
                                  className={cn(
                                    "h-8 w-8 rounded-md",
                                    votes[m.id] === "up" && "text-primary"
                                  )}
                                >
                                  <ThumbsUp className="h-3.5 w-3.5" />
                                </Button>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  aria-label="Bad response"
                                  aria-pressed={votes[m.id] === "down"}
                                  title="Bad response"
                                  onClick={() => toggleVote(m.id, "down")}
                                  className={cn(
                                    "h-8 w-8 rounded-md",
                                    votes[m.id] === "down" && "text-primary"
                                  )}
                                >
                                  <ThumbsDown className="h-3.5 w-3.5" />
                                </Button>
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
                role="alert"
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
        <form onSubmit={send} className="shrink-0 border-t border-border/40">
          <div className="mx-auto w-full max-w-[820px] px-4 py-3 sm:px-6">
            <PromptComposer
              value={draft}
              onValueChange={setDraft}
              disabled={sending}
              textareaRef={composerRef}
            >
              <PromptTextarea
                id="chat-composer"
                placeholder="Ask me anything…"
                aria-label="Message"
                enterKeyHint="send"
                onKeyDown={onComposerKey}
              />
              <div className="flex items-center gap-1.5 px-2 pb-1 pt-1">
                <ModelPicker
                  models={models}
                  value={modelId}
                  onChange={setModelId}
                  disabled={sending}
                />
                <Button
                  type="submit"
                  variant="default"
                  size="icon"
                  disabled={!ready}
                  aria-label="Send message"
                  aria-busy={sending}
                  className={cn(
                    "send-icon ml-auto h-9 w-9 shrink-0 rounded-xl transition-transform [transition-duration:100ms] ease-out",
                    !ready && "bg-muted text-muted-foreground hover:bg-muted hover:text-muted-foreground",
                    ready && "active:scale-90"
                  )}
                >
                  {sending ? (
                    <Loader2 className="spin-icon h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </Button>
              </div>
            </PromptComposer>
          </div>
        </form>
      </main>
    </div>
  );
}

export default function ChatPage() {
  return (
    <Suspense fallback={null}>
      <ChatPageInner />
    </Suspense>
  );
}