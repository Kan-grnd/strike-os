"use client";

import * as React from "react";

/* "Streaming" is a client-side read of the polled event feed: the fleet is
 * considered live only while an event landed inside this trailing window.
 * Purely derived from data the page already holds — no extra requests. */
const DEFAULT_WINDOW_MS = 15_000;
const TICK_MS = 5_000;

export interface StreamingState {
  streaming: boolean;
  lastEventAt: Date | null;
}

export function useStreaming(
  events: any[],
  windowMs: number = DEFAULT_WINDOW_MS,
): StreamingState {
  const [now, setNow] = React.useState(() => Date.now());

  React.useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), TICK_MS);
    return () => window.clearInterval(id);
  }, []);

  const lastEventAt = React.useMemo(() => {
    let latest = 0;
    for (const e of events) {
      const t = e?.timestamp ? Date.parse(e.timestamp) : NaN;
      if (Number.isFinite(t) && t > latest) latest = t;
    }
    return latest > 0 ? new Date(latest) : null;
  }, [events]);

  const streaming =
    lastEventAt != null && now - lastEventAt.getTime() <= windowMs;

  return { streaming, lastEventAt };
}
