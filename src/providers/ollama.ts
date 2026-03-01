import { logger } from "../logger.js";
import type { Provider, ProviderResult, ConversationContext } from "./types.js";

export function createOllamaProvider(model: string, baseUrl = "http://localhost:11434"): Provider {
  const history: Map<string, Array<{ role: string; content: string }>> = new Map();

  return {
    id: "ollama",
    async send(prompt: string, context: ConversationContext): Promise<ProviderResult> {
      const messages = history.get(context.chatId) ?? [];
      const systemContent = [context.memoryContext, context.skillContext]
        .filter(Boolean)
        .join("\n\n");

      const body = {
        model,
        stream: false,
        messages: [
          ...(systemContent ? [{ role: "system", content: systemContent }] : []),
          ...messages,
          { role: "user", content: prompt },
        ],
      };

      const res = await fetch(`${baseUrl}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const text = await res.text();
        logger.error({ status: res.status, text }, "Ollama error");
        throw new Error(`Ollama ${res.status}: ${text}`);
      }

      const data = (await res.json()) as { message: { content: string } };
      const responseText = data.message?.content ?? "";

      messages.push({ role: "user", content: prompt });
      messages.push({ role: "assistant", content: responseText });
      history.set(context.chatId, messages);

      return { text: responseText };
    },
  };
}
