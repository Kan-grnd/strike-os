"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import useSWR, { useSWRConfig } from "swr";
import { MessageSquare, Plus, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/empty-state";
import { groupConversations, type Conversation } from "@/lib/chat-groups";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

type ChatHistoryListProps = {
  conversations: Conversation[];
  search: string;
  onSearch: (value: string) => void;
  activeId: string | null;
  onDelete: (id: string) => Promise<void> | void;
  searchRef?: React.RefObject<HTMLInputElement>;
};

function ChatHistoryList({
  conversations,
  search,
  onSearch,
  activeId,
  onDelete,
  searchRef,
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
          ref={searchRef}
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
          description={`Nothing matches "${search}".`}
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

export function ChatHistoryNav({ collapsed }: { collapsed: boolean }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { mutate } = useSWRConfig();
  const { data } = useSWR<{ conversations: Conversation[] }>("/api/chat", fetcher, {
    revalidateOnFocus: false,
  });
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [flyTop, setFlyTop] = useState(56);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const flySearchRef = useRef<HTMLInputElement>(null);

  const conversations = data?.conversations ?? [];
  const activeId = searchParams.get("c");

  // Close the flyout when navigating to a different route or conversation.
  useEffect(() => {
    setOpen(false);
  }, [pathname, activeId]);

  // Close the flyout on Escape or an outside pointer down.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        toggleRef.current?.focus();
      }
    };
    const onPointerDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (panelRef.current?.contains(t) || toggleRef.current?.contains(t)) return;
      setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [open]);

  // Focus the search field when the flyout opens.
  useEffect(() => {
    if (open) flySearchRef.current?.focus();
  }, [open]);

  const toggleFlyout = () => {
    if (toggleRef.current) {
      const r = toggleRef.current.getBoundingClientRect();
      const maxTop = Math.max(56, window.innerHeight - 400);
      setFlyTop(Math.min(Math.max(r.top, 56), maxTop));
    }
    setOpen((v) => !v);
  };

  const closeFlyout = () => {
    setOpen(false);
    toggleRef.current?.focus();
  };

  const deleteConversation = async (id: string) => {
    await fetch(`/api/chat/${id}`, { method: "DELETE" });
    await mutate("/api/chat");
    if (activeId === id) router.replace("/chat");
  };

  if (collapsed) {
    const onChat = pathname === "/chat";
    return (
      <>
        <button
          ref={toggleRef}
          type="button"
          onClick={toggleFlyout}
          aria-expanded={open}
          aria-label="AI Chat"
          title="AI Chat"
          className={cn(
            "flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
            onChat || open
              ? "bg-accent text-accent-foreground"
              : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
          )}
        >
          <MessageSquare className="h-4 w-4 shrink-0" />
        </button>
        {open && (
          <div
            ref={panelRef}
            role="dialog"
            aria-label="AI Chat"
            style={{ top: flyTop }}
            className="fixed left-[4.5rem] z-50 flex max-h-[70vh] w-72 flex-col overflow-hidden rounded-lg border border-border bg-card p-3 shadow-xl"
          >
            <div className="mb-2 flex items-center justify-between gap-2">
              <span className="flex min-w-0 items-center gap-2 text-sm font-semibold">
                <MessageSquare className="h-4 w-4 shrink-0 text-primary" />
                <span className="truncate">AI Chat</span>
              </span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7 shrink-0"
                aria-label="Close chats"
                onClick={closeFlyout}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <Link
              href="/chat"
              onClick={closeFlyout}
              className={cn(
                "mb-1 flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                pathname === "/chat" && !activeId
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
              )}
            >
              <Plus className="h-4 w-4 shrink-0" />
              <span>New Chat</span>
            </Link>
            <div className="min-h-0 flex-1 overflow-y-auto">
              <ChatHistoryList
                conversations={conversations}
                search={search}
                onSearch={setSearch}
                activeId={activeId}
                onDelete={deleteConversation}
                searchRef={flySearchRef}
              />
            </div>
          </div>
        )}
      </>
    );
  }

  const onNewChat = pathname === "/chat" && !activeId;

  return (
    <div className="space-y-1">
      <Link
        href="/chat"
        title="New chat"
        aria-label="New chat"
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
      />
    </div>
  );
}