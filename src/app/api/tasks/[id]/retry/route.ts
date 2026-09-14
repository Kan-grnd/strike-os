import Prisma from "@prisma/client";
import { NextResponse } from "next/server";

type Params = { id: string };

export async function POST(req: Request, { params }: { params: Params }) {
  try {
    const { PrismaClient } = Prisma;
    const db = new PrismaClient({ log: [] });
    const task = await db.task.update({
      where: { id: params.id },
      data: { status: "QUEUED", retryCount: { increment: 1 } },
    });
    await db.$disconnect();
    return NextResponse.json({ ok: true, task });
  } catch {
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
