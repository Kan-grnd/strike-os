import { NextResponse } from "next/server";
import prisma from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const providerId = searchParams.get("providerId");
  const capability = searchParams.get("capability");

  const models = await prisma.model.findMany({
    where: {
      ...(providerId ? { providerId } : {}),
    },
    include: {
      provider: true,
    },
    orderBy: { providerId: "asc" },
  });

  // Filter by capability if provided
  let filtered = models;
  if (capability) {
    filtered = models.filter((m) => {
      try {
        const caps = JSON.parse(m.capabilities) as string[];
        return caps.includes(capability);
      } catch {
        return false;
      }
    });
  }

  return NextResponse.json({ models: filtered });
}
