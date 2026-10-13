import { NextResponse } from "next/server";
import prisma from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  let db = "unreachable";
  try {
    await prisma.$queryRaw`SELECT 1`;
    db = "ok";
  } catch {
    /* DB down — still answer, but say so honestly. */
  }
  return NextResponse.json({
    status: db === "ok" ? "ok" : "degraded",
    db,
    name: "Strike OS",
    version: "0.1.0",
    time: new Date().toISOString(),
  });
}
