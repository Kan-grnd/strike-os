/**
 * OpenAI Provider Adapter
 * Uses standard OpenAI Chat Completions API format
 */

import { ProviderAdapter, ModelCall, ModelResponse, ProviderHealth, ProviderError } from "./base";
import { getSecret } from "@/lib/secrets";

export class OpenAIAdapter implements ProviderAdapter {
  id = "openai";
  name = "OpenAI";
  private baseUrl = "https://api.openai.com/v1";
  private apiKey: string | null = null;

  private async getApiKey(): Promise<string | null> {
    if (this.apiKey) return this.apiKey;
    try {
      const secret = await getSecret("openai", "OPENAI_API_KEY");
      if (secret) {
        this.apiKey = secret;
        return secret;
      }
    } catch {
      // Secret not found
    }
    // Fallback to env
    return process.env.OPENAI_API_KEY || null;
  }

  async call(request: ModelCall): Promise<ModelResponse> {
    const apiKey = await this.getApiKey();
    if (!apiKey) {
      throw new ProviderError("No OpenAI API key configured", this.name, "auth");
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
        throw new ProviderError(error.error?.message || `OpenAI error: ${res.status}`, this.name, "unknown");
      }

      const data = await res.json();
      const usage = data.usage || { prompt_tokens: 0, completion_tokens: 0 };
      const duration = Date.now() - start;

      // Cost calculation from model pricing in DB
      // This will be enhanced by ModelGateway with actual model pricing
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
    // Rough estimates - will be replaced by gateway with DB pricing
    const pricing: Record<string, { input: number; output: number }> = {
      "gpt-4o": { input: 2.50, output: 10.00 },
      "gpt-4o-mini": { input: 0.15, output: 0.60 },
      "gpt-4-turbo": { input: 10.00, output: 30.00 },
    };
    const p = pricing[model] || { input: 2.50, output: 10.00 };
    return (inputTokens * p.input / 1_000_000) + (outputTokens * p.output / 1_000_000);
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