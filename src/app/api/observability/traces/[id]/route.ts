import { NextResponse } from "next/server";
import prisma from "@/lib/db";

type Params = { id: string };

export async function GET(req: Request, { params }: { params: Params }) {
  try {
    const trace = await prisma.trace.findUnique({
      where: { id: params.id },
    });
    if (!trace) return NextResponse.json({ error: "Trace not found" }, { status: 404 });
    return NextResponse.json({ trace });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to fetch trace" }, { status: 500 });
  }
}