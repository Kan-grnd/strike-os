import { NextResponse } from "next/server";
import prisma from "@/lib/db";

export const dynamic = "force-dynamic";

// GET /api/chat — list conversations with last-message snippet
// POST /api/chat — create a new conversation
export async function GET() {
  const conversations = await prisma.conversation.findMany({
    orderBy: { updatedAt: "desc" },
    include: {
      messages: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { content: true, role: true, createdAt: true },
      },
    },
  });

  const list = conversations.map((c) => ({
    id: c.id,
    title: c.title,
    modelId: c.modelId,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
    lastMessage: c.messages[0] ? c.messages[0].content : null,
    lastRole: c.messages[0] ? c.messages[0].role : null,
  }));

  return NextResponse.json({ conversations: list });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const title = typeof body.title === "string" && body.title.trim() ? body.title.trim() : "New chat";
    const modelId = typeof body.modelId === "string" && body.modelId ? body.modelId : null;

    if (modelId) {
      const model = await prisma.model.findUnique({ where: { id: modelId } });
      if (!model) {
        return NextResponse.json({ error: "model not found" }, { status: 400 });
      }
    }

    const conversation = await prisma.conversation.create({
      data: { title, modelId },
    });

    return NextResponse.json({ conversation }, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "failed to create conversation" }, { status: 500 });
  }
}
