import { NextResponse } from "next/server";
import prisma from "@/lib/db";
import { spawnAgent } from "@/lib/runtime-state";
import { createAgentFromBody } from "@/lib/agent-creation";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const type = searchParams.get("type");
  const colonyId = searchParams.get("colonyId");

  const agents = await prisma.agent.findMany({
    where: {
      ...(status ? { status: status as never } : {}),
      ...(type ? { type: type as never } : {}),
      ...(colonyId ? { colonyId } : {}),
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ agents });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    // Spawn via lifecycle service (initializing → idle, preserves parent lineage)
    if (body.spawn === true || body.action === "spawn") {
      const result = await spawnAgent({
        name: body.name,
        description: body.description,
        type: body.type,
        colonyId: body.colonyId,
        parentId: body.parentId,
        capabilities: body.capabilities,
        tools: body.tools,
        models: body.models,
        memoryScope: body.memoryScope,
        source: "topology",
      });
      if (!result) return NextResponse.json({ error: "name is required" }, { status: 400 });
      const agent = await prisma.agent.findUnique({ where: { id: result.id } });
      return NextResponse.json({ agent }, { status: 201 });
    }

    const agent = await createAgentFromBody(body);
    return NextResponse.json({ agent }, { status: 201 });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Failed to create agent" },
      { status: 500 }
    );
  }
}