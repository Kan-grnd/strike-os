import { NextResponse } from "next/server";
import prisma from "@/lib/db";
import { resolveModelPolicy } from "@/lib/model-policy";

export const dynamic = "force-dynamic";

/**
 * Routing test — the /routing "Run test" control.
 *
 * Resolves the model an agent would actually be routed to, using the same
 * `resolveModelPolicy` that the runtime uses (agent policy → default). The
 * answer is grounded in the model registry: the resolved model name is looked
 * up so the provider comes from real data, not a guessed label.
 */
export async function POST(req: Request) {
  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    /* empty body is fine */
  }

  const agentId = typeof body.agentId === "string" ? body.agentId : undefined;
  const taskType = typeof body.taskType === "string" ? body.taskType : null;
  const requirements = (body.requirements ?? {}) as { capabilities?: unknown };

  let agentName: string | null = null;
  let agentCaps: string[] = [];

  let policy = resolveModelPolicy({ agent: null });
  if (agentId) {
    const agent = await prisma.agent.findUnique({ where: { id: agentId } });
    if (!agent) {
      return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    }
    agentName = agent.name;
    policy = resolveModelPolicy({ agent });
    try {
      const parsed = JSON.parse(agent.capabilities);
      if (Array.isArray(parsed)) agentCaps = parsed.map(String);
    } catch {
      agentCaps = [];
    }
  }

  const wanted = Array.isArray(requirements.capabilities)
    ? requirements.capabilities.map(String)
    : [];
  const missingCaps = wanted.filter((c) => !agentCaps.includes(c));

  const model = await prisma.model.findFirst({
    where: { name: policy.primary },
    include: { provider: true },
  });

  const reason =
    policy.source === "default"
      ? "No explicit policy on this agent — routed to the default model."
      : `Resolved from the agent's ${policy.source} policy.`;

  const warnings = missingCaps.length
    ? [`Agent does not declare: ${missingCaps.join(", ")}`]
    : [];

  return NextResponse.json({
    selectedModelId: policy.primary,
    providerName: model?.provider?.name ?? "Unknown",
    reason,
    source: policy.source,
    fallback: policy.fallback,
    model: model
      ? { id: model.id, name: model.name, contextWindow: model.contextWindow }
      : null,
    agentName,
    taskType,
    warnings,
  });
}
