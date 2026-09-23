export type Conversation = {
  id: string;
  title: string;
  modelId: string | null;
  createdAt: string;
  updatedAt: string;
  lastMessage: string | null;
  lastRole: string | null;
};

export function bucketGroup(iso: string): string {
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

export const GROUP_ORDER = ["Today", "Yesterday", "7 Days Ago", "Older"];

export function groupConversations(list: Conversation[]): [string, Conversation[]][] {
  const map = new Map<string, Conversation[]>();
  for (const c of list) {
    const g = bucketGroup(c.updatedAt);
    const arr = map.get(g) ?? [];
    arr.push(c);
    map.set(g, arr);
  }
  return GROUP_ORDER.filter((g) => map.has(g)).map(
    (g) => [g, map.get(g)!] as [string, Conversation[]]
  );
}