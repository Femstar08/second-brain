import { PROJECT_ROOT } from "../config.js";
import { logger } from "../logger.js";
import type { Provider, ProviderResult, ConversationContext } from "./types.js";

/**
 * Creates a provider that delegates to the OpenAI Codex agent via the
 * `@openai/codex-sdk` TypeScript SDK. The SDK spawns the `codex` CLI binary
 * and exchanges JSONL events over stdin/stdout, so the CLI must be installed
 * (`npm i -g @openai/codex` or available on PATH).
 *
 * Session continuity is supported: if `context.sessionId` contains a previous
 * thread ID, the provider resumes that thread instead of starting a new one.
 */
export function createCodexProvider(): Provider {
  return {
    id: "codex",
    async send(prompt: string, context: ConversationContext): Promise<ProviderResult> {
      const fullPrompt = [context.memoryContext, context.skillContext, prompt]
        .filter(Boolean)
        .join("\n\n---\n\n");

      try {
        // Dynamic import -- @openai/codex-sdk is an optional dependency that
        // may not be installed in every environment.
        const { Codex } = await import("@openai/codex-sdk");

        const codex = new Codex();

        // Resume an existing thread when a session ID is available, otherwise
        // start a fresh thread rooted in the project directory.
        const threadOptions = {
          workingDirectory: PROJECT_ROOT,
          approvalPolicy: "never" as const,
          sandboxMode: "workspace-write" as const,
        };

        const thread = context.sessionId
          ? codex.resumeThread(context.sessionId, threadOptions)
          : codex.startThread(threadOptions);

        const turn = await thread.run(fullPrompt);

        return {
          text: turn.finalResponse,
          // Persist the thread ID so subsequent messages can resume the
          // conversation.
          sessionId: thread.id ?? context.sessionId,
        };
      } catch (err) {
        logger.error({ err }, "Codex CLI provider error");
        throw err;
      }
    },
  };
}
