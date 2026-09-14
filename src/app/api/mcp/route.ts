import { NextResponse } from "next/server";
import prisma from "@/lib/db";
import { eventBus } from "@/lib/events";

export const dynamic = "force-dynamic";

export async function GET() {
  const connections = await prisma.mCPConnection.findMany({
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ connections });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const connection = await prisma.mCPConnection.create({
      data: {
        name: body.name,
        baseUrl: body.baseUrl,
        status: body.status || "PENDING",
        tools: JSON.stringify(body.tools || []),
        resources: JSON.stringify(body.resources || []),
        lastPing: body.lastPing ? new Date(body.lastPing) : undefined,
      },
    });

    await eventBus.emit({
      type: "mcp.connected",
      source: "mcp-manager",
      subject: "mcp",
      subjectId: connection.id,
      payload: { name: connection.name },
    });

    return NextResponse.json({ connection }, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Failed to create MCP connection" },
      { status: 500 }
    );
  }
}
