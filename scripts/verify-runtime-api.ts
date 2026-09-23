import { NextRequest } from "next/server";
import { GET as snapshotGet } from "../src/app/api/runtime/snapshot/route";
import { GET as eventsGet } from "../src/app/api/runtime/events/route";

async function main() {
  const snapRes = await snapshotGet();
  const snap = await snapRes.json();
  const rt = snap.runtime;
  console.log("SNAPSHOT:", snapRes.status, "brain=", rt.brain.state, "agents=", rt.agents.length,
    "colonies=", rt.colonies.length, "ops=", rt.tasks.length);

  const ev1 = await eventsGet(new NextRequest("http://localhost:3000/api/runtime/events"));
  const d1 = await ev1.json();
  console.log("EVENTS(initial):", ev1.status, "count=", d1.events.length, "cursor=", d1.cursor);

  const since = encodeURIComponent(d1.cursor ?? "");
  const ev2 = await eventsGet(new NextRequest(`http://localhost:3000/api/runtime/events?since=${since}`));
  const d2 = await ev2.json();
  console.log("EVENTS(no-new):", ev2.status, "count=", d2.events.length, "cursorStable=", d2.cursor === d1.cursor);

  const ev3 = await eventsGet(new NextRequest("http://localhost:3000/api/runtime/events?since=garbage"));
  const d3 = await ev3.json();
  console.log("EVENTS(bad-since):", ev3.status, "count=", d3.events.length);

  const ev4 = await eventsGet(new NextRequest("http://localhost:3000/api/runtime/events?since=2030-01-01T00:00:00.000Z"));
  const d4 = await ev4.json();
  console.log("EVENTS(future-since):", ev4.status, "count=", d4.events.length, "cursorKept=", d4.cursor === "2030-01-01T00:00:00.000Z");
}
main().catch((e) => { console.error("FATAL", e); process.exit(1); });
