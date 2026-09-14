import { NextResponse } from "next/server";
import prisma from "@/lib/db";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const range = searchParams.get("range") || "7d";
    const groupBy = searchParams.get("groupBy") || "model";
    
    // Aggregate cost from task executions via Traces
    const traces = await prisma.trace.findMany({
      where: { createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    
    // Simple aggregation by dimension
    const costs = traces.reduce((acc: Record<string, number>, t) => {
      const key = groupBy === "model" ? (t.agentId || "unknown") : (t.missionId || "unknown");
      acc[key] = (acc[key] || 0) + (t.cost || 0);
      return acc;
    }, {});
    
    return NextResponse.json({ 
      range,
      groupBy,
      totalCost: traces.reduce((sum, t) => sum + (t.cost || 0), 0),
      dimensions: costs,
      traceCount: traces.length,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to fetch costs" }, { status: 500 });
  }
}