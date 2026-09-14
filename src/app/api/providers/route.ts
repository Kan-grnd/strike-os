import { NextResponse } from "next/server";
import prisma from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const category = searchParams.get("category");

  const providers = await prisma.provider.findMany({
    where: category ? { category: category as never } : undefined,
    include: {
      models: true,
    },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json({ providers });
}
