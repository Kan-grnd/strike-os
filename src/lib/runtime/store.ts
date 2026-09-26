"use client";

import { create } from "zustand";
import type {
  CompletionFlash,
  EventRuntime,
  TempEdge,
  WorkforceRuntime,
} from "./types";

export type ConnectionState = "CONNECTED" | "DISCONNECTED" | "RECONNECTING";

const POLL_INTERVAL_MS = 2000;
const SWEEP_INTERVAL_MS = 1000;
const RECENT_EVENTS_CAP = 100;
const PROCESSED_EVENTS_CAP = 400;
const TEMP_EDGE_TTL_MS = 15000;
const FLASH_TTL_MS = 4000;

const TASK_STATUS_BY_EVENT: Record<string, string> = {
  "task.created": "QUEUED",
  "task.assigned": "ASSIGNED",
  "task.started": "RUNNING",
  "task.waiting": "WAITING",
  "task.completed": "COMPLETED",
  "task.failed": "FAILED",
  "task.retried": "QUEUED",
  "task.cancelled": "CANCELLED",
};

const COLONY_STATUS_BY_EVENT: Record<string, string> = {
  "colony.started": "ACTIVE",
  "colony.paused": "PAUSED",
  "colony.resumed": "ACTIVE",
  "colony.stopped": "STOPPED",
  "colony.failed": "FAILED",
  "colony.archived": "ARCHIVED",
};

const BRAIN_STATES = ["operational", "working", "degraded", "critical", "offline"];

const TERMINAL_TASK_EVENTS: Record<string, { label: string; kind: CompletionFlash["kind"] }> = {
  "task.completed": { label: "Completed", kind: "success" },
  "task.failed": { label: "Failed", kind: "error" },
  "task.cancelled": { label: "Cancelled", kind: "info" },
};

const VERIFICATION_REMOVE_EVENTS = new Set([
  "verification.passed",
  "verification.revise",
  "verification.failed",
  "verification.escalated",
]);

let pollTimer: ReturnType<typeof setInterval> | null = null;
let sweepTimer: ReturnType<typeof setInterval> | null = null;

const clearPoll = () => {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
};

const clearSweep = () => {
  if (sweepTimer) {
    clearInterval(sweepTimer);
    sweepTimer = null;
  }
};

const eventTime = (e: EventRuntime): number => {
  if (!e.timestamp) return 0;
  const t = new Date(String(e.timestamp)).getTime();
  return Number.isFinite(t) ? t : 0;
};

const tempEdgeId = (kind: TempEdge["kind"], eventId: string): string => `temp:${kind}:${eventId}`;

interface RuntimeStore {
  runtime: WorkforceRuntime | null;
  connection: ConnectionState;
  cursor: string | null;
  tempEdges: TempEdge[];
  flashes: CompletionFlash[];
  needsResync: boolean;
  processedEventIds: string[];
  stateTimestamps: Record<string, number>;
  initializeWithSnapshot: (runtime: WorkforceRuntime) => void;
  applyEvent: (event: EventRuntime) => void;
  applyEvents: (events: EventRuntime[]) => void;
  setConnection: (connection: ConnectionState) => void;
  subscribeToEvents: () => () => void;
  unsubscribe: () => void;
  resync: () => Promise<void>;
  getVisibleEntities: () => WorkforceRuntime | null;
}

export const useRuntimeStore = create<RuntimeStore>((set, get) => ({
  runtime: null,
  connection: "RECONNECTING",
  cursor: null,
  tempEdges: [],
  flashes: [],
  needsResync: false,
  processedEventIds: [],
  stateTimestamps: {},

  initializeWithSnapshot: (runtime) => {
    const stamped = String(runtime.generatedAt);
    const cursor = stamped !== "Invalid Date" && stamped ? stamped : null;
    const processedEventIds = Array.from(
      new Set([
        ...get().processedEventIds,
        ...runtime.recentEvents.map((e) => e.id),
      ])
    ).slice(-PROCESSED_EVENTS_CAP);
    set({ runtime, cursor, connection: "CONNECTED", needsResync: false, processedEventIds });
  },

  applyEvent: (event) => get().applyEvents([event]),

  applyEvents: (events) => {
    const s = get();
    if (!s.runtime || events.length === 0) return;

    const now = Date.now();
    let runtime = s.runtime;
    let tempEdges = s.tempEdges;
    let flashes = s.flashes;
    const processed = new Set(s.processedEventIds);
    const stateTs = { ...s.stateTimestamps };

    const sorted = [...events].sort((a, b) => eventTime(a) - eventTime(b));

    for (const ev of sorted) {
      if (processed.has(ev.id)) continue;
      const ts = eventTime(ev);

      // Stale-event guard: an event that is older than the newest event we
      // already applied for the same entity must not overwrite newer state.
      const guardKey =
        (ev.agentId && `agent:${ev.agentId}`) || (ev.taskId && `task:${ev.taskId}`);
      if (guardKey) {
        const last = stateTs[guardKey];
        if (ts && last && ts < last) continue;
        if (ts) stateTs[guardKey] = ts;
      }

      processed.add(ev.id);

      let agents = runtime.agents;
      if (ev.agentId) {
        const idx = agents.findIndex((a) => a.id === ev.agentId);
        if (idx !== -1) {
          const to = ev.payload?.to;
          const next = { ...agents[idx] };
          if (typeof to === "string" && to.length > 0) next.runtimeState = to as never;
          if (ev.taskId) next.currentTaskId = ev.taskId;
          if (ts) next.lastActiveAt = new Date(ts);
          agents = agents.map((a, i) => (i === idx ? next : a));
        }
      }

      let tasks = runtime.tasks;
      let colonies = runtime.colonies;

      const taskStatus = TASK_STATUS_BY_EVENT[ev.type];
      if (ev.taskId && taskStatus) {
        const idx = tasks.findIndex((t) => t.id === ev.taskId);
        if (idx !== -1) {
          const current = tasks[idx];
          const completed =
            taskStatus === "COMPLETED" || taskStatus === "CANCELLED";
          tasks = tasks.map((t, i) =>
            i === idx
              ? {
                  ...t,
                  status: taskStatus,
                  timestamps: {
                    ...t.timestamps,
                    completedAt: completed ? new Date(ts || now) : t.timestamps.completedAt,
                  },
                }
              : t
          );
          if (completed && current.ownerAgentId) {
            const term = TERMINAL_TASK_EVENTS[ev.type];
            if (term) {
              flashes = [
                ...flashes,
                {
                  id: `flash:${ev.id}`,
                  entityId: current.ownerAgentId,
                  label: term.label,
                  kind: term.kind,
                  occurredAt: now,
                },
              ];
            }
          }
        } else if (taskStatus === "COMPLETED" || taskStatus === "CANCELLED") {
          // Operation left the live set (completed before we ever saw it here).
        }
      }

      const colonyStatus = COLONY_STATUS_BY_EVENT[ev.type];
      if (ev.subject === "colony" && ev.subjectId && colonyStatus) {
        const idx = colonies.findIndex((c) => c.id === ev.subjectId);
        if (idx !== -1) {
          colonies = colonies.map((c, i) => (i === idx ? { ...c, status: colonyStatus } : c));
        }
      }

      // ── Brain state (payload override; snapshot re-derives on resync) ──
      if (ev.type === "brain.state.changed") {
        const to = ev.payload?.to;
        if (typeof to === "string" && BRAIN_STATES.includes(to as never)) {
          runtime = { ...runtime, brain: { ...runtime.brain, state: to as never } };
        }
      }

      // ── Transient relationships (delegation / communication / verification) ──
      const payload = ev.payload ?? {};

      if (ev.type === "delegation.started") {
        const from = (payload.from as string) || ev.agentId || ev.subjectId;
        const target = (payload.to as string) || ev.taskId || (payload.target as string);
        if (from && target && from !== target) {
          const n: TempEdge = {
            id: tempEdgeId("delegation", ev.id),
            kind: "delegation",
            source: from,
            target,
            taskId: ev.taskId,
            eventId: ev.id,
            label: (payload.label as string) ?? "Delegated",
            occurredAt: now,
          };
          tempEdges = [n, ...tempEdges.filter((e) => e.id !== n.id)];
        }
      }
      if (ev.type === "delegation.completed") {
        tempEdges = tempEdges.filter(
          (e) =>
            e.kind !== "delegation" ||
            (ev.taskId ? e.taskId !== ev.taskId : e.eventId !== ev.id)
        );
      }

      if (ev.type === "communication.started") {
        const from = (payload.from as string) || ev.agentId;
        const target = (payload.to as string);
        if (from && target && from !== target) {
          const n: TempEdge = {
            id: tempEdgeId("communication", ev.id),
            kind: "communication",
            source: from,
            target,
            taskId: ev.taskId,
            eventId: ev.id,
            label: (payload.label as string) ?? "Communicating",
            occurredAt: now,
          };
          tempEdges = [n, ...tempEdges.filter((e) => e.id !== n.id)];
        }
      }
      if (ev.type === "communication.completed") {
        tempEdges = tempEdges.filter(
          (e) => e.kind !== "communication" || e.eventId !== ev.id
        );
      }

      if (ev.type === "verification.started") {
        const worker = (payload.from as string) || ev.agentId || ev.subjectId;
        const target = ev.taskId || (payload.to as string) || (payload.task as string);
        if (worker && target) {
          const n: TempEdge = {
            id: tempEdgeId("verification", ev.id),
            kind: "verification",
            source: worker,
            target,
            taskId: ev.taskId,
            eventId: ev.id,
            label: (payload.label as string) ?? "Verifying",
            occurredAt: now,
          };
          tempEdges = [n, ...tempEdges.filter((e) => e.id !== n.id)];
        }
      }
      if (VERIFICATION_REMOVE_EVENTS.has(ev.type)) {
        tempEdges = tempEdges.filter(
          (e) =>
            e.kind !== "verification" ||
            (ev.taskId ? e.taskId !== ev.taskId : e.eventId !== ev.id)
        );
      }

      const recentEvents = [
        ev,
        ...runtime.recentEvents.filter((e) => e.id !== ev.id),
      ].slice(0, RECENT_EVENTS_CAP);

      runtime = { ...runtime, agents, tasks, colonies, recentEvents };
    }

    const processedEventIds = Array.from(processed).slice(-PROCESSED_EVENTS_CAP);
    set({ runtime, tempEdges, flashes, processedEventIds, stateTimestamps: stateTs });
  },

  setConnection: (connection) => set({ connection }),

  subscribeToEvents: () => {
    clearPoll();
    clearSweep();

    const poll = async () => {
      const wasLive = get().connection !== "DISCONNECTED";
      if (!wasLive) set({ connection: "RECONNECTING" });
      try {
        if (get().needsResync) {
          // Authoritative reconciliation: refetch snapshot, reset cursor, and
          // only then resume the event stream. No stale pretending.
          const snapRes = await fetch("/api/runtime/snapshot", { cache: "no-store" });
          if (!snapRes.ok) throw new Error(`snapshot failed: ${snapRes.status}`);
          const snap = (await snapRes.json()) as { runtime: WorkforceRuntime };
          get().initializeWithSnapshot(snap.runtime);
          set({ connection: "CONNECTED", needsResync: false });
          if ((get().cursor ?? "") === "") return;
        }
        const { cursor } = get();
        const res = await fetch(
          `/api/runtime/events?since=${encodeURIComponent(cursor ?? "")}`
        );
        if (!res.ok) throw new Error(`poll failed: ${res.status}`);
        const data = (await res.json()) as {
          events: EventRuntime[];
          cursor: string | null;
        };
        if (data.events && data.events.length > 0) get().applyEvents(data.events);
        set({ cursor: data.cursor, connection: "CONNECTED" });
      } catch {
        set({ connection: "DISCONNECTED", needsResync: true });
      }
    };

    const sweep = () => {
      const s = get();
      const now = Date.now();
      const tempEdges = s.tempEdges.filter((e) => now - e.occurredAt <= TEMP_EDGE_TTL_MS);
      const flashes = s.flashes.filter((f) => now - f.occurredAt <= FLASH_TTL_MS);
      if (tempEdges.length !== s.tempEdges.length || flashes.length !== s.flashes.length) {
        set({ tempEdges, flashes });
      }
    };

    poll();
    pollTimer = setInterval(poll, POLL_INTERVAL_MS);
    sweepTimer = setInterval(sweep, SWEEP_INTERVAL_MS);
    return () => {
      clearPoll();
      clearSweep();
    };
  },

  unsubscribe: () => {
    clearPoll();
    clearSweep();
  },

  resync: async () => {
    const { setConnection } = get();
    setConnection("RECONNECTING");
    try {
      const res = await fetch("/api/runtime/snapshot", { cache: "no-store" });
      if (!res.ok) throw new Error(`snapshot failed: ${res.status}`);
      const data = (await res.json()) as { runtime: WorkforceRuntime };
      get().initializeWithSnapshot(data.runtime);
    } catch {
      setConnection("DISCONNECTED");
      set({ needsResync: true });
    }
  },

  getVisibleEntities: () => get().runtime,
}));