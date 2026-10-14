import prisma from "@/lib/db";
import { getMissionEngine } from "@/lib/engine";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  try {
    const engine = await getMissionEngine();

    const mission = await prisma.mission.findUnique({ where: { id: params.id } });
    if (!mission) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const result = await engine.planMission(mission.goal);

    const plan = {
      steps: result.steps,
      simulated: result.simulated,
      planner: result.planner,
      model: result.model,
      provider: result.provider,
      generatedAt: new Date().toISOString(),
      note: result.note,
    };
    await prisma.mission.update({
      where: { id: params.id },
      data: { plan: JSON.stringify(plan) },
    });

    return NextResponse.json({
      planSteps: result.steps,
      simulated: result.simulated,
      planner: result.planner,
      model: result.model,
      provider: result.provider,
      cost: result.cost,
      durationMs: result.durationMs,
      note: result.note,
    });
  } catch (err: any) {
    // A configured provider that fails must surface — never a silent fallback.
    return NextResponse.json({ error: err?.message || "Planning failed" }, { status: 502 });
  }
}
