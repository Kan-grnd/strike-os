import { NextResponse } from "next/server";
import prisma from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const colonies = await prisma.colony.findMany({
    include: {
      agents: {
        select: {
          id: true,
          name: true,
          type: true,
          status: true,
        },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json({ colonies });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const colony = await prisma.colony.create({
      data: {
        name: body.name,
        description: body.description,
      },
    });

    return NextResponse.json({ colony }, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to create colony" }, { status: 500 });
  }
}
