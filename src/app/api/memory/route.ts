import { NextResponse } from "next/server";
import prisma from "@/lib/db";
import { eventBus } from "@/lib/events";
import {
  parseCategories,
  serializeCategories,
  validateCategories,
} from "@/lib/memory-categories";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const scope = searchParams.get("scope");
  const q = searchParams.get("q");
  const category = searchParams.get("category");
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

  /* Categories are a JSON column, so an exact match has to be decided per row
     rather than by the database. Filtering here rather than in the browser
     keeps the response and the on-screen count telling the same story. */
  const wanted = category?.trim().toLowerCase();
  if (wanted) {
    memories = memories.filter((m) => parseCategories(m.categories).includes(wanted));
  }

  return NextResponse.json({ memories });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    /* A memory without a category is rejected outright: the create form asks
       for one, so storing a blank would hide a mistake the user can fix. */
    const check = validateCategories(body.categories, { required: true });
    if (!check.ok) {
      return NextResponse.json({ error: check.error }, { status: 400 });
    }

    if (typeof body.content !== "string" || !body.content.trim()) {
      return NextResponse.json(
        { error: "Content is required" },
        { status: 400 }
      );
    }

    const memory = await prisma.memory.create({
      data: {
        content: body.content,
        importance: body.importance || 0.5,
        source: body.source || "manual",
        scope: body.scope || "GLOBAL",
        categories: serializeCategories(check.categories),
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
      payload: {
        scope: memory.scope,
        importance: memory.importance,
        categories: check.categories,
      },
    });

    return NextResponse.json({ memory }, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to create memory" }, { status: 500 });
  }
}