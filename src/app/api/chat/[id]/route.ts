import { NextResponse } from "next/server";
import prisma from "@/lib/db";

export const dynamic = "force-dynamic";

// GET /api/chat/[id] — return conversation + full message thread
// DELETE /api/chat/[id] — delete conversation (cascades to messages)
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  try {
    const conversation = await prisma.conversation.findUnique({
      where: { id: params.id },
      include: {
        messages: { orderBy: { createdAt: "asc" } },
      },
    });

    if (!conversation) {
      return NextResponse.json({ error: "conversation not found" }, { status: 404 });
    }

    return NextResponse.json({ conversation });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "failed to load conversation" }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  try {
    const existing = await prisma.conversation.findUnique({ where: { id: params.id } });
    if (!existing) {
      return NextResponse.json({ error: "conversation not found" }, { status: 404 });
    }
    await prisma.conversation.delete({ where: { id: params.id } });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "failed to delete conversation" }, { status: 500 });
  }
}
