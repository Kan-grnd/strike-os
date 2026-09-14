import { NextResponse } from "next/server";
import prisma from "@/lib/db";
import { editTicketsAllowed } from "@/lib/edit-tickets";

export const dynamic = "force-dynamic";

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  if (!editTicketsAllowed()) {
    return NextResponse.json(
      { error: "Edit tickets are only allowed in development" },
      { status: 403 }
    );
  }

  const body = await req.json().catch(() => ({}));
  const status = body?.status;

  if (status !== "OPEN" && status !== "DONE") {
    return NextResponse.json(
      { error: "status must be OPEN or DONE" },
      { status: 400 }
    );
  }

  const ticket = await prisma.editTicket.update({
    where: { id: params.id },
    data: { status },
  });

  return NextResponse.json({ ticket });
}
