import { NextResponse } from "next/server";
import prisma from "@/lib/db";

type Params = { id: string };

export async function GET(req: Request, { params }: { params: Params }) {
  try {
    const memory = await prisma.memory.findUnique({
      where: { id: params.id },
      include: {
        agent: true,
        mission: true,
        colony: true,
      },
    });
    if (!memory) return NextResponse.json({ error: "Memory not found" }, { status: 404 });
    return NextResponse.json({ memory });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to fetch memory" }, { status: 500 });
  }
}

export async function PATCH(req: Request, { params }: { params: Params }) {
  try {
    const body = await req.json();
    const memory = await prisma.memory.update({
      where: { id: params.id },
      data: {
        ...(body.content !== undefined ? { content: body.content } : {}),
        ...(body.importance !== undefined ? { importance: body.importance } : {}),
        ...(body.source ? { source: body.source } : {}),
        ...(body.scope ? { scope: body.scope } : {}),
        ...(body.confidence !== undefined ? { confidence: body.confidence } : {}),
        ...(body.expiresAt ? { expiresAt: new Date(body.expiresAt) } : {}),
      },
    });
    return NextResponse.json({ memory });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to update memory" }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: Params }) {
  try {
    await prisma.memory.delete({ where: { id: params.id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to delete memory" }, { status: 500 });
  }
}