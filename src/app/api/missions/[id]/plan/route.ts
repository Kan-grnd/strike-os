import prisma from "@/lib/db";
import { getMissionEngine } from "@/lib/engine";
import { NextResponse } from "next/server";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const engine = await getMissionEngine();
    const body = await req.json();

    const mission = await prisma.mission.findUnique({ where: { id: params.id } });
    if (!mission) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const useLlm = body.llm === true;
    const planSteps = await engine.planMission(mission.goal, useLlm);

    await prisma.mission.update({
      where: { id: params.id },
      data: { plan: JSON.stringify(planSteps) },
    });

    return NextResponse.json({ planSteps });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
