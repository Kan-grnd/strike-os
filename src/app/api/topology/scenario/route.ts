import { NextResponse } from "next/server";
import prisma from "@/lib/db";
import { eventBus } from "@/lib/events";
import {
  setAgentState,
  pauseColonyWithScope,
  spawnAgent,
  setColonyState,
} from "@/lib/runtime-state";


/**
 * SIMULATE (dev) mode scenario engine.
 * Every scenario is a REAL sequence of DB mutations — present state changes
 * are handled by the same runtime-state machinery as production. The RUN
 * badge is the only thing special; a reset wipes scenario residue.
 */

const SCENARIOS = [
  "normal",
  "agent_failure",
  "dependency_failure",
  "colony_pause",
  "agent_spawning",
  "tool_failure",
  "parallel_execution",
  "human_approval",
  "cascading_failure",
  "recovery",
  "large_workforce",
] as const;

async function agentByName(name: string) {
  return prisma.agent.findFirst({ where: { name: { contains: name } } });
}

function pickAgent(agents: { id: string; runtimeState: string; name: string }[]): { id: string; runtimeState: string; name: string }[] {
  return agents.filter((a) => ["executing", "running", "idle", "planning"].includes(a.runtimeState)).slice(0, 1);
}

async function setFixtureAgent(id: string, state: string, reason?: string, blockedBy?: string) {
  await setAgentState(id, state as never, { reason, blockedBy, source: "simulate" });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const scenario = String(body?.scenario ?? "normal");
    if (!(SCENARIOS as readonly string[]).includes(scenario)) {
      return NextResponse.json({ error: `Unknown scenario: ${scenario}` }, { status: 400 });
    }

    const agents = await prisma.agent.findMany({ select: { id: true, name: true, runtimeState: true, type: true, colonyId: true } });
    const colony = await prisma.colony.findFirst();
    const tools = await prisma.tool.findMany({ select: { id: true, name: true, health: true } });

    const trace: Record<string, unknown> = {};
    let messages: string[] = [];

    switch (scenario) {
      case "normal": {
        messages.push("No interference. Watch the natural execution flow.");
        break;
      }

      case "agent_failure": {
        const target = agents.find((a) => a.type === "WORKER") ?? agents[0];
        if (target) {
          const task = await prisma.task.findFirst({
            where: { ownerAgentId: target.id, status: { in: ["QUEUED", "ASSIGNED", "RUNNING"] } },
          });
          if (task) {
            await prisma.task.update({ where: { id: task.id }, data: { status: "FAILED", retryCount: 1 } });
            await eventBus.emit({ type: "task.failed", source: "simulate", subject: "task", subjectId: task.id, taskId: task.id, agentId: target.id, missionId: task.missionId, payload: { reason: "simulated provider outage" } });
          }
          await setFixtureAgent(target.id, "failed", "simulated runtime failure");
          trace.agent = target.name;
          messages.push(`Forced failure on ${target.name}.`);
        }
        break;
      }

      case "dependency_failure": {
        const failing = await prisma.task.findFirst({ where: { status: "QUEUED" } });
        const dependent = await prisma.task.findFirst({
          where: { dependencies: { not: "[]" }, status: { in: ["QUEUED", "WAITING"] } },
        });
        if (dependent && failing) {
          await prisma.task.update({ where: { id: failing.id }, data: { status: "FAILED", retryCount: 0 } });
          const failOwner = await prisma.task.findUnique({
            where: { id: failing.id },
            select: { ownerAgentId: true },
          });
          const depOwners = await prisma.task.findUnique({
            where: { id: dependent.id },
            select: { ownerAgentId: true },
          });
          if (depOwners?.ownerAgentId) {
            const cause = failOwner?.ownerAgentId ? `agent:${failOwner.ownerAgentId}` : undefined;
            await setFixtureAgent(depOwners.ownerAgentId, "blocked", "dependency failed", cause);
          }
          messages.push("A task upstream failed; dependents are now blocked.");
        } else {
          messages.push("No dependency chain found to fail.");
        }
        break;
      }

      case "colony_pause": {
        if (colony) {
          await pauseColonyWithScope(colony.id, "PAUSE_ALL", "simulated colony pause");
          trace.colony = colony.name;
          messages.push(`Paused ${colony.name}.`);
        }
        break;
      }

      case "agent_spawning": {
        const spawns = ["Indexer", "Auditor", "Relayer", "Validator", "Summarizer"];
        const parent = agents.find((a) => a.type === "ARCHITECT") ?? agents[0];
        const created: string[] = [];
        for (const name of spawns.slice(0, 3)) {
          const r = await spawnAgent({ name, type: "WORKER", parentId: parent.id, colonyId: parent.colonyId ?? undefined, source: "simulate" });
          if (r) created.push(name);
        }
        messages.push(`Spawned: ${created.join(", ")}`);
        break;
      }

      case "tool_failure": {
        const tool = tools[0];
        if (tool) {
          await prisma.tool.update({ where: { id: tool.id }, data: { health: "degraded" } });
          await eventBus.emit({ type: "tool.failed", source: "simulate", subject: "tool", subjectId: tool.id, payload: { name: tool.name, reason: "simulated outage" } });
          trace.tool = tool.name;
          const toolUsers = await prisma.agent.findMany({ where: { tools: { contains: tool.id } }, select: { id: true } });
          for (const u of toolUsers.slice(0, 2)) await setFixtureAgent(u.id, "blocked", `tool ${tool.name} degraded`, `tool:${tool.id}`);
          messages.push(`Tool ${tool.name} is degraded; its users are blocked.`);
        }
        break;
      }

      case "parallel_execution": {
        const candidates = agents.filter((a) => a.type !== "ARCHITECT" && a.type !== "PLANNER" && a.runtimeState === "idle" || a.runtimeState === "executing").slice(0, 4);
        for (const a of candidates) await setFixtureAgent(a.id, "executing", "parallel work item");
        const mission = await prisma.mission.create({
          data: { goal: "SIMULATE: parallel workload across four agents", status: "RUNNING", plan: "{}", agentIds: JSON.stringify(candidates.map((c) => c.id)), priority: 5 },
        });
        for (const a of candidates) {
          const task = await prisma.task.create({
            data: { missionId: mission.id, description: `parallel step for ${a.name}`, status: "RUNNING", ownerAgentId: a.id, dependencies: "[]", priority: 5 },
          });
          await eventBus.emit({
            type: "task.assigned",
            source: "simulate",
            subject: "task",
            subjectId: task.id,
            taskId: task.id,
            missionId: task.missionId,
            agentId: a.id,
            payload: { description: task.description },
          });
          await eventBus.emit({
            type: "task.started",
            source: "simulate",
            subject: "task",
            subjectId: task.id,
            taskId: task.id,
            missionId: task.missionId,
            agentId: a.id,
            payload: { description: task.description },
          });
          if (a.runtimeState === "executing") {
            await setAgentState(a.id, "executing", { reason: "parallel task", taskId: task.id, source: "simulate" });
          }
        }
        messages.push("Launched a parallel mission across 4 agents.");
        break;
      }

      case "human_approval": {
        const target = agents.find((a) => a.runtimeState === "executing") ?? agents[0];
        if (target) {
          await setFixtureAgent(target.id, "waiting_for_approval", "human approval required for destructive action");
          trace.agent = target.name;
          messages.push(`${target.name} is waiting for human approval.`);
        }
        break;
      }

      case "cascading_failure": {
        const victims = agents.filter((a) => a.runtimeState === "executing").slice(0, 3);
        for (const v of victims) await setFixtureAgent(v.id, "failed", "propagated failure");
        const others = agents.filter((a) => a.runtimeState === "idle" || a.runtimeState === "planning").slice(0, 4);
        for (const o of others) await setFixtureAgent(o.id, "blocked", "upstream failure ripple");
        messages.push("Cascading failure: 3 agents down, 4 blocked.");
        break;
      }

      case "recovery": {
        for (const a of agents) {
          if (["failed", "blocked", "stopped"].includes(a.runtimeState)) {
            await setAgentState(a.id, "idle", { reason: "recovery sweep", source: "simulate" });
            await eventBus.emit({
              type: "agent.unblocked",
              source: "simulate",
              subject: "agent",
              subjectId: a.id,
              agentId: a.id,
              payload: { reason: "recovery sweep", restored: "idle", was: a.runtimeState },
            });
          }
        }
        await prisma.colony.updateMany({ data: { status: "ACTIVE" } });
        await prisma.tool.updateMany({ data: { health: "healthy" } });
        await prisma.task.updateMany({ where: { status: "FAILED" }, data: { status: "QUEUED", retryCount: 0 } });
        messages.push("Recovery sweep complete — all systems reverted to idle.");
        break;
      }

      case "large_workforce": {
        const names = ["Grid", "Pulse", "Vertex", "Orbit", "Nexus", "Flux", "Helios", "Vega", "Quanta", "Raine", "Astra", "Nova", "Lumen", "Echo", "Zephyr", "Titan", "Rho", "Sigma", "Theta", "Kappa", "Iota", "Epsilon", "Gamma", "Delta", "Beta"];
        const colonyId = colony?.id ?? undefined;
        const created: string[] = [];
        for (const name of names.slice(0, 24)) {
          const r = await spawnAgent({ name, type: "WORKER", colonyId, source: "simulate" });
          if (r) created.push(name);
        }
        messages.push(`Swarm expanded to ${created.length} new workers.`);
        break;
      }
    }

    await eventBus.emit({
      type: "user.notification",
      source: "simulate",
      subject: "scenario",
      payload: { scenario, messages },
    });

    return NextResponse.json({ success: true, scenario, messages, trace });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Scenario failed" }, { status: 500 });
  }
}

export const dynamic = "force-dynamic";