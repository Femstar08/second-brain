import { readFileSync } from "node:fs";
import { fetchWithTimeout } from "../fetch.js";
import { logger } from "../logger.js";
import type { MediaAttachment } from "../media/types.js";
import type { Provider, ProviderResult, ConversationContext } from "./types.js";

type MessageContent =
  | string
  | Array<
      | { type: "text"; text: string }
      | { type: "image_url"; image_url: { url: string } }
    >;

function buildUserContent(prompt: string, media?: MediaAttachment[]): MessageContent {
  const images = media?.filter((m) => m.type === "image") ?? [];
  if (images.length === 0) {
    return prompt;
  }

  const parts: Array<
    { type: "text"; text: string } | { type: "image_url"; image_url: { url: string } }
  > = [];

  if (prompt) {
    parts.push({ type: "text", text: prompt });
  }

  for (const img of images) {
    const data = readFileSync(img.path).toString("base64");
    parts.push({
      type: "image_url",
      image_url: { url: `data:${img.mimeType};base64,${data}` },
    });
  }

  return parts;
}

export function createOpenAIProvider(apiKey: string, initialModel: string): Provider {
  let model = initialModel;
  const history: Map<string, Array<{ role: string; content: MessageContent }>> = new Map();

  return {
    id: "openai",
    getModel() { return model; },
    setModel(m: string) { model = m; },
    async send(prompt: string, context: ConversationContext): Promise<ProviderResult> {
      const messages = history.get(context.chatId) ?? [];
      const systemContent = [context.memoryContext, context.skillContext]
        .filter(Boolean)
        .join("\n\n");

      const userContent = buildUserContent(prompt, context.media);

      const body = {
        model,
        messages: [
          ...(systemContent ? [{ role: "system", content: systemContent }] : []),
          ...messages,
          { role: "user", content: userContent },
        ],
      };

      const res = await fetchWithTimeout("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
        timeoutMs: 90_000,
      });

      if (!res.ok) {
        const text = await res.text();
        logger.error({ status: res.status, text }, "OpenAI error");
        throw new Error(`OpenAI ${res.status}: ${text}`);
      }

      const data = (await res.json()) as {
        choices: Array<{ message: { content: string } }>;
      };
      const responseText = data.choices[0]?.message?.content ?? "";

      // Store text-only in history to avoid ballooning memory with base64
      messages.push({ role: "user", content: prompt });
      messages.push({ role: "assistant", content: responseText });
      history.set(context.chatId, messages);

      return { text: responseText };
    },
  };
}
