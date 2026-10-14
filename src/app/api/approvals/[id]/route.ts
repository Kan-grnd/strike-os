import { NextResponse } from "next/server";
import prisma from "@/lib/db";
import { resolveApproval } from "@/lib/approvals";
import type { ApprovalDecision } from "@/lib/approval-policy";

export const dynamic = "force-dynamic";

type Params = { id: string };

export async function GET(_req: Request, { params }: { params: Params }) {
  const approval = await prisma.approval.findUnique({ where: { id: params.id } });
  if (!approval) {
    return NextResponse.json({ error: "Approval not found" }, { status: 404 });
  }
  return NextResponse.json({ approval });
}

/**
 * Resolve a gate. Body: { decision: "APPROVE" | "DENY", note?: string } (also
 * accepts { action: "approve" | "deny" }). Idempotent — a second resolve
 * returns the existing outcome with `alreadyResolved: true`.
 */
export async function POST(req: Request, { params }: { params: Params }) {
  try {
    const body = await req.json().catch(() => ({}));

    const raw = String(body.decision ?? body.action ?? "").toUpperCase();
    const decision: ApprovalDecision | null =
      raw === "APPROVE" || raw === "APPROVED"
        ? "APPROVE"
        : raw === "DENY" || raw === "DENIED"
          ? "DENY"
          : null;

    if (!decision) {
      return NextResponse.json(
        { error: "decision must be APPROVE or DENY" },
        { status: 400 },
      );
    }

    const existing = await prisma.approval.findUnique({ where: { id: params.id } });
    if (!existing) {
      return NextResponse.json({ error: "Approval not found" }, { status: 404 });
    }

    const { approval, alreadyResolved } = await resolveApproval(prisma, params.id, decision, {
      resolvedBy: typeof body.resolvedBy === "string" ? body.resolvedBy : "operator",
      note: typeof body.note === "string" ? body.note : undefined,
    });

    return NextResponse.json({ approval, alreadyResolved });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to resolve approval" }, { status: 500 });
  }
}
