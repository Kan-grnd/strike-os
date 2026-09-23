import { NextResponse } from "next/server";
import prisma from "@/lib/db";
import {
  computeBrainRuntime,
  computeSystemRuntime,
  mapAgent,
  mapColony,
  mapEvent,
  mapRelationship,
  mapTask,
} from "@/lib/runtime/mappers";
import type { WorkforceRuntime } from "@/lib/runtime/types";

export const dynamic = "force-dynamic";

export async function GET() {
  const [
    agents,
    colonies,
    missions,
    tasks,
    relationships,
    events,
    providerCount,
    modelCount,
    mcpCount,
    memoryCount,
  ] = await Promise.all([
    prisma.agent.findMany(),
    prisma.colony.findMany(),
    prisma.mission.findMany(),
    prisma.task.findMany({
      where: { status: { notIn: ["COMPLETED", "CANCELLED"] } },
      take: 100,
    }),
    prisma.relationship.findMany(),
    prisma.event.findMany({ orderBy: { timestamp: "desc" }, take: 50 }),
    prisma.provider.count(),
    prisma.model.count(),
    prisma.mCPConnection.count(),
    prisma.memory.count(),
  ]);

  const agentRuntimes = agents.map(mapAgent);
  const colonyRuntimes = colonies.map(mapColony);
  const agentIdsByColony = new Map<string, string[]>();
  for (const agent of agents) {
    if (!agent.colonyId) continue;
    const ids = agentIdsByColony.get(agent.colonyId) ?? [];
    ids.push(agent.id);
    agentIdsByColony.set(agent.colonyId, ids);
  }
  for (const colony of colonyRuntimes) {
    colony.agentIds = agentIdsByColony.get(colony.id) ?? [];
  }

  const runtime: WorkforceRuntime = {
    brain: computeBrainRuntime(agentRuntimes, colonyRuntimes, missions, tasks),
    colonies: colonyRuntimes,
    agents: agentRuntimes,
    tasks: tasks.map(mapTask),
    relationships: relationships.map(mapRelationship),
    recentEvents: events.map(mapEvent),
    system: computeSystemRuntime({
      providers: providerCount,
      models: modelCount,
      mcps: mcpCount,
      memories: memoryCount,
    }),
    generatedAt: new Date(),
  };

  return NextResponse.json({ runtime });
}