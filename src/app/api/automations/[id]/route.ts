import { NextResponse } from "next/server";
import prisma from "@/lib/db";
import { automationState } from "@/lib/automation-state";

export const dynamic = "force-dynamic";

type Params = { id: string };

export async function GET(req: Request, { params }: { params: Params }) {
  try {
    const automation = await prisma.automation.findUnique({
      where: { id: params.id },
      include: {
        runs: { orderBy: { startedAt: "desc" } },
      },
    });

    if (!automation) {
      return NextResponse.json({ error: "Automation not found" }, { status: 404 });
    }

    return NextResponse.json({ automation });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to fetch automation" }, { status: 500 });
  }
}

export async function PATCH(req: Request, { params }: { params: Params }) {
  try {
    const body = await req.json();

    const automation = await prisma.automation.update({
      where: { id: params.id },
      data: {
        ...(body.name ? { name: body.name } : {}),
        ...(body.description !== undefined ? { description: body.description } : {}),
        ...(body.trigger ? { trigger: JSON.stringify(body.trigger) } : {}),
        ...(body.conditions ? { conditions: JSON.stringify(body.conditions) } : {}),
        ...(body.actions ? { actions: JSON.stringify(body.actions) } : {}),
        ...(body.status ? { status: body.status } : {}),
        ...(body.nextRun ? { nextRun: new Date(body.nextRun) } : {}),
      },
    });

    return NextResponse.json({ automation });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to update automation" }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: Params }) {
  try {
    await prisma.automation.delete({ where: { id: params.id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to delete automation" }, { status: 500 });
  }
}
