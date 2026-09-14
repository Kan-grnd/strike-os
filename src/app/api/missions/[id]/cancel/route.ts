import prisma from "@/lib/db";
import { getMissionEngine } from "@/lib/engine";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const engine = await getMissionEngine();
    await engine.cancelMission(prisma, params.id);
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
