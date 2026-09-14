import { NextResponse } from "next/server";
import prisma from "@/lib/db";
import { eventBus } from "@/lib/events";

type Params = { id: string };

export async function GET(req: Request, { params }: { params: Params }) {
  try {
    const relationship = await prisma.relationship.findUnique({
      where: { id: params.id },
    });
    if (!relationship) {
      return NextResponse.json({ error: "Relationship not found" }, { status: 404 });
    }
    return NextResponse.json({ relationship });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to fetch relationship" }, { status: 500 });
  }
}

export async function PATCH(req: Request, { params }: { params: Params }) {
  try {
    const body = await req.json();
    const relationship = await prisma.relationship.update({
      where: { id: params.id },
      data: {
        ...(body.fromId ? { fromId: body.fromId } : {}),
        ...(body.fromType ? { fromType: body.fromType } : {}),
        ...(body.relation ? { relation: body.relation } : {}),
        ...(body.toId ? { toId: body.toId } : {}),
        ...(body.toType ? { toType: body.toType } : {}),
        ...(body.metadata ? { metadata: JSON.stringify(body.metadata) } : {}),
      },
    });
    return NextResponse.json({ relationship });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to update relationship" }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: Params }) {
  try {
    await prisma.relationship.delete({ where: { id: params.id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to delete relationship" }, { status: 500 });
  }
}