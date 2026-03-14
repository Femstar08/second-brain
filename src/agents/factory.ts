import { randomUUID } from "node:crypto";
import { logger } from "../logger.js";
import { withTimeout } from "../fetch.js";
import { loadAlwaysContext } from "../memory/index.js";
import type { Provider } from "../providers/types.js";
import type { Database } from "../db.js";
import type {
  AgentDefinition,
  AgentInstance,
  AgentTask,
  AgentResult,
} from "./types.js";

// ---------------------------------------------------------------------------
// Dependencies injected at startup
// ---------------------------------------------------------------------------

export interface AgentFactoryDeps {
  /** Map of providerId → live Provider instance */
  providers: Record<string, Provider>;
  /** Creates a provider with a model override (for OpenRouter workers) */
  createModelOverride?: (baseProviderId: string, model: string) => Provider;
  db: Database;
  memoryDir: string;
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

export function createAgentInstance(
  definition: AgentDefinition,
  deps: AgentFactoryDeps,
): AgentInstance {
  // Resolve the provider — use model override if specified
  let provider: Provider;
  if (definition.model && deps.createModelOverride) {
    provider = deps.createModelOverride(definition.providerId, definition.model);
  } else {
    provider = deps.providers[definition.providerId];
    if (!provider) {
      throw new Error(
        `Agent "${definition.id}" requires provider "${definition.providerId}" which is not available`,
      );
    }
  }

  return {
    definition,
    provider,

    async execute(task: AgentTask): Promise<AgentResult> {
      const start = Date.now();

      try {
        // Build context: system prompt + optional shared memory + prior outputs
        const parts: string[] = [definition.systemPrompt];

        if (definition.sharedMemory) {
          const memCtx = loadAlwaysContext(deps.memoryDir);
          if (memCtx) parts.push(memCtx);
        }

        if (task.priorContext?.length) {
          const prior = task.priorContext
            .map((r) => `[${r.agentName}]:\n${r.text}`)
            .join("\n\n---\n\n");
          parts.push(`[Prior agent outputs]\n${prior}`);
        }

        if (task.originalMessage && task.originalMessage !== task.prompt) {
          parts.push(`[Original user message]: ${task.originalMessage}`);
        }

        const memoryContext = parts.join("\n\n---\n\n");
        const timeout = definition.timeoutMs ?? 120_000;

        const result = await withTimeout(
          provider.send(task.prompt, {
            chatId: task.chatId,
            memoryContext,
          }),
          timeout,
          `Agent ${definition.id}`,
        );

        return {
          agentId: definition.id,
          agentName: definition.name,
          text: result.text,
          durationMs: Date.now() - start,
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        logger.error(
          { err, agentId: definition.id, taskId: task.id },
          "Agent execution failed",
        );
        return {
          agentId: definition.id,
          agentName: definition.name,
          text: "",
          durationMs: Date.now() - start,
          error: message,
        };
      }
    },
  };
}
