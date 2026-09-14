import { NextResponse } from "next/server";
import prisma from "@/lib/db";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const range = searchParams.get("range") || "7d";
    
    // Fetch traces for performance metrics
    const traces = await prisma.trace.findMany({
      where: { createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    
    const tasks = await prisma.task.findMany({
      where: { createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
    
    // Calculate performance metrics
    const completedTasks = tasks.filter(t => t.status === "COMPLETED");
    const failedTasks = tasks.filter(t => t.status === "FAILED");
    const avgLatency = traces.length > 0 
      ? traces.reduce((sum, t) => sum + (t.duration || 0), 0) / traces.length 
      : 0;
    const errorRate = tasks.length > 0 ? failedTasks.length / tasks.length : 0;
    
    // By model/provider (using agentId as proxy)
    const byAgent = traces.reduce((acc: Record<string, { count: number; totalLatency: number; cost: number }>, t) => {
      const key = t.agentId || "unknown";
      if (!acc[key]) acc[key] = { count: 0, totalLatency: 0, cost: 0 };
      acc[key].count++;
      acc[key].totalLatency += t.duration || 0;
      acc[key].cost += t.cost || 0;
      return acc;
    }, {});
    
    return NextResponse.json({
      range,
      totalTraces: traces.length,
      totalTasks: tasks.length,
      completedTasks: completedTasks.length,
      failedTasks: failedTasks.length,
      avgLatencyMs: Math.round(avgLatency),
      errorRate: Math.round(errorRate * 10000) / 100,
      byAgent: Object.entries(byAgent).map(([agent, m]) => ({
        agent,
        count: m.count,
        avgLatencyMs: Math.round(m.totalLatency / m.count),
        totalCost: Math.round(m.cost * 10000) / 10000,
      })),
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to fetch performance" }, { status: 500 });
  }
}