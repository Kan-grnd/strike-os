/**
 * Secret Vault — references only, never exposes values to frontend.
 */

import prisma from "@/lib/db";

export async function getSecret(provider: string, reference?: string): Promise<string | null> {
  const where = { provider, ...(reference ? { reference } : {}) };
  const secret = await prisma.secret.findFirst({ where });
  if (!secret) return null;
  // Read from env by reference name
  const envKey = secret.reference;
  return (process.env as any)[envKey] || null;
}