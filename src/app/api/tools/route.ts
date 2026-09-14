import { NextResponse } from "next/server";
import prisma from "@/lib/db";
import { eventBus } from "@/lib/events";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const source = searchParams.get("source");
  const health = searchParams.get("health");

  const tools = await prisma.tool.findMany({
    where: {
      ...(source ? { source: source as never } : {}),
      ...(health ? { health } : {}),
    },
    orderBy: { name: "asc" },
  });

  return NextResponse.json({ tools });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const tool = await prisma.tool.create({
      data: {
        name: body.name,
        description: body.description,
        source: body.source || "NATIVE",
        sourceId: body.sourceId,
        inputSchema: JSON.stringify(body.inputSchema || {}),
        outputSchema: JSON.stringify(body.outputSchema || {}),
        permissions: JSON.stringify(body.permissions || []),
        cost: body.cost || 0,
        timeout: body.timeout || 30000,
      },
    });

    await eventBus.emit({
      type: "tool.called",
      source: "tool-fabric",
      subject: "tool",
      subjectId: tool.id,
      payload: { name: tool.name, source: tool.source },
    });

    return NextResponse.json({ tool }, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to create tool" }, { status: 500 });
  }
}
