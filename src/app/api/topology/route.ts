import { NextResponse } from "next/server";
import prisma from "@/lib/db";
import { CORE_ID } from "@/lib/topology";

/**
 * Live Topology projection.
 * Reads real system state and relationships — never duplicated UI state.
 *
 * NODES:
 *   BRAIN (HIVE CORE) → STRIKE CORE → COLONIES → LEAD AGENTS → SUB AGENTS
 *   └── MISSION / TOOL / MCP / AUTOMATION / MEMORY
 * STRIKE CORE is the synthetic orchestration layer (stable id, non-persistent).
 * Each node carries the authoritative runtime state:
 *   runtimeState / previousRuntimeState / blockedBy / stateReason / currentTaskId
 *
 * EDGES (computed here, not re-derived in the UI):
 *   manages      — BRAIN → CORE (agent→agent manages only where no parent-child edge)
 *   contains     — CORE → colonies (+ colony→lead from the relationship table)
 *   reports_to   — agent.parentId hierarchy
 *   assigned     — mission → task owner agent (mission nodes carry task counts)
 *   blocked_by   — agent.blockedBy → agent
 *   depends_on   — dependent task owner → dependency task owner (agent-level)
 *   uses         — agent → tool (relationship rows + synthesized from agent.tools)
 * Relationship table is gated to the final vocabulary (assigned_to→assigned,
 * contains, manages, uses). plans / created_by / exposed_* are hidden from the
 * topology entirely.
 */

function node(id: string, type: string, label: string, status: string, segment: Record<string, unknown>) {
  return { id, type, label, status, ...segment };
}

export async function GET(req: Request) {
  try {
    const colonies = await prisma.colony.findMany({
      include: { agents: true },
      orderBy: { name: "asc" },
    });

    const relationships = await prisma.relationship.findMany();

    const missions = await prisma.mission.findMany({
      include: { tasks: true },
      orderBy: { createdAt: "desc" },
    });

    const [tools, mcpConnections, automations, memories] = await Promise.all([
      prisma.tool.findMany(),
      prisma.mCPConnection.findMany(),
      prisma.automation.findMany(),
      prisma.memory.findMany({ take: 40 }),
    ]);

    const rootAgents = await prisma.agent.findMany({ where: { colonyId: null } });

    const nodes: ReturnType<typeof node>[] = [];
    const edges: { id: string; source: string; target: string; type: string; data?: Record<string, unknown> }[] = [];

    nodes.push(
      node("hive-core", "HIVE_CORE", "Strike OS", "active", {
        data: {
          agentCount:
            rootAgents.length +
            colonies.reduce((sum, c) => sum + c.agents.filter((a) => a.status !== "ARCHIVED").length, 0),
          missionCount: missions.length,
        },
      })
    );

    // STRIKE CORE — synthetic orchestration layer (never persisted). Stable,
    // non-persistent id; derived here between BRAIN and the colonies.
    nodes.push(
      node(CORE_ID, "CORE", "Strike Core", "active", {
        data: {
          colonies: colonies.length,
          active: colonies.filter((c) => c.status !== "PAUSED" && c.status !== "STOPPED" && c.status !== "ARCHIVED").length,
        },
      })
    );
    edges.push({ id: "core:manages:hive", source: "hive-core", target: CORE_ID, type: "manages" });

    const agentNode = (a: { id: string; name: string; type: string; status: string; colonyId: string | null; parentId: string | null; runtimeState: string; previousRuntimeState: string; blockedBy: string | null; stateReason: string | null; currentTaskId: string | null; capabilities: string; tools: string; models: string }, parent: string) => {
      if (a.status === "ARCHIVED") return;
      nodes.push(
        node(`agent:${a.id}`, a.type, a.name, a.runtimeState, {
          runtimeState: a.runtimeState,
          previousRuntimeState: a.previousRuntimeState,
          blockedBy: a.blockedBy,
          stateReason: a.stateReason,
          currentTaskId: a.currentTaskId,
          parent,
          data: {
            capabilities: safeParse(a.capabilities),
            tools: safeParse(a.tools),
            models: safeParse(a.models),
            activeTaskId: a.currentTaskId,
          },
        })
      );
    };

    colonies.forEach((colony) => {
      nodes.push(
        node(`colony:${colony.id}`, "COLONY", colony.name, colony.status.toLowerCase(), {
          status: colony.status.toLowerCase(),
          parent: CORE_ID,
          data: { agents: colony.agents.filter((a) => a.status !== "ARCHIVED").length },
        })
      );
      edges.push({
        id: `core:contains:${colony.id}`,
        source: CORE_ID,
        target: `colony:${colony.id}`,
        type: "contains",
      });

      // Leads = colony agents with no parentId; sub-agents are children of their parent agent
      const leads = colony.agents.filter((a) => a.parentId === null);
      const subAgents = colony.agents.filter((a) => a.parentId !== null);

      leads.forEach((agent) => {
        agentNode(agent, `colony:${colony.id}`);
      });

      subAgents.forEach((agent) => {
        agentNode(agent, `agent:${agent.parentId}`);
        edges.push({
          id: `reports:${agent.parentId}:${agent.id}`,
          source: `agent:${agent.parentId}`,
          target: `agent:${agent.id}`,
          type: "reports_to",
        });
      });
    });

    rootAgents.forEach((agent) => agentNode(agent, "hive-core"));

    const agentStatusById = new Map<string, string>();
    [...colonies.flatMap((c) => c.agents), ...rootAgents].forEach((a) => agentStatusById.set(a.id, a.runtimeState));
    const agentNodeIds = new Set<string>(agentStatusById.keys());

    // Parent→child pairs from the reports_to hierarchy — used to suppress
    // agent→agent `manages` rows that would double-wire the same two agents.
    const parentChild = new Set<string>();
    [...colonies.flatMap((c) => c.agents), ...rootAgents].forEach((a) => {
      if (a.parentId) parentChild.add(`${a.parentId}:${a.id}`);
    });

    // Blocked edges — agent.blockedBy is the authoritative cause
    const blockedAgents = [...colonies.flatMap((c) => c.agents), ...rootAgents].filter((a) => a.blockedBy);
    const knownPrefix = /^(agent|colony|mission|tool|mcp|automation|memory):/;
    for (const a of blockedAgents) {
      const cause = a.blockedBy as string;
      const src = knownPrefix.test(cause) ? cause : `agent:${cause}`;
      // Never a self-loop — if the cause resolves to the agent itself, drop it.
      if (src === `agent:${a.id}`) continue;
      edges.push({
        id: `blocked:${a.id}`,
        source: src,
        target: `agent:${a.id}`,
        type: "blocked_by",
      });
    }

    // Mission nodes + task ownership edges
    const missionPercent: Record<string, number> = {};
    missions.forEach((mission) => {
      const done = mission.tasks.filter((t) => t.status === "COMPLETED").length;
      missionPercent[`mission:${mission.id}`] = mission.tasks.length ? Math.round((done / mission.tasks.length) * 100) : 0;

      nodes.push(
        node(`mission:${mission.id}`, "MISSION", mission.goal.slice(0, 36), mission.status.toLowerCase(), {
          status: mission.status.toLowerCase(),
          parent: mission.status === "COMPLETED" || mission.status === "CANCELLED" ? undefined : "hive-core",
          data: { tasks: mission.tasks.length },
        })
      );

      const taskByOwner = new Map<string, string>();
      mission.tasks.forEach((t) => {
        if (t.ownerAgentId && !taskByOwner.has(t.ownerAgentId)) taskByOwner.set(t.ownerAgentId, t.id);
      });
      taskByOwner.forEach((taskId, ownerId) => {
        edges.push({
          id: `assigned:${mission.id}:${ownerId}`,
          source: `mission:${mission.id}`,
          target: `agent:${ownerId}`,
          type: "assigned",
          data: { taskId },
        });
      });

      // Depends-on at agent level: dependent task owner → prerequisite owner.
      // A task's `dependencies` lists the prerequisite tasks it waits on, so the
      // task holding the list (and its owner) is the dependent.
      const ownerById = new Map<string, string>();
      mission.tasks.forEach((t) => {
        if (t.ownerAgentId) ownerById.set(t.id, t.ownerAgentId);
      });
      mission.tasks.forEach((t) => {
        if (!t.ownerAgentId || !agentNodeIds.has(t.ownerAgentId)) return;
        const deps = safeParse(t.dependencies) as string[];
        deps.forEach((depTaskId) => {
          const depOwner = ownerById.get(depTaskId);
          if (!depOwner || depOwner === t.ownerAgentId) return;
          if (!agentNodeIds.has(depOwner)) return;
          edges.push({
            id: `depends:${mission.id}:${t.id}:${depTaskId}`,
            source: `agent:${t.ownerAgentId}`,
            target: `agent:${depOwner}`,
            type: "depends_on",
            data: { taskId: t.id, dependsOn: depTaskId },
          });
        });
      });
    });

    tools.forEach((tool) =>
      nodes.push(node(`tool:${tool.id}`, "TOOL", tool.name, tool.health || "unknown", { data: { tools: [] } }))
    );
    mcpConnections.forEach((conn) =>
      nodes.push(node(`mcp:${conn.id}`, "MCP", conn.name, conn.status.toLowerCase(), { data: {} }))
    );
    automations.forEach((auto) =>
      nodes.push(node(`automation:${auto.id}`, "AUTOMATION", auto.name, auto.status.toLowerCase(), { data: {} }))
    );
    memories.forEach((mem) =>
      nodes.push(node(`memory:${mem.id}`, "MEMORY", mem.content.slice(0, 32), "active", { data: {} }))
    );

    // Complete `uses`: synthesize agent → tool edges from each agent's tools
    // array (matched by tool id OR name), beyond the relationship-table rows.
    const toolNodeByToken = new Map<string, string>();
    tools.forEach((tool) => {
      toolNodeByToken.set(tool.id, `tool:${tool.id}`);
      if (!toolNodeByToken.has(tool.name)) toolNodeByToken.set(tool.name, `tool:${tool.id}`);
    });
    for (const ag of [...colonies.flatMap((c) => c.agents), ...rootAgents]) {
      if (ag.status === "ARCHIVED") continue;
      const tokens = safeParse(ag.tools) as unknown[];
      tokens.forEach((token) => {
        if (typeof token !== "string") return;
        const target = toolNodeByToken.get(token);
        if (!target) return;
        edges.push({ id: `uses:synth:${ag.id}:${target}`, source: `agent:${ag.id}`, target, type: "uses" });
      });
    }

    // Relationship table → typed edges (only when both endpoints exist). Gated
    // to the final vocabulary: assigned_to→assigned, contains, manages, uses.
    // plans / created_by / exposed_* are hidden from the topology. Agent→agent
    // manages is suppressed where the parent-child reports_to edge covers it.
    const RELATION_EDGE_TYPE: Record<string, string> = {
      assigned_to: "assigned",
      contains: "contains",
      manages: "manages",
      uses: "uses",
    };
    const nodeIds = new Set(nodes.map((n) => n.id));
    for (const r of relationships) {
      const relation = r.relation.toLowerCase();
      const edgeType = RELATION_EDGE_TYPE[relation];
      if (!edgeType) continue;
      if (
        relation === "manages" &&
        r.fromType === "agent" &&
        r.toType === "agent" &&
        parentChild.has(`${r.fromId}:${r.toId}`)
      )
        continue;
      const source = `${r.fromType}:${r.fromId}`;
      const target = `${r.toType}:${r.toId}`;
      if (nodeIds.has(source) && nodeIds.has(target)) {
        edges.push({ id: `rel:${r.id}`, source, target, type: edgeType });
      }
    }

    // De-dupe identical source→target→type
    const seen = new Set<string>();
    const uniqueEdges = edges.filter((e) => {
      const key = `${e.source}|${e.target}|${e.type}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    // Current-task summaries for "what is this agent doing now"
    const activeTaskIds = Array.from(
      new Set(
        [...colonies.flatMap((c) => c.agents), ...rootAgents]
          .map((a) => a.currentTaskId)
          .filter((v): v is string => Boolean(v))
      )
    );
    const activeTasks = activeTaskIds.length
      ? await prisma.task.findMany({ where: { id: { in: activeTaskIds } }, select: { id: true, description: true } })
      : [];
    const taskSummaryById: Record<string, string> = {};
    activeTasks.forEach((t) => (taskSummaryById[t.id] = t.description));

    return NextResponse.json({
      projection: {
        generatedAt: new Date(),
        nodes,
        edges: uniqueEdges,
        relationships,
        taskSummaryById,
        missionPercent,
        stats: {
          colonies: colonies.length,
          agents:
            rootAgents.length +
            colonies.reduce((sum, c) => sum + c.agents.filter((a) => a.status !== "ARCHIVED").length, 0),
          missions: missions.length,
          tasks: missions.reduce((sum, m) => sum + m.tasks.length, 0),
          tools: tools.length,
          mcpServers: mcpConnections.length,
          automations: automations.length,
          memories: memories.length,
          blocked: blockedAgents.length,
        },
      },
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to generate topology projection" }, { status: 500 });
  }
}

function safeParse(s: string): unknown[] {
  try {
    const v = JSON.parse(s);
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}