import { query } from "@anthropic-ai/claude-agent-sdk";
import { PROJECT_ROOT } from "../config.js";
import { logger } from "../logger.js";
import type { Provider, ProviderResult, ConversationContext } from "./types.js";

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
            settingSources: ["project", "user"],
          },
        });

        for await (const event of events) {
          if (event.type === "system" && event.subtype === "init") {
            newSessionId = event.session_id;
          }
          if (event.type === "result") {
            if (event.subtype === "success") {
              responseText = event.result ?? "";
            } else {
              // Error result -- use the error messages as fallback text
              responseText = event.errors?.join("\n") ?? "An error occurred";
            }
            // Both success and error results carry session_id
            newSessionId = newSessionId ?? event.session_id;
          }
        }
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
