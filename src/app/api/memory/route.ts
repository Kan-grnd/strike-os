import { NextResponse } from "next/server";
import prisma from "@/lib/db";
import { eventBus } from "@/lib/events";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const scope = searchParams.get("scope");
  const q = searchParams.get("q");
  const minImportance = parseFloat(searchParams.get("minImportance") || "0");

  let memories = await prisma.memory.findMany({
    where: {
      ...(scope ? { scope: scope as never } : {}),
      importance: { gte: minImportance },
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  // Simple text search in-memory (SQLite dev)
  if (q) {
    memories = memories.filter((m) =>
      m.content.toLowerCase().includes(q.toLowerCase())
    );
  }

  return NextResponse.json({ memories });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const memory = await prisma.memory.create({
      data: {
        content: body.content,
        importance: body.importance || 0.5,
        source: body.source || "manual",
        scope: body.scope || "GLOBAL",
        subjectId: body.subjectId,
        subjectType: body.subjectType,
        confidence: body.confidence || 1.0,
        expiresAt: body.expiresAt ? new Date(body.expiresAt) : undefined,
      },
    });

    await eventBus.emit({
      type: "memory.created",
      source: "memory-service",
      subject: "memory",
      subjectId: memory.id,
      payload: { scope: memory.scope, importance: memory.importance },
    });

    return NextResponse.json({ memory }, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to create memory" }, { status: 500 });
  }
}
