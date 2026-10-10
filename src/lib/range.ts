export type DateRangeKey = "24h" | "7d" | "30d" | "90d";
export type RangeKey = DateRangeKey;

export const RANGES: { key: DateRangeKey; label: string; days: number }[] = [
  { key: "24h", label: "24h", days: 1 },
  { key: "7d", label: "7d", days: 7 },
  { key: "30d", label: "30d", days: 30 },
  { key: "90d", label: "90d", days: 90 },
];

export function parseDateRange(v: string | null | undefined): DateRangeKey {
  const k = (v || "").toLowerCase();
  if (k === "24h" || k === "7d" || k === "30d" || k === "90d") return k;
  return "7d";
}

export function rangeDays(range: DateRangeKey): number {
  if (range === "24h") return 1;
  if (range === "7d") return 7;
  if (range === "30d") return 30;
  if (range === "90d") return 90;
  return 7;
}
