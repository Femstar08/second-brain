import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { z } from "zod";
import type {
  AgentDefinition,
  SupervisorDefinition,
  GovernanceMode,
} from "./types.js";

// ---------------------------------------------------------------------------
// Zod schemas for registry.json validation
// ---------------------------------------------------------------------------

const ConditionalSchema = z
  .object({ triggers: z.array(z.string()) })
  .optional();

const PipelineSchema = z.object({
  sequence: z.array(z.string()),
  conditional: z.array(z.string()),
});

const GovernanceSchema = z.object({
  prototype: z.object({ skip: z.array(z.string()).optional() }).default({}),
  enterprise: z
    .object({ mandatory: z.array(z.string()).optional() })
    .default({}),
});

const AgentDefSchema = z.object({
  id: z.string(),
  name: z.string(),
  role: z.enum(["coordinator", "supervisor", "worker"]),
  description: z.string(),
  providerId: z.string(),
  model: z.string().optional(),
  systemPrompt: z.string(),
  parentId: z.string().optional(),
  conditional: ConditionalSchema,
  sharedMemory: z.boolean().default(true),
  timeoutMs: z.number().optional(),
});

const SupervisorDefSchema = AgentDefSchema.extend({
  role: z.literal("supervisor"),
  pipeline: PipelineSchema,
  governance: GovernanceSchema,
});

const RegistrySchema = z.object({
  defaultMode: z.enum(["prototype", "enterprise"]).default("prototype"),
  coordinator: AgentDefSchema,
  supervisors: z.array(SupervisorDefSchema),
  workers: z.array(AgentDefSchema),
});

// ---------------------------------------------------------------------------
// Public interface
// ---------------------------------------------------------------------------

export interface AgentRegistry {
  defaultMode: GovernanceMode;
  coordinator: AgentDefinition;
  supervisors: SupervisorDefinition[];
  workers: AgentDefinition[];
  /** Look up any agent by ID */
  getAgent(id: string): AgentDefinition | undefined;
  /** Get the supervisor that owns a given worker */
  getSupervisor(workerId: string): SupervisorDefinition | undefined;
  /** Get all workers under a supervisor */
  getWorkers(supervisorId: string): AgentDefinition[];
}

// ---------------------------------------------------------------------------
// Loader
// ---------------------------------------------------------------------------

export function loadAgentRegistry(projectRoot: string): AgentRegistry | null {
  const registryPath = join(projectRoot, "agents", "registry.json");
  if (!existsSync(registryPath)) return null;

  const raw = JSON.parse(readFileSync(registryPath, "utf-8"));
  const parsed = RegistrySchema.parse(raw);

  // Build a fast lookup map
  const allAgents = new Map<string, AgentDefinition>();
  allAgents.set(parsed.coordinator.id, parsed.coordinator as AgentDefinition);
  for (const s of parsed.supervisors) {
    allAgents.set(s.id, s as unknown as AgentDefinition);
  }
  for (const w of parsed.workers) {
    allAgents.set(w.id, w as AgentDefinition);
  }

  const supervisors = parsed.supervisors as unknown as SupervisorDefinition[];

  return {
    defaultMode: parsed.defaultMode,
    coordinator: parsed.coordinator as AgentDefinition,
    supervisors,
    workers: parsed.workers as AgentDefinition[],

    getAgent(id: string) {
      return allAgents.get(id);
    },

    getSupervisor(workerId: string) {
      const worker = allAgents.get(workerId);
      if (!worker?.parentId) return undefined;
      return supervisors.find((s) => s.id === worker.parentId);
    },

    getWorkers(supervisorId: string) {
      return (parsed.workers as AgentDefinition[]).filter(
        (w) => w.parentId === supervisorId,
      );
    },
  };
}
