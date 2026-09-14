import { NextResponse } from "next/server";
import prisma from "@/lib/db";
import { modelGateway } from "@/lib/model-gateway";
import { ProviderError } from "@/lib/providers/base";

// POST /api/chat/[id]/messages — append a user message, call the model
// gateway with the full thread history, persist both sides, return them.
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const method = "chat/messages";
  const log = (...args: unknown[]) => console.log(`[${method}]`, ...args);

  try {
    const body = await req.json().catch(() => null);
    const content = typeof body?.content === "string" ? body.content.trim() : "";
    if (!content) {
      log("rejected empty message", params.id);
      return NextResponse.json({ error: "message content is required" }, { status: 400 });
    }

    const conversation = await prisma.conversation.findUnique({ where: { id: params.id } });
    if (!conversation) {
      return NextResponse.json({ error: "conversation not found" }, { status: 404 });
    }

    let requestedModelId = conversation.modelId;
    if (typeof body?.modelId === "string" && body.modelId) {
      const model = await prisma.model.findUnique({ where: { id: body.modelId } });
      if (!model) {
        return NextResponse.json({ error: "model not found" }, { status: 400 });
      }
      requestedModelId = model.id;
    }

    // User-side persistence (assistant side is only persisted after a reply)
    const userMessage = await prisma.chatMessage.create({
      data: { conversationId: params.id, role: "user", content },
    });

    const history = await prisma.chatMessage.findMany({
      where: { conversationId: params.id },
      orderBy: { createdAt: "asc" },
    });

    type TargetModel = { id: string; name: string; provider: { name: string } };

    let targetModel: TargetModel | null = null;
    if (requestedModelId) {
      const m = await prisma.model.findUnique({
        where: { id: requestedModelId },
        include: { provider: true },
      });
      if (m) targetModel = m as TargetModel;
    }
    if (!targetModel) {
      const list = await prisma.model.findMany({
        include: { provider: true },
        orderBy: { costPer1KInput: "asc" },
      });
      targetModel = list[0] ? (list[0] as TargetModel) : null;
      if (targetModel) {
        log("falling back to cheapest model", targetModel.name);
        requestedModelId = targetModel.id;
      }
    }
    if (!targetModel) {
      log("no models configured");
      return NextResponse.json(
        {
          error: {
            message: "No models are configured. Add a model in Settings first.",
            code: "no_models",
            provider: null,
            noKey: false,
          },
        },
        { status: 400 }
      );
    }

    // Adopt the chosen model on the conversation after a successful round-trip
    const messages = history.map((m) => ({
      role: m.role as "system" | "user" | "assistant",
      content: m.content,
    }));

    let response;
    try {
      response = await modelGateway.call(
        {
          model: targetModel.name,
          messages,
          temperature: 0.7,
          stream: false,
        },
        { primaryModelId: targetModel.id }
      );
    } catch (err) {
      if (err instanceof ProviderError) {
        log("provider error", err.provider, err.code, err.message);
        const noKey = err.code === "auth" && /API key/i.test(err.message);
        return NextResponse.json(
          { error: { message: err.message, code: err.code, provider: err.provider, noKey } },
          { status: noKey ? 502 : 400 }
        );
      }
      log("unknown model error", (err as Error).message);
      return NextResponse.json(
        {
          error: {
            message: (err as Error).message || "Model call failed",
            code: "unknown",
            provider: null,
            noKey: false,
          },
        },
        { status: 500 }
      );
    }

    const assistantMessage = await prisma.chatMessage.create({
      data: {
        conversationId: params.id,
        role: "assistant",
        content: response.content,
        tokens: response.usage ? response.usage.inputTokens + response.usage.outputTokens : null,
        cost: response.cost,
      },
    });

    await prisma.conversation.update({
      where: { id: params.id },
      data: { modelId: targetModel.id, updatedAt: new Date() },
    });

    log("round-trip complete", params.id, response.provider);

    return NextResponse.json({
      user: userMessage,
      assistant: assistantMessage,
      usage: response.usage,
      cost: response.cost,
      model: { id: targetModel.id, name: response.model, provider: response.provider },
    });
  } catch (e: any) {
    log("handler error", e.message);
    return NextResponse.json({ error: e.message || "failed to send message" }, { status: 500 });
  }
}