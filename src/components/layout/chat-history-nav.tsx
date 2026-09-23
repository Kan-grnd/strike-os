"use client";

import { useState } from "react";
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

export function ChatHistoryNav({ collapsed }: { collapsed: boolean }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { mutate } = useSWRConfig();
  const { data } = useSWR<{ conversations: Conversation[] }>("/api/chat", fetcher, {
    revalidateOnFocus: false,
  });
  const [search, setSearch] = useState("");

  const conversations = data?.conversations ?? [];
  const activeId = searchParams.get("c");

  if (collapsed) {
    return (
      <Link
        href="/chat"
        title="AI Chat"
        aria-label="AI Chat"
        className={cn(
          "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
          pathname === "/chat"
            ? "bg-accent text-accent-foreground"
            : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
        )}
      >
        <MessageSquare className="h-4 w-4 shrink-0" />
      </Link>
    );
  }

  const q = search.trim().toLowerCase();
  const filtered = q
    ? conversations.filter(
        (c) =>
          c.title.toLowerCase().includes(q) ||
          (c.lastMessage ?? "").toLowerCase().includes(q)
      )
    : conversations;
  const grouped = groupConversations(filtered);
  const onNewChat = pathname === "/chat" && !activeId;

  const deleteConversation = async (id: string) => {
    await fetch(`/api/chat/${id}`, { method: "DELETE" });
    await mutate("/api/chat");
    if (activeId === id) router.replace("/chat");
  };

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

      <div className="relative px-1 pt-0.5">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
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
                  onClick={() => deleteConversation(c.id)}
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