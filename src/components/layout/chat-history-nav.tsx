"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import useSWR, { useSWRConfig } from "swr";
import { ChevronDown, MessageSquare, Plus, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/empty-state";
import { groupConversations, type Conversation } from "@/lib/chat-groups";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

const CHAT_NAV_OPEN_KEY = "strikeos.chat-nav-open";

type ChatHistoryListProps = {
  conversations: Conversation[];
  search: string;
  onSearch: (value: string) => void;
  activeId: string | null;
  onDelete: (id: string) => Promise<void> | void;
  onNavigate?: () => void;
};

function ChatHistoryList({
  conversations,
  search,
  onSearch,
  activeId,
  onDelete,
  onNavigate,
}: ChatHistoryListProps) {
  const q = search.trim().toLowerCase();
  const filtered = q
    ? conversations.filter(
        (c) =>
          c.title.toLowerCase().includes(q) ||
          (c.lastMessage ?? "").toLowerCase().includes(q)
      )
    : conversations;
  const grouped = groupConversations(filtered);

  return (
    <div className="space-y-1">
      <div className="relative px-1 pt-0.5">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="text"
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          placeholder="Search chats…"
          aria-label="Search chats"
          className="h-8 pl-8 text-[13px]"
        />
      </div>

      {conversations.length === 0 ? (
        <EmptyState
          icon={MessageSquare}
          title="No chats yet"
          description="Start one with New Chat above."
          className="mx-1 px-2 py-6"
        />
      ) : grouped.length === 0 ? (
        <EmptyState
          icon={Search}
          title="No matches"
          description={`Nothing matches "${q}".`}
          className="mx-1 px-2 py-6"
        />
      ) : (
        grouped.map(([group, items]) => (
          <div key={group}>
            <p className="px-3 pb-0.5 pt-2 text-[11.5px] text-muted-foreground">{group}</p>
            {items.map((c) => (
              <div key={c.id} className="group flex items-center gap-0.5">
                <Link
                  href={`/chat?c=${c.id}`}
                  title={c.title}
                  aria-label={c.title}
                  aria-current={activeId === c.id ? "page" : undefined}
                  onClick={onNavigate}
                  className={cn(
                    "min-w-0 flex-1 truncate rounded-md px-3 py-2 text-left text-[13px]",
                    activeId === c.id
                      ? "bg-accent text-accent-foreground"
                      : "text-foreground hover:bg-accent"
                  )}
                >
                  <span className="block truncate">{c.title}</span>
                </Link>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={`Delete conversation: ${c.title}`}
                  title="Delete"
                  onClick={() => onDelete(c.id)}
                  className="h-8 w-8 shrink-0 rounded-md opacity-0 transition-opacity focus-visible:opacity-100 group-hover:opacity-100 group-focus-within:opacity-100"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        ))
      )}
    </div>
  );
}

/**
 * AI Chat as a Level-2 entry: the route link, with the conversation history
 * folding out underneath it.
 *
 * The old sidebar needed a fixed-position flyout for this, because a collapsed
 * single column had nowhere to put an expander. The rail changes that: the chat
 * belongs to the Overview domain, so selecting Overview opens the panel and the
 * history has a real place to live. That drops the flyout entirely — no overlay
 * to collide with the panel, no outside-click handler, and no duplicated
 * collapsed/expanded rendering of the same list.
 */
export function ChatHistoryNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { mutate } = useSWRConfig();
  const { data } = useSWR<{ conversations: Conversation[] }>("/api/chat", fetcher, {
    revalidateOnFocus: false,
  });
  const [search, setSearch] = useState("");
  // Collapsed by default; the user's choice is remembered between reloads.
  const [historyOpen, setHistoryOpen] = useState(false);

  const conversations = data?.conversations ?? [];
  const activeId = searchParams.get("c");

  // Restore the collapsed-by-default choice after mount so SSR stays in sync.
  useEffect(() => {
    try {
      setHistoryOpen(window.localStorage.getItem(CHAT_NAV_OPEN_KEY) === "1");
    } catch {
      /* storage unavailable — stays collapsed */
    }
  }, []);

  const toggleHistory = () => {
    setHistoryOpen((v) => {
      const next = !v;
      try {
        window.localStorage.setItem(CHAT_NAV_OPEN_KEY, next ? "1" : "0");
      } catch {
        /* storage unavailable — state just won't survive reload */
      }
      return next;
    });
  };

  const deleteConversation = async (id: string) => {
    await fetch(`/api/chat/${id}`, { method: "DELETE" });
    await mutate("/api/chat");
    if (activeId === id) router.replace("/chat");
  };

  const onNewChat = pathname === "/chat" && !activeId;
  /* Highlighting depends only on the route, not on whether the history happens
   * to be expanded. Folding the history open while sitting on /chat is not a
   * reason to drop the active state from the page you are on. */
  const chatActive = onNewChat;

  return (
    <div className="space-y-1">
      <button
        type="button"
        onClick={toggleHistory}
        aria-expanded={historyOpen}
        className={cn(
          "flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60",
          chatActive
            ? "bg-accent text-accent-foreground"
            : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
        )}
      >
        <MessageSquare className="h-4 w-4 shrink-0" />
        <span className="min-w-0 flex-1 truncate text-left">AI Chat</span>
        {/* A dot rather than a colour change: a conversation is open, but the
            current page is the chat list, not that conversation. */}
        {!!activeId && !historyOpen && (
          <span aria-hidden="true" className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
        )}
        <ChevronDown
          className={cn(
            "h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform duration-200 motion-reduce:transition-none",
            historyOpen && "rotate-180"
          )}
        />
      </button>

      <div
        className={cn(
          "grid transition-[grid-template-rows] duration-200 motion-reduce:transition-none",
          historyOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
        )}
      >
        <div
          className="min-h-0 overflow-hidden"
          /* Collapsed, the links are still in the DOM, so zero height and
           * `aria-hidden` alone leave them in the tab order — and hiding
           * focusable content from assistive tech is an ARIA error in its own
           * right. `inert` is what actually takes them out of both.
           * React 18 has no `inert` prop (that arrived in 19), so it goes on as a
           * string attribute, which is the form the HTML attribute takes. */
          {...({ inert: historyOpen ? undefined : "" } as Record<string, unknown>)}
        >
          <div
            className={cn(
              "space-y-1 pt-1 transition-opacity duration-200 motion-reduce:transition-none",
              historyOpen ? "opacity-100" : "pointer-events-none opacity-0"
            )}
          >
            <Link
              href="/chat"
              title="New chat"
              aria-label="New chat"
              onClick={onNavigate}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                onNewChat
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
              )}
            >
              <Plus className="h-4 w-4 shrink-0" />
              <span>New Chat</span>
            </Link>

            <ChatHistoryList
              conversations={conversations}
              search={search}
              onSearch={setSearch}
              activeId={activeId}
              onDelete={deleteConversation}
              onNavigate={onNavigate}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
