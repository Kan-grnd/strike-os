import { NextResponse } from "next/server";
import prisma from "@/lib/db";
import { eventBus } from "@/lib/events";
import {
  setAgentState,
  pauseAgent,
  resumeAgent,
  stopAgent,
  unblockAgent,
  retryAgent,
  deleteAgentWithMode,
  inspectAgentImpact,
  type DeleteAgentMode,
  type AgentRuntimeState,
} from "@/lib/runtime-state";

export const dynamic = "force-dynamic";

type Params = { id: string };

export async function GET(req: Request, { params }: { params: Params }) {
  try {
    const agent = await prisma.agent.findUnique({
      where: { id: params.id },
      include: {
        colony: true,
        parent: true,
        children: true,
      },
    });

    if (!agent) {
      return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    }

    const events = await prisma.event.findMany({
      where: { agentId: agent.id },
      orderBy: { timestamp: "desc" },
      take: 20,
    });

    const currentTask = agent.currentTaskId
      ? await prisma.task.findUnique({ where: { id: agent.currentTaskId } })
      : null;

    const impact = await inspectAgentImpact(params.id);

    return NextResponse.json({ agent, events, currentTask, impact });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to fetch agent" }, { status: 500 });
  }
}

export async function PATCH(req: Request, { params }: { params: Params }) {
  try {
    const body = await req.json();

    const agent = await prisma.agent.findUnique({ where: { id: params.id } });
    if (!agent) return NextResponse.json({ error: "Agent not found" }, { status: 404 });

    // ── Lifecycle actions (DB is source of truth) ─────────────────
    const action = body.action as string | undefined;
    if (action) {
      const reason = (body.reason as string) ?? undefined;
      switch (action) {
        case "pause":
          await pauseAgent(agent.id, { reason, source: "topology" });
          break;
        case "resume":
          await resumeAgent(agent.id, { reason, source: "topology" });
          break;
        case "stop":
          await stopAgent(agent.id, reason);
          break;
        case "block":
          await setAgentState(agent.id, "blocked", {
            reason: reason ?? body.blockedBy ? `blocked by ${body.blockedBy}` : "blocked by operator",
            blockedBy: body.blockedBy ? String(body.blockedBy) : agent.runtimeState,
            taskId: agent.currentTaskId,
            source: "topology",
          });
          break;
        case "unblock":
          await unblockAgent(agent.id, reason);
          break;
        case "retry":
          await retryAgent(agent.id, reason);
          break;
        default:
          return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
      }
      const updated = await prisma.agent.findUnique({ where: { id: agent.id } });
      return NextResponse.json({ agent: updated });
    }

    // ── Runtime state set directly (guarded to valid states) ──────
    if (body.runtimeState) {
      const states: AgentRuntimeState[] = [
        "idle", "initializing", "thinking", "planning", "executing", "delegating",
        "waiting", "waiting_for_approval", "retrying", "blocked", "paused",
        "stopped", "completed", "failed", "cancelled",
      ];
      if (!states.includes(body.runtimeState)) {
        return NextResponse.json({ error: `Invalid runtimeState: ${body.runtimeState}` }, { status: 400 });
      }
      await setAgentState(agent.id, body.runtimeState as AgentRuntimeState, {
        reason: reasonOf(body),
        blockedBy: body.blockedBy !== undefined ? String(body.blockedBy) : undefined,
        taskId: body.taskId !== undefined ? String(body.taskId) : undefined,
        source: "topology",
      });
    }

    // ── Profile updates ────────────────────────────────────────────
    await prisma.agent.update({
      where: { id: agent.id },
      data: {
        ...(body.name ? { name: body.name } : {}),
        ...(body.description !== undefined ? { description: body.description } : {}),
        ...(body.type ? { type: body.type } : {}),
        ...(body.status ? { status: body.status } : {}),
        ...(body.colonyId !== undefined ? { colonyId: body.colonyId } : {}),
        ...(body.capabilities ? { capabilities: JSON.stringify(body.capabilities) } : {}),
        ...(body.tools ? { tools: JSON.stringify(body.tools) } : {}),
        ...(body.models ? { models: JSON.stringify(body.models) } : {}),
        ...(body.permissions ? { permissions: JSON.stringify(body.permissions) } : {}),
        ...(body.memoryScope ? { memoryScope: body.memoryScope } : {}),
      },
    });

    await eventBus.emit({
      type: "agent.updated",
      source: "agent-registry",
      subject: "agent",
      subjectId: agent.id,
      agentId: agent.id,
      payload: { name: body.name ?? agent.name, changes: Object.keys(body) },
    });

    const updated = await prisma.agent.findUnique({ where: { id: agent.id } });
    return NextResponse.json({ agent: updated });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to update agent" }, { status: 500 });
  }
}

function reasonOf(body: Record<string, unknown>): string | undefined {
  return typeof body.stateReason === "string" ? body.stateReason : typeof body.reason === "string" ? body.reason : undefined;
}

export async function DELETE(req: Request, { params }: { params: Params }) {
  try {
    const url = new URL(req.url);
    const mode = (url.searchParams.get("mode") ?? "STOP_AND_REMOVE") as DeleteAgentMode;
    const targetAgentId = url.searchParams.get("targetAgentId") ?? undefined;

    const result = await deleteAgentWithMode(params.id, mode, { targetAgentId, reason: "removed from topology" });
    return NextResponse.json(result);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to delete agent" }, { status: 500 });
  }
}
