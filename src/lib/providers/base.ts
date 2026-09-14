/**
 * Provider Adapter Interface — Phase 7
 * 
 * All providers implement this interface. ModelGateway uses it to call any provider uniformly.
 */

export interface ModelCall {
  model: string;
  messages: Array<{ role: "system" | "user" | "assistant"; content: string }>;
  temperature?: number;
  maxTokens?: number;
  tools?: Array<{ name: string; description: string; parameters: any }>;
  toolChoice?: "auto" | "none" | { type: "function"; function: { name: string } };
  stream?: boolean;
}

export interface ModelResponse {
  content: string;
  usage: {
    inputTokens: number;
    outputTokens: number;
  };
  cost: number;
  duration: number; // ms
  model: string;
  provider: string;
  toolCalls?: Array<{ name: string; arguments: any }>;
}

export interface ProviderHealth {
  provider: string;
  ok: boolean;
  latency?: number;
  error?: string;
}

export interface ProviderAdapter {
  id: string;
  name: string;
  call(request: ModelCall): Promise<ModelResponse>;
  health(): Promise<ProviderHealth>;
}

export class ProviderError extends Error {
  constructor(
    message: string,
    public provider: string,
    public code: "auth" | "rate_limit" | "timeout" | "invalid_request" | "unavailable" | "unknown"
  ) {
    super(message);
    this.name = "ProviderError";
  }
}