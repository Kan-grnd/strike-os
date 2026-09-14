import { NextResponse } from "next/server";
import prisma from "@/lib/db";
import { eventBus } from "@/lib/events";

export const dynamic = "force-dynamic";

type Params = { id: string };

export async function GET(req: Request, { params }: { params: Params }) {
  try {
    const connection = await prisma.mCPConnection.findUnique({
      where: { id: params.id },
    });

    if (!connection) {
      return NextResponse.json({ error: "Connection not found" }, { status: 404 });
    }

    return NextResponse.json({ connection });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to fetch connection" }, { status: 500 });
  }
}

export async function PATCH(req: Request, { params }: { params: Params }) {
  try {
    const body = await req.json();

    const connection = await prisma.mCPConnection.update({
      where: { id: params.id },
      data: {
        ...(body.name ? { name: body.name } : {}),
        ...(body.status ? { status: body.status } : {}),
        ...(body.tools ? { tools: JSON.stringify(body.tools) } : {}),
        ...(body.lastPing ? { lastPing: new Date(body.lastPing) } : {}),
      },
    });

    if (body.status === "DISCONNECTED") {
      await eventBus.emit({
        type: "mcp.disconnected",
        source: "mcp-manager",
        subject: "mcp",
        subjectId: connection.id,
        payload: { name: connection.name },
      });
    }

    return NextResponse.json({ connection });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to update connection" }, { status: 500 });
  }
}
