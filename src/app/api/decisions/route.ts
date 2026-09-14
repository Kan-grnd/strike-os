import { NextResponse } from "next/server";
import prisma from "@/lib/db";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q");
  const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 200);

  const memories = await prisma.memory.findMany({
    where: {
      AND: [
        {
          OR: [
            { source: "decision" },
            { content: { contains: "decision" } },
            { content: { contains: "decided" } },
          ],
        },
        q ? { content: { contains: q } } : {},
      ],
    },
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  return NextResponse.json({ decisions: memories });
}