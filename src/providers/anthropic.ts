import { readFileSync } from "node:fs";
import { fetchWithTimeout } from "../fetch.js";
import { logger } from "../logger.js";
import type { MediaAttachment } from "../media/types.js";
import type { Provider, ProviderResult, ConversationContext } from "./types.js";

type ContentBlock =
  | { type: "text"; text: string }
  | { type: "image"; source: { type: "base64"; media_type: string; data: string } };

function buildUserContent(prompt: string, media?: MediaAttachment[]): ContentBlock[] {
  const parts: ContentBlock[] = [];

  const images = media?.filter((m) => m.type === "image") ?? [];
  for (const img of images) {
    const data = readFileSync(img.path).toString("base64");
    parts.push({
      type: "image",
      source: { type: "base64", media_type: img.mimeType, data },
    });
  }

  if (prompt) {
    parts.push({ type: "text", text: prompt });
  }

  return parts;
}

export function createAnthropicProvider(apiKey: string, model: string): Provider {
  const history: Map<string, Array<{ role: string; content: ContentBlock[] | string }>> = new Map();

  return {
    id: "anthropic",
    async send(prompt: string, context: ConversationContext): Promise<ProviderResult> {
      const messages = history.get(context.chatId) ?? [];
      const systemContent = [context.memoryContext, context.skillContext]
        .filter(Boolean)
        .join("\n\n");

      const userContent = buildUserContent(prompt, context.media);

      const body: Record<string, unknown> = {
        model,
        max_tokens: 4096,
        messages: [
          ...messages,
          { role: "user", content: userContent },
        ],
      };

      if (systemContent) {
        body.system = systemContent;
      }

      const res = await fetchWithTimeout("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
        timeoutMs: 90_000,
      });

      if (!res.ok) {
        const text = await res.text();
        logger.error({ status: res.status, text }, "Anthropic error");
        throw new Error(`Anthropic ${res.status}: ${text}`);
      }

      const data = (await res.json()) as {
        content: Array<{ type: string; text?: string }>;
      };

      const responseText = data.content
        .filter((b) => b.type === "text")
        .map((b) => b.text ?? "")
        .join("");

      // Store text-only in history to avoid ballooning memory with base64
      messages.push({ role: "user", content: prompt });
      messages.push({ role: "assistant", content: responseText });
      history.set(context.chatId, messages);

      return { text: responseText };
    },
  };
}
