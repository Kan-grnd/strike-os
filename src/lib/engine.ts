/**
 * Engine singleton — shared task/mission engine instances.
 * Uses real AI execution with ModelGateway + provider adapters.
 * Falls back to mock if no API keys configured.
 */

import { PrismaClient } from "@prisma/client";
import { TaskEngine, TaskRunner } from "./task-engine";
import { MissionEngine } from "./mission-engine";
import { ModelGateway } from "./model-gateway";
import { RealTaskRunner } from "./task-runner-real";
import { getSecret } from "./secrets";

let _taskEngine: TaskEngine | null = null;
let _missionEngine: MissionEngine | null = null;
let _modelGateway: ModelGateway | null = null;

const globalForEngine = globalThis as unknown as {
  taskEngine: TaskEngine | undefined;
  missionEngine: MissionEngine | undefined;
  modelGateway: ModelGateway | undefined;
};

function getDb(): PrismaClient {
  const { PrismaClient: PC } = require("@prisma/client");
  return new PC({ log: [] });
}

async function hasApiKeys(): Promise<boolean> {
  try {
    const [anthropic, openai, omniroute] = await Promise.all([
      getSecret("anthropic", "ANTHROPIC_API_KEY"),
      getSecret("openai", "OPENAI_API_KEY"),
      getSecret("omniroute", "OMNIROUTE_API_KEY"),
    ]);
    return !!(anthropic || openai || omniroute);
  } catch {
    return false;
  }
}

export async function getTaskEngine(): Promise<TaskEngine> {
  if (globalForEngine.taskEngine) return globalForEngine.taskEngine;
  
  const db = getDb();
  const hasKeys = await hasApiKeys();
  
  let runner: TaskRunner;
  if (hasKeys) {
    const gateway = getModelGateway();
    runner = new RealTaskRunner(gateway);
    console.log("[Engine] Using RealTaskRunner (AI execution enabled)");
  } else {
    runner = new (require("./task-engine").MockTaskRunner)();
    console.log("[Engine] Using MockTaskRunner (no API keys configured)");
  }
  
  globalForEngine.taskEngine = new TaskEngine(db, runner);
  return globalForEngine.taskEngine;
}

export async function getMissionEngine(): Promise<MissionEngine> {
  if (globalForEngine.missionEngine) return globalForEngine.missionEngine;
  const db = getDb();
  const taskEngine = await getTaskEngine();
  globalForEngine.missionEngine = new MissionEngine(db, taskEngine);
  return globalForEngine.missionEngine;
}

export function getModelGateway(): ModelGateway {
  if (globalForEngine.modelGateway) return globalForEngine.modelGateway;
  globalForEngine.modelGateway = new ModelGateway();
  return globalForEngine.modelGateway;
}

export async function startEngine() {
  const engine = await getTaskEngine();
  engine.start();
  console.log("[Engine] Task engine started");
}

export function stopEngine() {
  const engine = globalForEngine.taskEngine;
  if (engine) engine.stop();
  console.log("[Engine] Task engine stopped");
}