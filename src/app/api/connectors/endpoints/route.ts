import { NextResponse } from "next/server";
import prisma from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const endpoints = await prisma.connectorEndpoint.findMany({
    include: { connector: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ endpoints });
}
