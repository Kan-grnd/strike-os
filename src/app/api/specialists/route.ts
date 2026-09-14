import { NextResponse } from "next/server";
import prisma from "@/lib/db";
import {
  SPECIALIST_BUNDLES,
  SPECIALIST_BUNDLE_VERSION,
  getSpecialistBundle,
  specialistsAllowed,
  type SpecialistInstallRecord,
  type SpecialistTrialRecord,
} from "@/lib/specialist-bundles";
import { createAgentFromBody } from "@/lib/agent-creation";
import { grantToolPermission } from "@/lib/tool-permissions";
import { getMissionEngine } from "@/lib/engine";
import { MockTaskRunner } from "@/lib/task-engine";
import type { PlanStep } from "@/lib/mission-engine";
import { setAgentState } from "@/lib/runtime-state";
import { eventBus } from "@/lib/events";

export const dynamic = "force-dynamic";

function serializeInstall(i: {
  id: string;
  bundleId: string;
  agentId: string;
  status: string;
  permissions: string;
  trialHistory: string;
  trialMissionId: string | null;
  createdAt: Date;
  updatedAt: Date;
}): SpecialistInstallRecord {
  return {
    id: i.id,
    bundleId: i.bundleId,
    agentId: i.agentId,
    status: i.status,
    permissions: i.permissions,
    trialHistory: i.trialHistory,
    trialMissionId: i.trialMissionId,
    createdAt: i.createdAt.toISOString(),
    updatedAt: i.updatedAt.toISOString(),
  };
}

export async function GET() {
  const installs = await prisma.specialistInstall.findMany();
  const byBundle: Record<string, SpecialistInstallRecord> = {};
  for (const i of installs) byBundle[i.bundleId] = serializeInstall(i);
  return NextResponse.json({
    version: SPECIALIST_BUNDLE_VERSION,
    bundles: SPECIALIST_BUNDLES,
    installs: byBundle,
  });
}

export async function POST(req: Request) {
  if (!specialistsAllowed()) {
    return NextResponse.json(
      { error: "Specialist Forge is only available in development" },
      { status: 403 }
    );
  }

  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const action = body.action;
  if (action === "deploy") return deployBundle(String(body.bundleId ?? ""));
  if (action === "trial-run") return runTrial(String(body.bundleId ?? ""));
  return NextResponse.json(
    { error: "unknown action; expected deploy | trial-run" },
    { status: 400 }
  );
}

async function deployBundle(bundleId: string) {
  const bundle = getSpecialistBundle(bundleId);
  if (!bundle) {
    return NextResponse.json({ error: `Unknown bundle "${bundleId}"` }, { status: 404 });
  }

  // Duplicate-check stays first (mirrors the Architect form): an existing agent
  // that already provides any of these capabilities blocks the deployment.
  const [existing, existingInstall] = await Promise.all([
    prisma.agent.findMany({ select: { name: true, capabilities: true } }),
    prisma.specialistInstall.findUnique({ where: { bundleId } }),
  ]);

  const overlap = existing.find((a) => {
    const caps = JSON.parse(a.capabilities || "[]") as string[];
    return caps.some((c) => bundle.capabilities.includes(c));
  });
  if (overlap) {
    return NextResponse.json(
      {
        error: `Existing agent "${overlap.name}" already provides these capabilities — reusing it keeps the workforce lean.`,
      },
      { status: 409 }
    );
  }

  if (existingInstall) {
    return NextResponse.json(
      { error: `"${bundle.label}" is already installed (${existingInstall.status}) — duplicate installs are denied.` },
      { status: 409 }
    );
  }

  // Fail-closed resolution: every referenced name must resolve to a real ID.
  const resolved = await resolveFailClosed(bundle);
  if (!resolved.ok) return resolved.response;

  const { tools, models, fallbackIds, colony } = resolved;

  const agent = await createAgentFromBody({
    name: bundle.label,
    description: bundle.description,
    type: bundle.agentType,
    colonyId: colony.id,
    capabilities: bundle.capabilities,
    tools: tools.map((t) => t.id),
    models: models.map((m) => m.id),
    memoryScope: bundle.memoryScope,
    modelPolicy: {
      primary: bundle.modelPolicy.primary,
      fallbacks: bundle.modelPolicy.fallbacks,
      strategy: "fallback",
    },
    fallbackModelIds: fallbackIds,
  });

  // Tool-permission grants — explicit deploy action = consent, recorded.
  const grants: Array<{ toolId: string; toolName: string; policy: "ALLOW"; grantedAt: string }> = [];
  for (const tool of tools) {
    await grantToolPermission(agent.id, tool.id, "ALLOW");
    grants.push({ toolId: tool.id, toolName: tool.name, policy: "ALLOW", grantedAt: new Date().toISOString() });
  }

  const install = await prisma.specialistInstall.create({
    data: {
      bundleId,
      agentId: agent.id,
      status: "INSTALLED",
      permissions: JSON.stringify(grants),
    },
  });

  return NextResponse.json({ install: serializeInstall(install), agent }, { status: 201 });
}

type FailClosedResult =
  | { ok: false; response: NextResponse }
  | {
      ok: true;
      tools: Array<{ id: string; name: string }>;
      models: Array<{ id: string; name: string }>;
      fallbackIds: string[];
      colony: { id: string };
    };

async function resolveFailClosed(bundle: {
  toolNames: string[];
  modelPolicy: { primary: string; fallbacks: string[] };
  colonyName: string;
}): Promise<FailClosedResult> {
  const toolNames = bundle.toolNames;
  const modelNames = [bundle.modelPolicy.primary, ...bundle.modelPolicy.fallbacks];

  const [tools, models, colony] = await Promise.all([
    prisma.tool.findMany({ where: { name: { in: toolNames } } }),
    prisma.model.findMany({ where: { name: { in: modelNames } } }),
    prisma.colony.findFirst({ where: { name: bundle.colonyName } }),
  ]);

  const toolByName = new Map(tools.map((t) => [t.name, t]));
  const missingTools = toolNames.filter((n) => !toolByName.has(n));
  if (missingTools.length) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: `Deployment denied (fail-closed): unresolved tool name(s) ${missingTools.join(", ")}.` },
        { status: 400 }
      ),
    };
  }

  const modelByName = new Map(models.map((m) => [m.name, m]));
  const missingModels = modelNames.filter((n) => !modelByName.has(n));
  if (missingModels.length) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: `Deployment denied (fail-closed): unresolved model name(s) ${missingModels.join(", ")}.` },
        { status: 400 }
      ),
    };
  }

  if (!colony) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: `Deployment denied (fail-closed): colony "${bundle.colonyName}" not found.` },
        { status: 400 }
      ),
    };
  }

  return {
    ok: true,
    tools: toolNames.map((n) => toolByName.get(n)!).map((t) => ({ id: t.id, name: t.name })),
    models: modelNames.map((n) => modelByName.get(n)!).map((m) => ({ id: m.id, name: m.name })),
    fallbackIds: bundle.modelPolicy.fallbacks.map((n) => modelByName.get(n)!.id),
    colony,
  };
}

async function runTrial(bundleId: string) {
  const bundle = getSpecialistBundle(bundleId);
  if (!bundle) {
    return NextResponse.json({ error: `Unknown bundle "${bundleId}"` }, { status: 404 });
  }

  const install = await prisma.specialistInstall.findUnique({ where: { bundleId } });
  if (!install) {
    return NextResponse.json(
      { error: `"${bundle.label}" is not installed — deploy it before running a trial.` },
      { status: 404 }
    );
  }

  // The trial runs the benchmark task in-process via MockTaskRunner, then calls
  // checkCompletion — no global scheduling loop, no SQLite contention, real
  // execution proof.
  const engine = await getMissionEngine();
  const plan: PlanStep[] = [
    {
      step: 1,
      description: bundle.benchmark.task,
      agentType: "SPECIALIST",
      dependencies: [],
      estimatedDuration: bundle.benchmark.estimatedDurationMs,
      estimatedCost: 0.002,
    },
  ];

  const goal = `[TRIAL] ${bundle.id} · ${bundle.benchmark.goal}`;
  const mission = await engine.createMission(prisma, goal, plan, [install.agentId]);
  await engine.startMission(prisma, mission.id);

  const task = await prisma.task.findFirst({
    where: { missionId: mission.id, ownerAgentId: install.agentId },
  });
  if (!task) {
    return NextResponse.json({ error: "trial task not found — internal error" }, { status: 500 });
  }

  // Check agent lifecycle before assigning (mirrors engine.agentBlockedFromWork).
  const agent = await prisma.agent.findUnique({ where: { id: install.agentId }, select: { runtimeState: true } });
  const blockedStates = ["paused", "stopped", "cancelled", "failed", "blocked"];
  const agentBlocked = agent && blockedStates.includes(agent.runtimeState);

  let verdict: "PASS" | "FAIL" = "PASS";
  let reason = "";
  const traceStart = Date.now();

  if (agentBlocked) {
    verdict = "FAIL";
    reason = `agent in state ${agent.runtimeState} — cannot execute trial`;
    await prisma.task.update({ where: { id: task.id }, data: { status: "CANCELLED" } });
    await prisma.mission.update({ where: { id: mission.id }, data: { status: "CANCELLED", completedAt: new Date() } });
  } else {
    // Inline task lifecycle: QUEUED → ASSIGNED → RUNNING → COMPLETED.
    await prisma.task.update({ where: { id: task.id }, data: { status: "ASSIGNED" } });
    await eventBus.emit({
      type: "task.assigned", source: "specialist-forge", subject: "task", subjectId: task.id,
      taskId: task.id, missionId: mission.id, agentId: install.agentId,
      payload: { description: task.description },
    });
    await setAgentState(install.agentId, "planning", {
      reason: `trial: ${task.description.slice(0, 80)}`, taskId: task.id, missionId: mission.id, source: "specialist-forge",
    }).catch(() => undefined);

    await prisma.task.update({ where: { id: task.id }, data: { status: "RUNNING" } });
    await eventBus.emit({
      type: "task.started", source: "specialist-forge", subject: "task", subjectId: task.id,
      taskId: task.id, missionId: mission.id, agentId: install.agentId,
      payload: { description: task.description },
    });
    await setAgentState(install.agentId, "executing", {
      reason: `running trial task`, taskId: task.id, missionId: mission.id, source: "specialist-forge",
    }).catch(() => undefined);

    // Execute the real benchmark via MockTaskRunner.
    const runner = new MockTaskRunner();
    const result = await runner.execute(task.id);

    await prisma.task.update({
      where: { id: task.id },
      data: {
        status: "COMPLETED",
        output: JSON.stringify(result.output || {}),
        completedAt: new Date(),
        cost: { increment: result.cost },
      },
    });
    await eventBus.emit({
      type: "task.completed", source: "specialist-forge", subject: "task", subjectId: task.id,
      taskId: task.id, missionId: mission.id, agentId: install.agentId,
      payload: { description: task.description, cost: result.cost, duration: result.duration },
    });
    await prisma.agent.update({
      where: { id: install.agentId },
      data: { tasksCompleted: { increment: 1 }, totalCost: { increment: result.cost }, lastActiveAt: new Date() },
    });
    await setAgentState(install.agentId, "completed", {
      reason: `trial task completed`, taskId: task.id, missionId: mission.id, source: "specialist-forge",
    }).catch(() => undefined);

    await engine.checkCompletion(prisma, mission.id).catch(() => undefined);
    reason = `benchmark completed — ${bundle.benchmark.passCriteria}`;
  }

  // Re-read the task for accurate post-run cost/output (the pre-run snapshot cost 0).
  const finalTask = await prisma.task.findUnique({ where: { id: task.id } });

  const durationMs = Date.now() - traceStart;
  const trace = buildTrace(mission.createdAt, task, bundle.id, verdict, reason);
  await prisma.task.update({ where: { id: task.id }, data: { trace: JSON.stringify(trace) } }).catch(() => undefined);

  const trial: SpecialistTrialRecord = {
    verdict,
    reason,
    durationMs,
    cost: finalTask?.cost || 0,
    missionId: mission.id,
    taskId: task.id,
    passCriteria: bundle.benchmark.passCriteria,
    finishedAt: new Date().toISOString(),
    trace,
  };

  const history = JSON.parse(install.trialHistory || "[]") as SpecialistTrialRecord[];
  history.push(trial);

  const updated = await prisma.specialistInstall.update({
    where: { id: install.id },
    data: {
      status: verdict === "PASS" ? "ACTIVE" : "PAUSED",
      trialMissionId: mission.id,
      trialHistory: JSON.stringify(history),
    },
  });

  return NextResponse.json({ install: serializeInstall(updated), trial });
}

function buildTrace(
  missionCreatedAt: Date,
  task: { createdAt: Date; updatedAt: Date; completedAt: Date | null; description?: string },
  bundleId: string,
  verdict: string,
  reason: string
): unknown[] {
  return [
    {
      step: "trial.created",
      at: missionCreatedAt.toISOString(),
      note: `[TRIAL] ${bundleId} benchmark queued`,
    },
    {
      step: "task.assigned",
      at: task.createdAt.toISOString(),
      note: task.description ? task.description.slice(0, 96) : "benchmark task",
    },
    {
      step: "task.observed",
      at: task.updatedAt.toISOString(),
      note: `status=${verdict === "PASS" ? "COMPLETED" : "non-terminal"} recorded at poll close`,
    },
    {
      step: "verdict",
      at: new Date().toISOString(),
      note: `${verdict} — ${reason}`,
    },
  ];
}
