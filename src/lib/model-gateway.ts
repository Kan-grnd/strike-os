/**
 * Model Gateway — Phase 7
 * Central router for all AI model calls.
 * 
 * Architecture:
 *   Agent → Model Policy → Model Router → Model Gateway → Provider Adapter → Provider
 */

import { ProviderAdapter, ProviderError, ModelCall, ModelResponse, ProviderHealth } from "./providers/base";
import { OpenAIAdapter } from "./providers/openai";
import { AnthropicAdapter } from "./providers/anthropic";
import { OmniRouterAdapter } from "./providers/omniroute";
import prisma from "@/lib/db";

export interface ModelPolicy {
  primary: string;      // model ID
  fallback: string[];   // model IDs in priority order
  routingRules?: Record<string, string>; // taskType -> preferred model
  maxCost?: number;     // per-call budget
  maxLatency?: number;  // ms
  manualOverride?: string; // if set, ignore rules
}

export interface RoutingResult {
  selectedModelId: string;
  providerName: string;
  reason: string;         // why this model was chosen
  fallbackAvailable: boolean;
}

// Singleton adapters (lazy init)
let openai: OpenAIAdapter | null = null;
let anthropic: AnthropicAdapter | null = null;
let omniroute: OmniRouterAdapter | null = null;

function getAdapter(providerName: string): ProviderAdapter {
  switch (providerName.toLowerCase()) {
    case "openai":
      if (!openai) openai = new OpenAIAdapter();
      return openai;
    case "anthropic":
      if (!anthropic) anthropic = new AnthropicAdapter();
      return anthropic;
    case "omniroute":
      if (!omniroute) omniroute = new OmniRouterAdapter();
      return omniroute;
    default:
      // Attempt omni-router for unknown providers
      if (!omniroute) omniroute = new OmniRouterAdapter();
      return omniroute;
  }
}

export class ModelGateway {
  private adapters: Map<string, ProviderAdapter> = new Map();

  constructor() {
    // Pre-register all adapters
    this.adapters.set("openai", new OpenAIAdapter());
    this.adapters.set("anthropic", new AnthropicAdapter());
    this.adapters.set("omniroute", new OmniRouterAdapter());
  }

  // Find best model for agent + task
  async selectModel(
    agentId: string,
    taskType: string = "general",
    requirements?: {
      capabilities?: string[];
      minContextWindow?: number;
      maxCostPerCall?: number;
      preferredProvider?: string;
    }
  ): Promise<RoutingResult> {
    // 1. Load agent's policy
    const agent = await prisma.agent.findUnique({ where: { id: agentId } });
    const policy = agent ? this.parsePolicy(agent) : null;

    // 2. If manual override set, use that
    if (policy?.manualOverride) {
      const model = await prisma.model.findUnique({ where: { id: policy.manualOverride } });
      if (model) {
        return {
          selectedModelId: model.id,
          providerName: (await prisma.provider.findUnique({ where: { id: model.providerId } }))?.name || "unknown",
          reason: "Manual override",
          fallbackAvailable: (policy?.fallback?.length || 0) > 0,
        };
      }
    }

    // 3. Find candidate models
    const allModels = await prisma.model.findMany({ include: { provider: true } });
    let candidates = allModels;

    // Filter by capabilities if specified
    if (requirements?.capabilities?.length) {
      candidates = candidates.filter((m) => {
        try {
          const caps = JSON.parse(m.capabilities) as string[];
          return requirements.capabilities!.some((req) => caps.includes(req));
        } catch {
          return false;
        }
      });
    }

    // Filter by context window
    if (requirements?.minContextWindow) {
      candidates = candidates.filter((m) => m.contextWindow >= (requirements.minContextWindow || 0));
    }

    // Sort by policy rules or default (cheapest capable first)
    if (policy?.routingRules?.[taskType]) {
      const preferredId = policy.routingRules[taskType];
      const preferred = candidates.find((m) => m.id === preferredId);
      if (preferred) {
        return {
          selectedModelId: preferred.id,
          providerName: preferred.provider.name,
          reason: `Routing rule for ${taskType}`,
          fallbackAvailable: (policy?.fallback?.length || 0) > 0,
        };
      }
    }

    // Default: pick cheapest capable model with available adapter
    candidates.sort((a, b) => (a.costPer1KInput || 999) - (b.costPer1KInput || 999));

    for (const model of candidates) {
      const adapter = this.getAdapterForModel(model.provider?.name || model.providerId);
      if (adapter) {
        return {
          selectedModelId: model.id,
          providerName: model.provider?.name || model.providerId,
          reason: "Best match (cost optimized)",
          fallbackAvailable: true,
        };
      }
    }

    throw new Error("No suitable model found for task requirements");
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

  private parsePolicy(agent: any): ModelPolicy | null {
    try {
      return agent.memoryScope ? JSON.parse(agent.memoryScope) : null;
    } catch {
      return null;
    }
  }
}

export const modelGateway = new ModelGateway();