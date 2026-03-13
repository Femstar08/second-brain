import { query } from "@anthropic-ai/claude-agent-sdk";
import { PROJECT_ROOT } from "../config.js";
import { logger } from "../logger.js";
import type { Provider, ProviderResult, ConversationContext } from "./types.js";

/** Default timeout for Claude CLI subprocess: 3 minutes */
const CLAUDE_TIMEOUT_MS = 180_000;

export function createClaudeProvider(): Provider {
  return {
    id: "claude",
    async send(prompt: string, context: ConversationContext): Promise<ProviderResult> {
      const fullPrompt = [context.memoryContext, context.skillContext, prompt]
        .filter(Boolean)
        .join("\n\n---\n\n");

      // Strip CLAUDE_CODE env vars to avoid nested session conflicts
      const cleanEnv: Record<string, string> = {};
      for (const [key, val] of Object.entries(process.env)) {
        if (!key.startsWith("CLAUDE_CODE") && val !== undefined) {
          cleanEnv[key] = val;
        }
      }

      let responseText = "";
      let newSessionId: string | undefined;

      try {
        const events = query({
          prompt: fullPrompt,
          options: {
            cwd: PROJECT_ROOT,
            env: cleanEnv,
            ...(context.sessionId ? { resume: context.sessionId } : {}),
            permissionMode: "bypassPermissions",
            allowDangerouslySkipPermissions: true,
            settingSources: ["project"],
          },
        });

        // Race the event stream against a timeout so we never hang forever
        const timeout = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error("Claude CLI timed out")), CLAUDE_TIMEOUT_MS);
        });

        const processEvents = async () => {
          for await (const event of events) {
            if (event.type === "system" && event.subtype === "init") {
              newSessionId = event.session_id;
            }
            if (event.type === "result") {
              if (event.subtype === "success") {
                responseText = event.result ?? "";
              } else {
                responseText = event.errors?.join("\n") ?? "An error occurred";
              }
              newSessionId = newSessionId ?? event.session_id;
            }
          }
        };

        await Promise.race([processEvents(), timeout]);
      } catch (err) {
        logger.error({ err }, "Claude CLI provider error");
        throw err;
      }

      return {
        text: responseText,
        sessionId: newSessionId ?? context.sessionId,
      };
    },
  };
}
