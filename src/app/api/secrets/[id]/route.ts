import { NextResponse } from "next/server";
import prisma from "@/lib/db";
import { eventBus } from "@/lib/events";

export const dynamic = "force-dynamic";

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  try {
    const secret = await prisma.secret.findUnique({ where: { id: params.id } });
    if (!secret) {
      return NextResponse.json({ error: "Secret not found" }, { status: 404 });
    }
    await prisma.secret.delete({ where: { id: params.id } });
    await eventBus.emit({
      type: "secret.deleted",
      source: "settings",
      subject: "secret",
      subjectId: params.id,
      payload: { name: secret.name },
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to delete secret" }, { status: 500 });
  }
}
