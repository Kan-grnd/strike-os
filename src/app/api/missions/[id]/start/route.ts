import prisma from "@/lib/db";
import { getMissionEngine } from "@/lib/engine";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// POST /api/missions/[id]/start
export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const engine = await getMissionEngine();
    await engine.startMission(prisma, params.id);
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
