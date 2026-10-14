/**
 * Provider configuration detection.
 *
 * A provider is "configured" when a Secret row points at a real environment
 * variable (see getSecret). This is the single source of truth for whether the
 * app can make real model calls or must run in simulated mode.
 */

import { getSecret } from "@/lib/secrets";

export async function hasConfiguredProvider(): Promise<boolean> {
  try {
    const [anthropic, openai, omniroute] = await Promise.all([
      getSecret("anthropic", "ANTHROPIC_API_KEY"),
      getSecret("openai", "OPENAI_API_KEY"),
      getSecret("omniroute", "OMNIROUTE_API_KEY"),
    ]);
    return !!(anthropic || openai || omniroute);
  } catch {
    return false;
  }
}
