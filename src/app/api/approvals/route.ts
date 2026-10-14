import { NextResponse } from "next/server";
import prisma from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const status = new URL(req.url).searchParams.get("status") ?? undefined;
  const approvals = await prisma.approval.findMany({
    where: status ? { status } : undefined,
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ approvals });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const approval = await prisma.approval.create({
      data: {
        type: body.type,
        description: body.description,
        policy: body.policy || "ALWAYS_ASK",
        status: "PENDING",
      },
    });

    return NextResponse.json({ approval }, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to create approval" }, { status: 500 });
  }
}
