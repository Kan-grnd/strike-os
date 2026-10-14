/**
 * Model Gateway — Phase 7
 * Central router for all AI model calls.
 *
 * Architecture:
 *   Agent → Model Policy → Model Router → Model Gateway → Provider Adapter → Provider
 *
 * Policy resolution lives with the caller (see task-runner-real.ts
 * parseModelPolicy) which reads Agent.modelPolicy / Agent.fallbackModelIds.
 */

import { ProviderAdapter, ModelCall, ModelResponse, ProviderHealth } from "./providers/base";
import { OpenAIAdapter } from "./providers/openai";
import { AnthropicAdapter } from "./providers/anthropic";
import { OmniRouterAdapter } from "./providers/omniroute";
import prisma from "@/lib/db";

export class ModelGateway {
  private adapters: Map<string, ProviderAdapter> = new Map();

  constructor() {
    // Pre-register all adapters
    this.adapters.set("openai", new OpenAIAdapter());
    this.adapters.set("anthropic", new AnthropicAdapter());
    this.adapters.set("omniroute", new OmniRouterAdapter());
  }

  // Call with automatic fallback
  async call(request: ModelCall, options?: { primaryModelId: string; fallbackChain?: string[] }): Promise<ModelResponse> {
    if (options?.primaryModelId) {
      const model = await prisma.model.findUnique({ where: { id: options.primaryModelId }, include: { provider: true } });
      if (model) {
        try {
          const adapter = this.getAdapterForModel(model.provider?.name || model.providerId);
          if (!adapter) throw new Error("No adapter for provider");
          return await adapter.call(request);
        } catch (err) {
          // Try fallback chain
          if (options.fallbackChain?.length) {
            for (const fallbackId of options.fallbackChain) {
              try {
                const fbModel = await prisma.model.findUnique({ where: { id: fallbackId }, include: { provider: true } });
                if (fbModel) {
                  const fbAdapter = this.getAdapterForModel(fbModel.provider?.name || fbModel.providerId);
                  if (!fbAdapter) continue;
                  return await fbAdapter.call({ ...request, model: fbModel.name });
                }
              } catch {
                continue;
              }
            }
          }
          throw err;
        }
      }
    }

    // If no model specified, use default (omniroute) for demo
    const adapter = this.getAdapterForModel("omniroute");
    if (!adapter) throw new Error("No default adapter available");
    return await adapter.call({ ...request, model: request.model || "auto/best-coding" });
  }

  private getAdapterForModel(providerNameOrId: string): ProviderAdapter | null {
    const name = (providerNameOrId || "").toLowerCase();
    if (name.includes("anthropic")) return this.adapters.get("anthropic") || null;
    if (name.includes("openai")) return this.adapters.get("openai") || null;
    // Default to omniroute for any unrecognized provider
    return this.adapters.get("omniroute") || null;
  }

  async healthCheck(): Promise<ProviderHealth[]> {
    const results = await Promise.all([
      this.adapters.get("openai")?.health(),
      this.adapters.get("anthropic")?.health(),
      this.adapters.get("omniroute")?.health(),
    ]);
    return results.filter((r): r is ProviderHealth => r !== undefined);
  }
}

export const modelGateway = new ModelGateway();
