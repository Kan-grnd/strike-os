import { NextResponse } from "next/server";
import prisma from "@/lib/db";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 200);
    const level = searchParams.get("level");
    const service = searchParams.get("service");

    const logs = await prisma.log.findMany({
      where: {
        ...(level ? { level } : {}),
        ...(service ? { service } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: limit,
    });

    return NextResponse.json({ logs });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to fetch logs" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const log = await prisma.log.create({
      data: {
        level: body.level || "INFO",
        service: body.service || "unknown",
        message: body.message || "",
        metadata: JSON.stringify(body.metadata || {}),
        correlation: body.correlation,
        traceId: body.traceId,
      },
    });
    return NextResponse.json({ log }, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to create log" }, { status: 500 });
  }
}