import { NextResponse } from "next/server";
import prisma from "@/lib/db";

export async function GET() {
  const endpoints = await prisma.connectorEndpoint.findMany({
    include: { connector: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ endpoints });
}