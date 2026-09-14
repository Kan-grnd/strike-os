import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    status: "running",
    mode: "simulation",
    description: "Mock task engine active with realistic delays",
  });
}
