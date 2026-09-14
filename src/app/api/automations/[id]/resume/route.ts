import { NextResponse } from "next/server";
import prisma from "@/lib/db";
import { automationState } from "@/lib/automation-state";

export const dynamic = "force-dynamic";

type Params = { id: string };

export async function POST(req: Request, { params }: { params: Params }) {
  try {
    await automationState.resume(params.id);
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 400 });
  }
}
