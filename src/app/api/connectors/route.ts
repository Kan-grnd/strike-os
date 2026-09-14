import { NextResponse } from "next/server";
import prisma from "@/lib/db";
import { eventBus } from "@/lib/events";

export const dynamic = "force-dynamic";

export async function GET() {
  const connections = await prisma.connector.findMany({
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ connections });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const connection = await prisma.connector.create({
      data: {
        name: body.name,
        baseUrl: body.baseUrl,
        authType: body.authType || "NONE",
        authConfig: JSON.stringify(body.authConfig || {}),
        status: "PENDING",
        health: JSON.stringify({}),
      },
    });

    await eventBus.emit({
      type: "api.connected",
      source: "connector-manager",
      subject: "connector",
      subjectId: connection.id,
      payload: { name: connection.name },
    });

    return NextResponse.json({ connection }, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to create connection" }, { status: 500 });
  }
}
