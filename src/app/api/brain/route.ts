import { NextResponse } from "next/server";
import prisma from "@/lib/db";
import { getBrainState } from "@/lib/brain";

export const dynamic = "force-dynamic";

/**
 * GET /api/brain — the Brain's current activity state plus its recent decisions
 * (the `brain.state.changed` event log).
 */
export async function GET() {
  try {
    const [state, decisions] = await Promise.all([
      getBrainState(),
      prisma.event.findMany({
        where: { type: "brain.state.changed" },
        orderBy: { timestamp: "desc" },
        take: 20,
      }),
    ]);

    return NextResponse.json({
      state: state.state,
      detail: state.detail,
      missionId: state.missionId,
      taskId: state.taskId,
      updatedAt: state.updatedAt,
      decisions: decisions.map((e) => {
        let payload: Record<string, unknown> = {};
        try {
          const parsed = JSON.parse(e.payload || "{}");
          if (parsed && typeof parsed === "object") payload = parsed as Record<string, unknown>;
        } catch {
          payload = {};
        }
        return {
          id: e.id,
          timestamp: e.timestamp,
          state: (payload.state as string) ?? "idle",
          decision: (payload.decision as string) ?? null,
          detail: (payload.detail as string) ?? null,
          missionId: e.missionId,
          taskId: e.taskId,
        };
      }),
    });
  } catch (err) {
    console.error("[api/brain]", err);
    return NextResponse.json(
      {
        error: "brain state unavailable",
        detail: err instanceof Error ? err.message : String(err),
      },
      { status: 503 }
    );
  }
}
