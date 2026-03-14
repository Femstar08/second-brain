import type { Provider, ProviderResult } from "../providers/types.js";

// ---------------------------------------------------------------------------
// Governance
// ---------------------------------------------------------------------------

/** Governance mode determines workflow depth */
export type GovernanceMode = "prototype" | "enterprise";

/** Agent role in the hierarchy */
export type AgentRole = "coordinator" | "supervisor" | "worker";

// ---------------------------------------------------------------------------
// Declarative definitions (loaded from registry.json)
// ---------------------------------------------------------------------------

/** Declarative agent definition — loaded from JSON */
export interface AgentDefinition {
  id: string;
  name: string;
  role: AgentRole;
  description: string;
  /** Which provider ID to use (maps to router's providers) */
  providerId: string;
  /** Optional model override (e.g. "moonshotai/kimi-k2.5" on OpenRouter) */
  model?: string;
  /** System prompt — the agent's personality and instructions */
  systemPrompt: string;
  /** Parent supervisor ID (required for workers) */
  parentId?: string;
  /** Conditional activation based on keyword triggers */
  conditional?: {
    triggers: string[];
  };
  /** Whether this agent gets shared always-on memory context */
  sharedMemory: boolean;
  /** Timeout in ms for provider calls (default 120 000) */
  timeoutMs?: number;
}

/** Pipeline config for a supervisor — ordered agent IDs */
export interface Pipeline {
  /** Always-run agents in order */
  sequence: string[];
  /** Conditional agents checked by keyword */
  conditional: string[];
}

/** Supervisor extends AgentDefinition with pipeline + governance */
export interface SupervisorDefinition extends AgentDefinition {
  role: "supervisor";
  pipeline: Pipeline;
  governance: {
    prototype: { skip?: string[] };
    enterprise: { mandatory?: string[] };
  };
}

// ---------------------------------------------------------------------------
// Runtime types
// ---------------------------------------------------------------------------

/** A task dispatched to an agent */
export interface AgentTask {
  id: string;
  chatId: string;
  prompt: string;
  /** Original user message (may differ from prompt after classification) */
  originalMessage?: string;
  /** Accumulated outputs from prior agents in the pipeline */
  priorContext?: AgentResult[];
  /** Governance mode for this task */
  mode: GovernanceMode;
  /** Arbitrary metadata for audit */
  metadata?: Record<string, unknown>;
}

/** Result from an agent execution */
export interface AgentResult {
  agentId: string;
  agentName: string;
  text: string;
  /** Cross-supervisor handoff: set to target supervisor ID */
  delegateTo?: string;
  /** Structured artefacts (e.g. requirements doc, test plan) */
  artifacts?: Record<string, string>;
  /** Execution time */
  durationMs: number;
  /** Error message if the agent failed */
  error?: string;
}

/** Live agent instance wired to a provider */
export interface AgentInstance {
  definition: AgentDefinition;
  provider: Provider;
  execute(task: AgentTask): Promise<AgentResult>;
}

// ---------------------------------------------------------------------------
// Audit
// ---------------------------------------------------------------------------

export interface AgentAuditEntry {
  id: string;
  taskId: string;
  agentId: string;
  chatId: string;
  prompt: string;
  result: string;
  durationMs: number;
  mode: GovernanceMode;
  error?: string;
  createdAt: number;
}
