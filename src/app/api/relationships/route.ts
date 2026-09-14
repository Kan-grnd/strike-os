import { NextResponse } from "next/server";
import prisma from "@/lib/db";
import { eventBus } from "@/lib/events";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const relation = searchParams.get("relation");
  const fromType = searchParams.get("fromType");
  const fromId = searchParams.get("fromId");
  const toType = searchParams.get("toType");
  const toId = searchParams.get("toId");

  const relationships = await prisma.relationship.findMany({
    where: {
      ...(relation ? { relation } : {}),
      ...(fromType ? { fromType } : {}),
      ...(fromId ? { fromId } : {}),
      ...(toType ? { toType } : {}),
      ...(toId ? { toId } : {}),
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ relationships });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const relationship = await prisma.relationship.create({
      data: {
        fromId: body.fromId,
        fromType: body.fromType,
        relation: body.relation,
        toId: body.toId,
        toType: body.toType,
        metadata: JSON.stringify(body.metadata || {}),
      },
    });

    return NextResponse.json({ relationship }, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Failed to create relationship" },
      { status: 500 }
    );
  }
}
