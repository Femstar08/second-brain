import { logger } from "../logger.js";
import type { Provider, ProviderResult, ConversationContext } from "./types.js";

export function createOpenRouterProvider(apiKey: string, model: string): Provider {
  const history: Map<string, Array<{ role: string; content: string }>> = new Map();

  return {
    id: "openrouter",
    async send(prompt: string, context: ConversationContext): Promise<ProviderResult> {
      const messages = history.get(context.chatId) ?? [];
      const systemContent = [context.memoryContext, context.skillContext]
        .filter(Boolean)
        .join("\n\n");

      const body = {
        model,
        messages: [
          ...(systemContent ? [{ role: "system", content: systemContent }] : []),
          ...messages,
          { role: "user", content: prompt },
        ],
      };

      const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": "https://github.com/second-brain",
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const text = await res.text();
        logger.error({ status: res.status, text }, "OpenRouter error");
        throw new Error(`OpenRouter ${res.status}: ${text}`);
      }

      const data = (await res.json()) as {
        choices: Array<{ message: { content: string } }>;
      };
      const responseText = data.choices[0]?.message?.content ?? "";

      // Update history
      messages.push({ role: "user", content: prompt });
      messages.push({ role: "assistant", content: responseText });
      history.set(context.chatId, messages);

      return { text: responseText };
    },
  };
}
