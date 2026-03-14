import { randomUUID } from "node:crypto";
import { logger } from "../logger.js";
import type { Provider, ProviderResult } from "../providers/types.js";
import type { Database } from "../db.js";
import type { InboundMessage } from "../core/agent.js";
import type { AgentRegistry } from "./registry.js";
import type {
  AgentInstance,
  AgentTask,
  AgentResult,
  GovernanceMode,
  SupervisorDefinition,
} from "./types.js";

// ---------------------------------------------------------------------------
// Dependencies
// ---------------------------------------------------------------------------

export interface CoordinatorDeps {
  registry: AgentRegistry;
  /** agentId → live AgentInstance */
  agents: Map<string, AgentInstance>;
  /** Existing single-agent handler for passthrough */
  fallbackHandler: (msg: InboundMessage) => Promise<ProviderResult>;
  /** Primary provider used for classification */
  classifierProvider: Provider;
  db: Database;
}

// ---------------------------------------------------------------------------
// Classification
// ---------------------------------------------------------------------------

interface ClassificationResult {
  supervisorId: string | null;
  mode: GovernanceMode;
  taskPrompt: string;
}

const CLASSIFICATION_PROMPT = `You are a message classifier. Analyze the user's message and decide:

1. Should this go to "sam" (code/engineering/technical tasks, building features, debugging, architecture) or "beacon" (business content, marketing, outreach, PRDs, status reports)?
2. If this is casual conversation, a question, or a simple request that doesn't need a specialist team, respond with "none".
3. What governance mode: "prototype" (fast, light review) or "enterprise" (thorough, full review pipeline)?

Respond in EXACTLY this JSON format, nothing else:
{"supervisor": "sam"|"beacon"|"none", "mode": "prototype"|"enterprise", "task": "<refined task description>"}`;

async function classify(
  provider: Provider,
  message: string,
  chatId: string,
  defaultMode: GovernanceMode,
): Promise<ClassificationResult> {
  try {
    const result = await provider.send(
      `${CLASSIFICATION_PROMPT}\n\nUser message: ${message}`,
      { chatId: `classifier-${chatId}`, memoryContext: "" },
    );

    // Extract JSON from response (handle markdown code blocks)
    let jsonStr = result.text.trim();
    const jsonMatch = jsonStr.match(/\{[\s\S]*\}/);
    if (jsonMatch) jsonStr = jsonMatch[0];

    const parsed = JSON.parse(jsonStr);
    return {
      supervisorId: parsed.supervisor === "none" ? null : parsed.supervisor,
      mode: parsed.mode ?? defaultMode,
      taskPrompt: parsed.task ?? message,
    };
  } catch (err) {
    logger.warn({ err }, "Classification failed, falling through to default agent");
    return { supervisorId: null, mode: defaultMode, taskPrompt: message };
  }
}

// ---------------------------------------------------------------------------
// Pipeline execution
// ---------------------------------------------------------------------------

async function runSupervisorPipeline(
  supervisorDef: SupervisorDefinition,
  task: AgentTask,
  agents: Map<string, AgentInstance>,
  registry: AgentRegistry,
  db: Database,
): Promise<AgentResult[]> {
  const results: AgentResult[] = [];
  const { pipeline, governance } = supervisorDef;
  const modeConfig = governance[task.mode];

  // Determine which agents to run
  let agentIds = [...pipeline.sequence];

  // Enterprise: add mandatory agents
  if (task.mode === "enterprise") {
    const entConfig = modeConfig as { mandatory?: string[] };
    if (entConfig.mandatory) {
      for (const id of entConfig.mandatory) {
        if (!agentIds.includes(id)) agentIds.push(id);
      }
    }
  }

  // Prototype: skip designated agents
  if (task.mode === "prototype") {
    const protoConfig = modeConfig as { skip?: string[] };
    if (protoConfig.skip) {
      agentIds = agentIds.filter((id) => !protoConfig.skip!.includes(id));
    }
  }

  // Check conditional agents against message keywords
  const lowerMessage = (task.originalMessage ?? task.prompt).toLowerCase();
  for (const condId of pipeline.conditional) {
    const agentDef = registry.getAgent(condId);
    if (agentDef?.conditional) {
      const triggered = agentDef.conditional.triggers.some((t) =>
        lowerMessage.includes(t),
      );
      if (triggered && !agentIds.includes(condId)) {
        agentIds.push(condId);
      }
    }
  }

  // Execute pipeline sequentially — each agent sees prior outputs
  for (const agentId of agentIds) {
    const instance = agents.get(agentId);
    if (!instance) {
      logger.warn(
        { agentId, supervisor: supervisorDef.id },
        "Agent not found, skipping",
      );
      continue;
    }

    const agentTask: AgentTask = {
      ...task,
      id: randomUUID(),
      priorContext: results,
    };

    logger.info(
      { agentId, taskId: agentTask.id, supervisor: supervisorDef.id },
      "Running agent in pipeline",
    );

    const result = await instance.execute(agentTask);
    results.push(result);
    logAudit(db, agentTask, result);

    if (result.error) {
      logger.warn({ agentId, error: result.error }, "Agent failed, continuing pipeline");
    }
  }

  return results;
}

// ---------------------------------------------------------------------------
// Audit logging
// ---------------------------------------------------------------------------

function logAudit(db: Database, task: AgentTask, result: AgentResult): void {
  try {
    db.prepare(
      `INSERT INTO agent_audit (id, task_id, agent_id, chat_id, prompt, result, duration_ms, mode, error, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      randomUUID(),
      task.id,
      result.agentId,
      task.chatId,
      task.prompt.slice(0, 500),
      result.text.slice(0, 2000),
      result.durationMs,
      task.mode,
      result.error ?? null,
      Math.floor(Date.now() / 1000),
    );
  } catch (err) {
    logger.warn({ err }, "Failed to write audit log");
  }
}

// ---------------------------------------------------------------------------
// Coordinator (public)
// ---------------------------------------------------------------------------

export interface Coordinator {
  handleMessage(msg: InboundMessage): Promise<ProviderResult>;
  /** Run a specific agent directly (for scheduler) */
  runAgent(agentId: string, prompt: string, chatId: string): Promise<string>;
}

export function createCoordinator(deps: CoordinatorDeps): Coordinator {
  const { registry, agents, fallbackHandler, classifierProvider, db } = deps;

  return {
    async handleMessage(msg: InboundMessage): Promise<ProviderResult> {
      // Slash commands bypass the hierarchy
      if (msg.text.startsWith("/")) {
        return fallbackHandler(msg);
      }

      // Classify the message
      const classification = await classify(
        classifierProvider,
        msg.text,
        msg.chatId,
        registry.defaultMode,
      );

      // No supervisor needed — use existing single-agent path
      if (!classification.supervisorId) {
        return fallbackHandler(msg);
      }

      const supervisorDef = registry.supervisors.find(
        (s) => s.id === classification.supervisorId,
      );
      if (!supervisorDef) {
        logger.warn(
          { supervisorId: classification.supervisorId },
          "Unknown supervisor, falling through",
        );
        return fallbackHandler(msg);
      }

      // Build the task
      const task: AgentTask = {
        id: randomUUID(),
        chatId: msg.chatId,
        prompt: classification.taskPrompt,
        originalMessage: msg.text,
        mode: classification.mode,
      };

      logger.info(
        {
          taskId: task.id,
          supervisor: supervisorDef.id,
          mode: task.mode,
        },
        "Dispatching to supervisor pipeline",
      );

      // Run the pipeline
      const results = await runSupervisorPipeline(
        supervisorDef,
        task,
        agents,
        registry,
        db,
      );

      // Have the supervisor synthesise a final response
      const supervisorInstance = agents.get(supervisorDef.id);
      if (supervisorInstance && results.length > 0) {
        const synthesisTask: AgentTask = {
          id: randomUUID(),
          chatId: msg.chatId,
          prompt: `Synthesise the following agent outputs into a single coherent response for the user. Be direct and actionable — don't mention the individual agents by name unless it adds clarity.\n\nOriginal request: "${msg.text}"`,
          originalMessage: msg.text,
          priorContext: results,
          mode: task.mode,
        };

        const finalResult = await supervisorInstance.execute(synthesisTask);
        logAudit(db, synthesisTask, finalResult);

        // Handle cross-supervisor handoff
        if (finalResult.delegateTo) {
          const targetSupervisor = registry.supervisors.find(
            (s) => s.id === finalResult.delegateTo,
          );
          if (targetSupervisor) {
            logger.info(
              { from: supervisorDef.id, to: targetSupervisor.id },
              "Cross-supervisor handoff",
            );
            const handoffTask: AgentTask = {
              id: randomUUID(),
              chatId: msg.chatId,
              prompt: finalResult.text,
              originalMessage: msg.text,
              priorContext: results,
              mode: task.mode,
            };
            const handoffResults = await runSupervisorPipeline(
              targetSupervisor,
              handoffTask,
              agents,
              registry,
              db,
            );
            const handoffSupervisor = agents.get(targetSupervisor.id);
            if (handoffSupervisor && handoffResults.length > 0) {
              const handoffSynthesis: AgentTask = {
                id: randomUUID(),
                chatId: msg.chatId,
                prompt: `Synthesise the following agent outputs into a final response. Original request: "${msg.text}"`,
                originalMessage: msg.text,
                priorContext: handoffResults,
                mode: task.mode,
              };
              const handoffFinal = await handoffSupervisor.execute(handoffSynthesis);
              logAudit(db, handoffSynthesis, handoffFinal);
              return { text: handoffFinal.text };
            }
          }
        }

        return { text: finalResult.text };
      }

      // Fallback: concatenate results if no supervisor instance
      const combined = results
        .filter((r) => r.text && !r.error)
        .map((r) => r.text)
        .join("\n\n---\n\n");
      return { text: combined || "No agents produced output." };
    },

    async runAgent(
      agentId: string,
      prompt: string,
      chatId: string,
    ): Promise<string> {
      const instance = agents.get(agentId);
      if (!instance) {
        return `Agent "${agentId}" not found in registry.`;
      }

      const task: AgentTask = {
        id: randomUUID(),
        chatId,
        prompt,
        mode: registry.defaultMode,
      };

      const result = await instance.execute(task);
      logAudit(db, task, result);
      return result.error ? `Error: ${result.error}` : result.text;
    },
  };
}
