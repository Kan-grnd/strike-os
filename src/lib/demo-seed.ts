import type { PrismaClient } from "@prisma/client";

/**
 * Demo seed — shared between `prisma/seed.ts` (CLI) and the
 * admin reset-demo route so SIMULATE-mode reset fully restores
 * the demo dataset instead of wiping it empty.
 */
export async function seedDemo(prisma: PrismaClient) {
  console.log("🌱 Seeding Strike OS...");

  // Clean existing data
  await prisma.approval.deleteMany();
  await prisma.specialistInstall.deleteMany();
  await prisma.automationRun.deleteMany();
  await prisma.automation.deleteMany();
  await prisma.memory.deleteMany();
  await prisma.relationship.deleteMany();
  await prisma.secret.deleteMany();
  await prisma.trace.deleteMany();
  await prisma.event.deleteMany();
  await prisma.task.deleteMany();
  await prisma.mission.deleteMany();
  await prisma.tool.deleteMany();
  await prisma.mCPConnection.deleteMany();
  await prisma.model.deleteMany();
  await prisma.provider.deleteMany();
  await prisma.agent.deleteMany();
  await prisma.colony.deleteMany();

  // ─── Colonies ───────────────────────────────
  const research = await prisma.colony.create({
    data: {
      name: "Research Colony",
      status: "ACTIVE",
      description: "Competitor intelligence gathering, source evaluation, and analysis",
    },
  });

  const engineering = await prisma.colony.create({
    data: {
      name: "Engineering Colony",
      status: "ACTIVE",
      description: "Report pipeline architecture, implementation, and quality validation",
    },
  });

  // ─── Providers ──────────────────────────────
  const anthropic = await prisma.provider.create({
    data: {
      name: "Anthropic",
      category: "AI",
      baseUrl: "https://api.anthropic.com",
      status: "healthy",
      costPer1KInput: 3,
      costPer1KOutput: 15,
    },
  });

  const openai = await prisma.provider.create({
    data: {
      name: "OpenAI",
      category: "AI",
      baseUrl: "https://api.openai.com",
      status: "healthy",
      costPer1KInput: 2.5,
      costPer1KOutput: 10,
    },
  });

  const omniroute = await prisma.provider.create({
    data: {
      name: "OmniRoute",
      category: "AI",
      baseUrl: "http://localhost:20128/v1",
      status: "healthy",
      costPer1KInput: 1,
      costPer1KOutput: 5,
    },
  });

  // ─── Models ─────────────────────────────────
  const sonnet = await prisma.model.create({
    data: {
      providerId: anthropic.id,
      name: "claude-sonnet-4",
      capabilities: JSON.stringify(["text", "reasoning", "code", "tool_calling", "vision", "long_context"]),
      contextWindow: 200000,
      costPer1KInput: 3,
      costPer1KOutput: 15,
    },
  });

  const haiku = await prisma.model.create({
    data: {
      providerId: anthropic.id,
      name: "claude-haiku-4",
      capabilities: JSON.stringify(["text", "reasoning", "tool_calling"]),
      contextWindow: 200000,
      costPer1KInput: 0.25,
      costPer1KOutput: 1.25,
    },
  });

  const gpt4o = await prisma.model.create({
    data: {
      providerId: openai.id,
      name: "gpt-4o",
      capabilities: JSON.stringify(["text", "reasoning", "code", "tool_calling", "vision"]),
      contextWindow: 128000,
      costPer1KInput: 2.5,
      costPer1KOutput: 10,
    },
  });

  const autoBestCoding = await prisma.model.create({
    data: {
      providerId: omniroute.id,
      name: "auto/best-coding",
      capabilities: JSON.stringify(["text", "reasoning", "code", "tool_calling", "long_context"]),
      contextWindow: 200000,
      costPer1KInput: 1,
      costPer1KOutput: 5,
    },
  });

  const autoFast = await prisma.model.create({
    data: {
      providerId: omniroute.id,
      name: "auto/fast",
      capabilities: JSON.stringify(["text", "reasoning", "tool_calling"]),
      contextWindow: 128000,
      costPer1KInput: 0.5,
      costPer1KOutput: 2.5,
    },
  });

  // ─── Tools ──────────────────────────────────
  const browser = await prisma.tool.create({
    data: {
      name: "browser",
      description: "Browse the web and scrape pages for competitor content",
      source: "NATIVE",
      inputSchema: JSON.stringify({ type: "object", properties: { url: { type: "string" } }, required: ["url"] }),
      outputSchema: JSON.stringify({ type: "object", properties: { page: { type: "object" } } }),
      timeout: 30000,
      health: "healthy",
    },
  });

  const search = await prisma.tool.create({
    data: {
      name: "search",
      description: "Search the web for current information on competitors and intel",
      source: "NATIVE",
      inputSchema: JSON.stringify({ type: "object", properties: { query: { type: "string" } }, required: ["query"] }),
      outputSchema: JSON.stringify({ type: "object", properties: { results: { type: "array" } } }),
      timeout: 15000,
      health: "healthy",
    },
  });

  const github = await prisma.tool.create({
    data: {
      name: "github",
      description: "Read and update code and pipeline definitions on GitHub",
      source: "NATIVE",
      inputSchema: JSON.stringify({ type: "object", properties: { repo: { type: "string" }, path: { type: "string" } } }),
      outputSchema: JSON.stringify({ type: "object", properties: { content: { type: "string" } } }),
      timeout: 20000,
      health: "healthy",
    },
  });

  const terminal = await prisma.tool.create({
    data: {
      name: "terminal",
      description: "Run pipeline and export commands in the workspace shell",
      source: "NATIVE",
      inputSchema: JSON.stringify({ type: "object", properties: { command: { type: "string" } }, required: ["command"] }),
      outputSchema: JSON.stringify({ type: "object", properties: { stdout: { type: "string" }, exitCode: { type: "number" } } }),
      timeout: 60000,
      health: "healthy",
    },
  });

  const database = await prisma.tool.create({
    data: {
      name: "database",
      description: "Query the report datastore to validate findings and accuracy",
      source: "NATIVE",
      inputSchema: JSON.stringify({ type: "object", properties: { sql: { type: "string" } }, required: ["sql"] }),
      outputSchema: JSON.stringify({ type: "object", properties: { rows: { type: "array" } } }),
      timeout: 30000,
      health: "healthy",
    },
  });

  // ─── MCP Connection ─────────────────────────
  const devToolsMCP = await prisma.mCPConnection.create({
    data: {
      name: "Dev Tools MCP",
      baseUrl: "mcp://dev-tools",
      status: "CONNECTED",
      tools: JSON.stringify(["github", "terminal"]),
      lastPing: new Date(),
    },
  });

  // ─── Agents ─────────────────────────────────
  const researcher = await prisma.agent.create({
    data: {
      name: "Researcher",
      description: "Runs competitor research and synthesizes intelligence findings",
      type: "SPECIALIST",
      status: "EXECUTING",
      runtimeState: "executing",
      previousRuntimeState: "thinking",
      colonyId: research.id,
      capabilities: JSON.stringify(["intel.research", "source.evaluation", "report.synthesis"]),
      tools: JSON.stringify([search.id, browser.id]),
      models: JSON.stringify([sonnet.id]),
      memoryScope: "MISSION",
      tasksCompleted: 38,
      successRate: 96,
    },
  });

  const webAnalyst = await prisma.agent.create({
    data: {
      name: "Web Analyst",
      description: "Tracks competitor web presence and publishing cadence",
      type: "WORKER",
      status: "EXECUTING",
      runtimeState: "executing",
      previousRuntimeState: "planning",
      colonyId: research.id,
      capabilities: JSON.stringify(["web.analysis", "cadence.tracking"]),
      tools: JSON.stringify([browser.id, search.id]),
      models: JSON.stringify([haiku.id]),
      memoryScope: "AGENT",
      tasksCompleted: 87,
      successRate: 99,
    },
  });

  const sourceReviewer = await prisma.agent.create({
    data: {
      name: "Source Reviewer",
      description: "Rates collected sources for authority and relevance",
      type: "WORKER",
      status: "WAITING",
      runtimeState: "waiting",
      previousRuntimeState: "executing",
      stateReason: "holding analysis until research task completes",
      colonyId: research.id,
      capabilities: JSON.stringify(["source.evaluation", "authority.rating"]),
      tools: JSON.stringify([search.id, github.id]),
      models: JSON.stringify([haiku.id]),
      memoryScope: "AGENT",
      tasksCompleted: 142,
      successRate: 97,
    },
  });

  const architect = await prisma.agent.create({
    data: {
      name: "Architect",
      description: "Designs the report data model and ingestion pipeline",
      type: "ARCHITECT",
      status: "PLANNING",
      runtimeState: "planning",
      previousRuntimeState: "thinking",
      colonyId: engineering.id,
      capabilities: JSON.stringify(["system.design", "pipeline.architecture"]),
      tools: JSON.stringify([github.id, terminal.id]),
      models: JSON.stringify([gpt4o.id]),
      memoryScope: "GLOBAL",
      tasksCompleted: 45,
      successRate: 92,
    },
  });

  const coder = await prisma.agent.create({
    data: {
      name: "Coder",
      description: "Builds the report ingestion and summarization pipeline",
      type: "WORKER",
      status: "EXECUTING",
      runtimeState: "executing",
      previousRuntimeState: "planning",
      colonyId: engineering.id,
      capabilities: JSON.stringify(["code.python", "data.pipelines"]),
      tools: JSON.stringify([github.id, terminal.id]),
      models: JSON.stringify([autoBestCoding.id]),
      memoryScope: "MISSION",
      tasksCompleted: 38,
      successRate: 91,
    },
  });

  const qa = await prisma.agent.create({
    data: {
      name: "QA",
      description: "Validates report accuracy against source findings",
      type: "WORKER",
      status: "BLOCKED",
      runtimeState: "blocked",
      previousRuntimeState: "executing",
      colonyId: engineering.id,
      capabilities: JSON.stringify(["quality.validation", "accuracy.audit"]),
      tools: JSON.stringify([database.id, terminal.id]),
      models: JSON.stringify([autoFast.id]),
      memoryScope: "AGENT",
      tasksCompleted: 24,
      successRate: 100,
      blockedBy: coder.id,
      stateReason: "waiting on Coder",
    },
  });

  // ─── Missions ──────────────────────────────
  const intelMission = await prisma.mission.create({
    data: {
      goal: "Build competitor intelligence report covering positioning, sources, and export pipeline",
      status: "RUNNING",
      priority: 1,
      plan: JSON.stringify({
        steps: [
          { step: 1, action: "Research competitor public positioning and recent releases", agent: "researcher" },
          { step: 2, action: "Analyze competitor web presence and publishing cadence", agent: "web_analyst" },
          { step: 3, action: "Architect and build the report ingestion pipeline", agent: "architect" },
          { step: 4, action: "Validate report accuracy and export", agent: "qa" },
        ],
      }),
      agentIds: JSON.stringify([
        researcher.id,
        webAnalyst.id,
        sourceReviewer.id,
        architect.id,
        coder.id,
        qa.id,
      ]),
    },
  });

  const monitorMission = await prisma.mission.create({
    data: {
      goal: "Monitor approved intel sources for significant changes",
      status: "COMPLETED",
      priority: 2,
      plan: JSON.stringify({
        steps: [
          { step: 1, action: "Watch approved competitor sources for updates", agent: "web_research" },
          { step: 2, action: "Flag significant changes for user review", agent: "change_detection" },
        ],
      }),
      agentIds: JSON.stringify([researcher.id, webAnalyst.id]),
      completedAt: new Date(Date.now() - 3600 * 2000),
    },
  });

  // ─── Tasks ─────────────────────────────────
  const tResearch = await prisma.task.create({
    data: {
      missionId: intelMission.id,
      description: "Research competitor public positioning and recent releases",
      status: "RUNNING",
      ownerAgentId: researcher.id,
      input: JSON.stringify({ segment: "competitive_intel", lookback: "30d" }),
      priority: 1,
    },
  });

  const tWeb = await prisma.task.create({
    data: {
      missionId: intelMission.id,
      description: "Analyze competitor web presence and publishing cadence",
      status: "RUNNING",
      ownerAgentId: webAnalyst.id,
      input: JSON.stringify({ domains: ["competitor-alpha.com", "competitor-beta.com"] }),
      priority: 1,
    },
  });

  const tReview = await prisma.task.create({
    data: {
      missionId: intelMission.id,
      description: "Review collected sources for authority and relevance",
      status: "QUEUED",
      ownerAgentId: sourceReviewer.id,
      input: JSON.stringify({ threshold: "authority >= 0.7" }),
      priority: 2,
      dependencies: JSON.stringify([tResearch.id]),
    },
  });

  const tArch = await prisma.task.create({
    data: {
      missionId: intelMission.id,
      description: "Architect the report data model and ingestion pipeline",
      status: "ASSIGNED",
      ownerAgentId: architect.id,
      input: JSON.stringify({ scope: "report_ingestion" }),
      priority: 1,
    },
  });

  const tCode = await prisma.task.create({
    data: {
      missionId: intelMission.id,
      description: "Build the report ingestion and summarization pipeline",
      status: "RUNNING",
      ownerAgentId: coder.id,
      input: JSON.stringify({ stack: "python", export: "markdown" }),
      priority: 1,
    },
  });

  const tQa = await prisma.task.create({
    data: {
      missionId: intelMission.id,
      description: "Validate report accuracy against source findings",
      status: "QUEUED",
      ownerAgentId: qa.id,
      input: JSON.stringify({ checks: ["citation_match", "percent_accuracy"] }),
      priority: 2,
      dependencies: JSON.stringify([tCode.id]),
    },
  });

  const tMonitor = await prisma.task.create({
    data: {
      missionId: monitorMission.id,
      description: "Watch approved competitor sources for updates",
      status: "COMPLETED",
      ownerAgentId: researcher.id,
      input: JSON.stringify({ sources: ["approved_intel_feed_1", "approved_intel_feed_2"] }),
      output: JSON.stringify({ changes: 5 }),
      completedAt: new Date(Date.now() - 3600 * 2000),
    },
  });

  const tFlag = await prisma.task.create({
    data: {
      missionId: monitorMission.id,
      description: "Flag significant changes for user review",
      status: "COMPLETED",
      ownerAgentId: webAnalyst.id,
      output: JSON.stringify({ flags: [{ source: "approved_intel_feed_1", change: "rebrand" }] }),
      completedAt: new Date(Date.now() - 3600 * 1800),
    },
  });

  // Wire active task ids onto agents
  await prisma.agent.update({ where: { id: researcher.id }, data: { currentTaskId: tResearch.id } });
  await prisma.agent.update({ where: { id: webAnalyst.id }, data: { currentTaskId: tWeb.id } });
  await prisma.agent.update({ where: { id: sourceReviewer.id }, data: { currentTaskId: tReview.id } });
  await prisma.agent.update({ where: { id: architect.id }, data: { currentTaskId: tArch.id } });
  await prisma.agent.update({ where: { id: coder.id }, data: { currentTaskId: tCode.id } });
  await prisma.agent.update({ where: { id: qa.id }, data: { currentTaskId: tQa.id } });

  // ─── Automations ───────────────────────────
  await prisma.automation.create({
    data: {
      name: "Intel Source Sweep",
      description: "Sweep approved intel sources daily at 9 AM for new signals",
      trigger: JSON.stringify({ type: "schedule", cron: "0 9 * * *" }),
      conditions: JSON.stringify({}),
      actions: JSON.stringify([
        { type: "create_mission", goal: "Sweep intel sources for new signals and significant changes" },
        { type: "notify_user", message: "Daily intel source sweep completed" },
      ]),
      status: "ACTIVE",
      nextRun: new Date(Date.now() + 3600 * 1000),
      runCount: 42,
    },
  });

  await prisma.automation.create({
    data: {
      name: "Signal Change Alert",
      description: "Notify user when a reviewer flags a significant signal change",
      trigger: JSON.stringify({ type: "event", eventName: "change.detected" }),
      conditions: JSON.stringify({ importance: { gte: 0.8 } }),
      actions: JSON.stringify([
        { type: "notify_user", message: "Significant signal change detected in monitored sources" },
        { type: "write_memory", scope: "MISSION" },
      ]),
      status: "ACTIVE",
      runCount: 12,
    },
  });

  // ─── Memory ────────────────────────────────
  await prisma.memory.create({
    data: {
      content: "Intel missions prefer Claude Sonnet for report synthesis and Haiku for bulk source analysis",
      importance: 0.8,
      source: "mission-feedback",
      scope: "MISSION",
      subjectType: "mission",
    },
  });

  await prisma.memory.create({
    data: {
      content: "Web Analyst tracked 1,240 competitor publish events this week across monitored sources",
      importance: 0.7,
      source: "task-output",
      scope: "AGENT",
      subjectType: "agent",
    },
  });

  await prisma.memory.create({
    data: {
      content: "User prefers alerts for competitor signal changes over routine metadata updates",
      importance: 0.9,
      source: "user-feedback",
      scope: "USER",
      confidence: 0.95,
    },
  });

  await prisma.memory.create({
    data: {
      content: "Studio Beta increased publishing cadence to 2x daily — notable competitive shift",
      importance: 0.85,
      source: "analysis-output",
      scope: "MISSION",
      subjectType: "mission",
      confidence: 0.88,
    },
  });

  // ─── Relationships (Knowledge Graph) ──────
  await prisma.relationship.createMany({
    data: [
      { fromId: researcher.id, fromType: "agent", relation: "manages", toId: webAnalyst.id, toType: "agent" },
      { fromId: researcher.id, fromType: "agent", relation: "manages", toId: sourceReviewer.id, toType: "agent" },
      { fromId: architect.id, fromType: "agent", relation: "manages", toId: coder.id, toType: "agent" },
      { fromId: research.id, fromType: "colony", relation: "contains", toId: researcher.id, toType: "agent" },
      { fromId: research.id, fromType: "colony", relation: "contains", toId: webAnalyst.id, toType: "agent" },
      { fromId: research.id, fromType: "colony", relation: "contains", toId: sourceReviewer.id, toType: "agent" },
      { fromId: engineering.id, fromType: "colony", relation: "contains", toId: architect.id, toType: "agent" },
      { fromId: engineering.id, fromType: "colony", relation: "contains", toId: coder.id, toType: "agent" },
      { fromId: engineering.id, fromType: "colony", relation: "contains", toId: qa.id, toType: "agent" },
      { fromId: intelMission.id, fromType: "mission", relation: "assigned_to", toId: researcher.id, toType: "agent" },
      { fromId: intelMission.id, fromType: "mission", relation: "assigned_to", toId: webAnalyst.id, toType: "agent" },
      { fromId: intelMission.id, fromType: "mission", relation: "assigned_to", toId: sourceReviewer.id, toType: "agent" },
      { fromId: intelMission.id, fromType: "mission", relation: "assigned_to", toId: architect.id, toType: "agent" },
      { fromId: intelMission.id, fromType: "mission", relation: "assigned_to", toId: coder.id, toType: "agent" },
      { fromId: intelMission.id, fromType: "mission", relation: "assigned_to", toId: qa.id, toType: "agent" },
    ],
  });

  // ─── Secrets (references only) ─────────────
  await prisma.secret.create({
    data: {
      name: "Anthropic API Key",
      provider: "Anthropic",
      reference: "ANTHROPIC_API_KEY",
    },
  });

  await prisma.secret.create({
    data: {
      name: "OpenAI API Key",
      provider: "OpenAI",
      reference: "OPENAI_API_KEY",
    },
  });

  await prisma.secret.create({
    data: {
      name: "OmniRoute API Key",
      provider: "OmniRoute",
      reference: "OMNIROUTE_API_KEY",
    },
  });

  // ─── Events ────────────────────────────────
  const now = Date.now();
  const minute = 60 * 1000;

  await prisma.event.createMany({
    data: [
      {
        type: "system.started",
        source: "strike-os",
        payload: JSON.stringify({ version: "0.1.0" }),
        timestamp: new Date(now - 58 * minute),
      },
      {
        type: "agent.created",
        source: "agent-registry",
        subject: "agent",
        subjectId: researcher.id,
        agentId: researcher.id,
        payload: JSON.stringify({ name: researcher.name }),
        timestamp: new Date(now - 52 * minute),
      },
      {
        type: "agent.created",
        source: "agent-registry",
        subject: "agent",
        subjectId: qa.id,
        agentId: qa.id,
        payload: JSON.stringify({ name: qa.name }),
        timestamp: new Date(now - 51 * minute),
      },
      {
        type: "mission.created",
        source: "mission-service",
        subject: "mission",
        subjectId: intelMission.id,
        missionId: intelMission.id,
        payload: JSON.stringify({ goal: intelMission.goal }),
        timestamp: new Date(now - 50 * minute),
      },
      {
        type: "mission.started",
        source: "mission-service",
        subject: "mission",
        subjectId: intelMission.id,
        missionId: intelMission.id,
        timestamp: new Date(now - 48 * minute),
      },
      {
        type: "mission.completed",
        source: "mission-service",
        subject: "mission",
        subjectId: monitorMission.id,
        missionId: monitorMission.id,
        payload: JSON.stringify({ goal: monitorMission.goal }),
        timestamp: new Date(now - 120 * minute),
      },
      {
        type: "task.started",
        source: "task-engine",
        subject: "task",
        subjectId: tResearch.id,
        taskId: tResearch.id,
        missionId: intelMission.id,
        agentId: researcher.id,
        payload: JSON.stringify({ description: tResearch.description }),
        timestamp: new Date(now - 42 * minute),
      },
      {
        type: "task.started",
        source: "task-engine",
        subject: "task",
        subjectId: tWeb.id,
        taskId: tWeb.id,
        missionId: intelMission.id,
        agentId: webAnalyst.id,
        payload: JSON.stringify({ description: tWeb.description }),
        timestamp: new Date(now - 38 * minute),
      },
      {
        type: "tool.called",
        source: "tool-fabric",
        subject: "tool",
        subjectId: browser.id,
        payload: JSON.stringify({ tool: "browser", agent: webAnalyst.name }),
        timestamp: new Date(now - 26 * minute),
      },
      {
        type: "task.started",
        source: "task-engine",
        subject: "task",
        subjectId: tCode.id,
        taskId: tCode.id,
        missionId: intelMission.id,
        agentId: coder.id,
        payload: JSON.stringify({ description: tCode.description }),
        timestamp: new Date(now - 22 * minute),
      },
      {
        type: "tool.called",
        source: "tool-fabric",
        subject: "tool",
        subjectId: github.id,
        payload: JSON.stringify({ tool: "github", agent: coder.name }),
        timestamp: new Date(now - 16 * minute),
      },
      {
        type: "agent.waiting",
        source: "agent-registry",
        subject: "agent",
        subjectId: sourceReviewer.id,
        agentId: sourceReviewer.id,
        payload: JSON.stringify({ name: sourceReviewer.name, reason: sourceReviewer.stateReason }),
        timestamp: new Date(now - 14 * minute),
      },
      {
        type: "agent.blocked",
        source: "agent-registry",
        subject: "agent",
        subjectId: qa.id,
        agentId: qa.id,
        payload: JSON.stringify({ name: qa.name, blockedBy: coder.id }),
        timestamp: new Date(now - 8 * minute),
      },
      {
        type: "agent.thinking",
        source: "hive-core",
        subject: "agent",
        subjectId: "hive-core",
        payload: JSON.stringify({ phase: "replan" }),
        timestamp: new Date(now - 3 * minute),
      },
    ],
  });

  console.log("✅ Seed complete!");
  console.log({
    colonies: 2,
    agents: 6,
    providers: 3,
    models: 5,
    tools: 5,
    missions: 2,
    tasks: 8,
    automations: 2,
    memories: 4,
    relationships: 15,
    secrets: 3,
    events: 13,
  });
  return {
    colonies: 2,
    agents: 6,
    providers: 3,
    models: 5,
    tools: 5,
    missions: 2,
    tasks: 8,
    automations: 2,
    memories: 4,
    relationships: 15,
    secrets: 3,
    events: 13,
  };
}