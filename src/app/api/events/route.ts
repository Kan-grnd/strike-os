import { NextResponse } from "next/server";
import prisma from "@/lib/db";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type");
  const missionId = searchParams.get("missionId");
  const agentId = searchParams.get("agentId");
  const since = searchParams.get("since");
  const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 200);

  const events = await prisma.event.findMany({
    where: {
      ...(type ? { type } : {}),
      ...(missionId ? { missionId } : {}),
      ...(agentId ? { agentId } : {}),
      ...(since ? { timestamp: { gt: new Date(since) } } : {}),
    },
    orderBy: { timestamp: "desc" },
    take: limit,
  });

  return NextResponse.json({ events });
}