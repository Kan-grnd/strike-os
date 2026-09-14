/**
 * Anthropic Provider Adapter
 * Uses Anthropic Messages API format
 */

import { ProviderAdapter, ModelCall, ModelResponse, ProviderHealth, ProviderError } from "./base";
import { getSecret } from "@/lib/secrets";

export class AnthropicAdapter implements ProviderAdapter {
  id = "anthropic";
  name = "Anthropic";
  private baseUrl = "https://api.anthropic.com/v1";
  private apiKey: string | null = null;

  private async getApiKey(): Promise<string | null> {
    if (this.apiKey) return this.apiKey;
    try {
      const secret = await getSecret("anthropic", "ANTHROPIC_API_KEY");
      if (secret) {
        this.apiKey = secret;
        return secret;
      }
    } catch {
      // Secret not found
    }
    return process.env.ANTHROPIC_API_KEY || null;
  }

  async call(request: ModelCall): Promise<ModelResponse> {
    const apiKey = await this.getApiKey();
    if (!apiKey) {
      throw new ProviderError("No Anthropic API key configured", this.name, "auth");
    }

    const start = Date.now();

    // Convert OpenAI-format messages to Anthropic format
    const systemMessage = request.messages.find((m) => m.role === "system");
    const messages = request.messages
      .filter((m) => m.role !== "system")
      .map((m) => ({ role: m.role, content: m.content }));

    const body = {
      model: request.model,
      system: systemMessage?.content,
      messages,
      max_tokens: request.maxTokens || 4096,
      temperature: request.temperature ?? 0.7,
      tools: request.tools,
      tool_choice: request.toolChoice,
    };

    try {
      const res = await fetch(`${this.baseUrl}/messages`, {
        method: "POST",
        headers: {
          "x-api-key": apiKey,
          "Content-Type": "application/json",
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        if (res.status === 401) throw new ProviderError("Invalid API key", this.name, "auth");
        if (res.status === 429) throw new ProviderError("Rate limited", this.name, "rate_limit");
        throw new ProviderError(error.error?.message || `Anthropic error: ${res.status}`, this.name, "unknown");
      }

      const data = await res.json();
      const usage = data.usage || { input_tokens: 0, output_tokens: 0 };
      const duration = Date.now() - start;

      const cost = this.estimateCost(request.model, usage.input_tokens, usage.output_tokens);

      return {
        content: data.content?.[0]?.text || "",
        usage: {
          inputTokens: usage.input_tokens,
          outputTokens: usage.output_tokens,
        },
        cost,
        duration,
        model: request.model,
        provider: this.name,
        toolCalls: data.content?.filter((c: any) => c.type === "tool_use").map((c: any) => ({
          name: c.name,
          arguments: c.input,
        })),
      };
    } catch (err) {
      if (err instanceof ProviderError) throw err;
      if (err instanceof TypeError) throw new ProviderError("Network error", this.name, "unavailable");
      throw new ProviderError((err as Error).message, this.name, "unknown");
    }
  }

  private estimateCost(model: string, inputTokens: number, outputTokens: number): number {
    const pricing: Record<string, { input: number; output: number }> = {
      "claude-sonnet-4": { input: 3.00, output: 15.00 },
      "claude-haiku-4": { input: 0.25, output: 1.25 },
      "claude-opus-4": { input: 15.00, output: 75.00 },
    };
    const p = pricing[model] || { input: 3.00, output: 15.00 };
    return (inputTokens * p.input / 1_000_000) + (outputTokens * p.output / 1_000_000);
  }

  async health(): Promise<ProviderHealth> {
    const apiKey = await this.getApiKey();
    if (!apiKey) {
      return { provider: this.name, ok: false, error: "No API key" };
    }

    try {
      const start = Date.now();
      const res = await fetch(`${this.baseUrl}/messages`, {
        method: "POST",
        headers: {
          "x-api-key": apiKey,
          "Content-Type": "application/json",
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4",
          messages: [{ role: "user", content: "test" }],
          max_tokens: 1,
        }),
      });
      const latency = Date.now() - start;
      return { provider: this.name, ok: res.ok, latency };
    } catch {
      return { provider: this.name, ok: false, error: "Connection failed" };
    }
  }
}