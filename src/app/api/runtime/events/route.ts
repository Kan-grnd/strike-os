import { NextResponse } from "next/server";
import prisma from "@/lib/db";
import { mapEvent } from "@/lib/runtime/mappers";
import type { EventRuntime } from "@/lib/runtime/types";

export const dynamic = "force-dynamic";

const POLL_LIMIT = 100;
const FALLBACK_LIMIT = 50;

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const sinceRaw = searchParams.get("since");
  let since: Date | null = null;
  if (sinceRaw) {
    const parsed = new Date(sinceRaw);
    if (!Number.isNaN(parsed.getTime())) since = parsed;
  }

  const events = since
    ? await prisma.event.findMany({
        where: { timestamp: { gt: since } },
        orderBy: { timestamp: "asc" },
        take: POLL_LIMIT,
      })
    : (await prisma.event.findMany({
        orderBy: { timestamp: "desc" },
        take: FALLBACK_LIMIT,
      })).reverse();

  const mapped: EventRuntime[] = events.map(mapEvent);
  const cursor = events.length > 0 ? new Date(events[events.length - 1].timestamp).toISOString() : (sinceRaw ?? null);

  return NextResponse.json({ events: mapped, cursor });
}