import Prisma from "@prisma/client";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const { PrismaClient } = Prisma;
    const db = new PrismaClient({ log: [] });
    const queued = await db.task.findMany({ where: { status: "QUEUED" }, orderBy: { createdAt: "asc" } });
    const assigned = await db.task.findMany({ where: { status: "ASSIGNED" }, orderBy: { createdAt: "asc" } });
    const running = await db.task.findMany({ where: { status: "RUNNING" }, orderBy: { updatedAt: "desc" } });
    await db.$disconnect();
    return NextResponse.json({ queued, assigned, running, counts: { queued: queued.length, assigned: assigned.length, running: running.length } });
  } catch {
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
