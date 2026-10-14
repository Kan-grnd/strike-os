"use client";

import { useMemo } from "react";
import { useAgents } from "@/hooks/useAgents";
import { useMissions } from "@/hooks/useMissions";
import { useTasks } from "@/hooks/useTasks";
import { useApprovals } from "@/hooks/useApprovals";
import { useEvents } from "@/hooks/useApi";
import { useStreaming } from "@/components/dashboard/command-center/use-streaming";
import { buildAttentionQueue } from "@/lib/attention";
import { ControlHeader } from "@/components/control-center/control-header";
import { AttentionQueue } from "@/components/control-center/attention-queue";
import { MissionHealth } from "@/components/control-center/mission-health";
import { LiveSummary } from "@/components/control-center/live-summary";

const ACTIVE_MISSION = (status: string) => status !== "COMPLETED" && status !== "CANCELLED";
const AGENT_WORKING = /executing|planning|thinking|delegating|initializing|retrying|running/i;

function isoSince(minutesAgo: number) {
  return new Date(Date.now() - minutesAgo * 60_000).toISOString();
}

export default function ControlCenterPage() {
  const { data: agents, isLoading: agentsLoading, error: agentsError } = useAgents(undefined, { poll: true });
  const { data: missions, isLoading: missionsLoading, error: missionsError } = useMissions({ poll: true });
  const { data: tasks, isLoading: tasksLoading, error: tasksError } = useTasks(undefined, { poll: true });
  const { data: approvals, isLoading: approvalsLoading, error: approvalsError } = useApprovals({ poll: true });
  const { data: events } = useEvents({ since: isoSince(60), limit: "500" });

  const approvalList = approvals?.approvals || [];
  const missionList = missions?.missions || [];
  const agentList = agents?.agents || [];
  const taskList = tasks?.tasks || [];
  const eventList = (events?.events || []) as Array<{ timestamp: string }>;

  const { streaming, lastEventAt } = useStreaming(eventList, 15000);

  const queue = useMemo(
    () => buildAttentionQueue({ approvals: approvalList, missions: missionList }),
    [approvalList, missionList],
  );

  const activeMissions = missionList.filter((m: any) => ACTIVE_MISSION(m.status)).length;
  const activeAgents = agentList.filter((a: any) => AGENT_WORKING.test(a.status || "")).length;
  const runningTasks = taskList.filter((t: any) => (t.status || "").toUpperCase() === "RUNNING").length;
  const operationsRunning = missionList.reduce(
    (n: number, m: any) => n + (m.operations || []).filter((o: any) => o.status === "RUNNING").length,
    0,
  );
  const eventsRecent = eventList.filter(
    (e) => Date.parse(e.timestamp) > Date.now() - 5 * 60_000,
  ).length;
  const costActive = missionList
    .filter((m: any) => ACTIVE_MISSION(m.status))
    .reduce((sum: number, m: any) => sum + (m.totalCost || 0), 0);
  const completedMissions = missionList.filter((m: any) => m.status === "COMPLETED").length;

  const queueError = approvalsError || missionsError;
  const healthError = missionsError;

  return (
    <main className="relative mx-auto grid w-full max-w-[1240px] gap-6">
      <ControlHeader
        isStreaming={streaming}
        lastEventAt={lastEventAt}
        needsCount={queue.length}
        activeMissions={activeMissions}
      />

      <AttentionQueue
        items={queue}
        isLoading={approvalsLoading || missionsLoading}
        error={queueError}
      />

      <div className="grid gap-6 xl:grid-cols-12">
        <div className="xl:col-span-8">
          <MissionHealth missions={missionList} isLoading={missionsLoading} error={healthError} />
        </div>
        <div className="xl:col-span-4">
          <LiveSummary
            activeAgents={activeAgents}
            totalAgents={agentList.length}
            runningTasks={runningTasks}
            operationsRunning={operationsRunning}
            eventsRecent={eventsRecent}
            costActive={costActive}
            completedMissions={completedMissions}
            isLoading={agentsLoading || tasksLoading}
            error={agentsError || tasksError}
          />
        </div>
      </div>
    </main>
  );
}
