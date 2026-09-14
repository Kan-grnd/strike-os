import { NextResponse } from "next/server";
import { parseNaturalLanguage } from "@/lib/automation-parser";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { goal } = body;

    if (!goal) {
      return NextResponse.json({ error: "Goal required" }, { status: 400 });
    }

    const parsed = parseNaturalLanguage(goal);

    // Build plan steps for simulation
    const planSteps = parsed.actions.map((a, i) => ({
      step: i + 1,
      action: a.type,
      description: a.config?.goal || a.type,
      agentType: a.type === "create_mission" ? "SPECIALIST" : "WORKER",
      estimatedDuration: 15000,
      estimatedCost: 0.002,
    }));

    const totalCost = planSteps.reduce((s, x) => s + x.estimatedCost, 0);
    const totalDuration = planSteps.reduce((s, x) => s + x.estimatedDuration, 0);

    return NextResponse.json({
      name: parsed.name,
      trigger: parsed.trigger,
      conditions: parsed.conditions,
      actions: parsed.actions,
      planSteps,
      totalCost,
      totalDuration,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to simulate" }, { status: 500 });
  }
}