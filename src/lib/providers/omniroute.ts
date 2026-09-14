/**
 * OmniRouter Provider Adapter
 * Uses the user's existing OmniRoute setup (OpenAI-compatible)
 */

import { ProviderAdapter, ModelCall, ModelResponse, ProviderHealth, ProviderError } from "./base";
import { getSecret } from "@/lib/secrets";

export class OmniRouterAdapter implements ProviderAdapter {
  id = "omniroute";
  name = "OmniRoute";
  private baseUrl = "http://localhost:20128/v1";
  private apiKey: string | null = null;

  private async getApiKey(): Promise<string | null> {
    if (this.apiKey) return this.apiKey;
    try {
      const secret = await getSecret("omniroute", "OMNIROUTE_API_KEY");
      if (secret) {
        this.apiKey = secret;
        return secret;
      }
    } catch {
      // Secret not found
    }
    return process.env.OMNIROUTE_API_KEY || "sk-a287a8bdb903e8dc-dd3d29-e649dd00";
  }

  async call(request: ModelCall): Promise<ModelResponse> {
    const apiKey = await this.getApiKey();
    if (!apiKey) {
      throw new ProviderError("No OmniRoute API key configured", this.name, "auth");
    }

    const start = Date.now();
    const body = {
      model: request.model,
      messages: request.messages,
      temperature: request.temperature ?? 0.7,
      max_tokens: request.maxTokens,
      tools: request.tools,
      tool_choice: request.toolChoice,
      stream: request.stream || false,
    };

    try {
      const res = await fetch(`${this.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        if (res.status === 401) throw new ProviderError("Invalid API key", this.name, "auth");
        if (res.status === 429) throw new ProviderError("Rate limited", this.name, "rate_limit");
        throw new ProviderError(error.error?.message || `OmniRoute error: ${res.status}`, this.name, "unknown");
      }

      const data = await res.json();
      const usage = data.usage || { prompt_tokens: 0, completion_tokens: 0 };
      const duration = Date.now() - start;

      // Cost estimation - OmniRoute pricing varies
      const cost = this.estimateCost(request.model, usage.prompt_tokens, usage.completion_tokens);

      return {
        content: data.choices[0]?.message?.content || "",
        usage: {
          inputTokens: usage.prompt_tokens,
          outputTokens: usage.completion_tokens,
        },
        cost,
        duration,
        model: request.model,
        provider: this.name,
        toolCalls: data.choices[0]?.message?.tool_calls,
      };
    } catch (err) {
      if (err instanceof ProviderError) throw err;
      if (err instanceof TypeError) throw new ProviderError("Network error", this.name, "unavailable");
      throw new ProviderError((err as Error).message, this.name, "unknown");
    }
  }

  private estimateCost(model: string, inputTokens: number, outputTokens: number): number {
    // OmniRoute uses various models - rough default
    return (inputTokens * 1.00 / 1_000_000) + (outputTokens * 5.00 / 1_000_000);
  }

  async health(): Promise<ProviderHealth> {
    const apiKey = await this.getApiKey();
    if (!apiKey) {
      return { provider: this.name, ok: false, error: "No API key" };
    }

    try {
      const start = Date.now();
      const res = await fetch(`${this.baseUrl}/models`, {
        headers: { "Authorization": `Bearer ${apiKey}` },
      });
      const latency = Date.now() - start;
      return { provider: this.name, ok: res.ok, latency };
    } catch {
      return { provider: this.name, ok: false, error: "Connection failed" };
    }
  }
}