/**
 * Next.js instrumentation — start task engine when server boots.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startEngine } = await import("@/lib/engine");
    startEngine();
  }
}