import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type EventEnvelope = {
  id: string;
  type: string;
  timestamp: string;
  source: string;
  payload?: unknown;
};

export async function GET(req: Request) {
  // SSE endpoint for live event streaming
  // In production, this would maintain a persistent connection with EventEmitter
  // For Phase 12 demo: return recent events with SSE headers
  
  const resHeaders = new Headers();
  resHeaders.set("Content-Type", "text/event-stream");
  resHeaders.set("Cache-Control", "no-cache");
  resHeaders.set("Connection", "keep-alive");

  // Return a single event stream initialization message
  // Real SSE requires a persistent connection managed by the server
  return new NextResponse("event: connected\ndata: {\"message\":\"Activity stream connected\"}\n\n", {
    headers: resHeaders,
  });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    // Log an observation event
    return NextResponse.json({ ok: true, eventId: `obs-${Date.now()}`, received: body });
  } catch (error) {
    return NextResponse.json({ error: "Invalid event" }, { status: 400 });
  }
}
