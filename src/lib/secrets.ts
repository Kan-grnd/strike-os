/**
 * Secret Vault — references only, never exposes values to frontend.
 */

import prisma from "@/lib/db";

export async function getSecret(provider: string, reference?: string): Promise<string | null> {
  // Provider names are matched case-insensitively: callers use lower-case ids
  // ("anthropic") while the vault may hold display-cased names ("Anthropic").
  const secret = await prisma.secret.findFirst({
    where: {
      provider: { equals: provider, mode: "insensitive" },
      ...(reference ? { reference } : {}),
    },
  });
  if (!secret) return null;
  // Read from env by reference name
  const envKey = secret.reference;
  return (process.env as any)[envKey] || null;
}