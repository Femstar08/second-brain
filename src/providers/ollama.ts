import { readFileSync } from "node:fs";
import http from "node:http";
import https from "node:https";
import { logger } from "../logger.js";
import type { Provider, ProviderResult, ConversationContext } from "./types.js";

/**
 * Stream a chat completion from Ollama using the http module.
 * Streaming avoids the runner getting wedged on timeouts (which happens
 * with stream:false when the connection drops mid-generation).
 */
function ollamaChat(
  url: string,
  payload: object,
  timeoutMs: number,
): Promise<{ content: string }> {
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ ...payload, stream: true });
    const parsed = new URL(url);
    const transport = parsed.protocol === "https:" ? https : http;

    const req = transport.request(
      {
        hostname: parsed.hostname,
        port: parsed.port,
        path: parsed.pathname,
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(body),
          Connection: "close",
        },
      },
      (res) => {
        if (res.statusCode !== 200) {
          let errBody = "";
          res.on("data", (c: Buffer) => { errBody += c; });
          res.on("end", () => reject(new Error(`Ollama ${res.statusCode}: ${errBody}`)));
          return;
        }

        let content = "";
        let buf = "";
        res.on("data", (chunk: Buffer) => {
          buf += chunk;
          // Ollama streams newline-delimited JSON
          const lines = buf.split("\n");
          buf = lines.pop() ?? "";
          for (const line of lines) {
            if (!line.trim()) continue;
            try {
              const obj = JSON.parse(line);
              if (obj.message?.content) content += obj.message.content;
            } catch { /* partial line, skip */ }
          }
        });
        res.on("end", () => {
          // Process any remaining buffer
          if (buf.trim()) {
            try {
              const obj = JSON.parse(buf);
              if (obj.message?.content) content += obj.message.content;
            } catch { /* ignore */ }
          }
          resolve({ content });
        });
      },
    );

    req.on("error", reject);
    req.setTimeout(timeoutMs, () => {
      req.destroy();
      reject(new Error(`Request to ${url} timed out after ${timeoutMs}ms`));
    });
    req.write(body);
    req.end();
  });
}

export function createOllamaProvider(initialModel: string, baseUrl = "http://127.0.0.1:11434"): Provider {
  let model = initialModel;
  const history: Map<string, Array<{ role: string; content: string }>> = new Map();

  return {
    id: "ollama",
    getModel() { return model; },
    setModel(m: string) { model = m; },
    async send(prompt: string, context: ConversationContext): Promise<ProviderResult> {
      const messages = history.get(context.chatId) ?? [];
      const systemContent = [context.memoryContext, context.skillContext]
        .filter(Boolean)
        .join("\n\n");

      // Build images array for vision models
      const images = context.media
        ?.filter((m) => m.type === "image")
        .map((m) => readFileSync(m.path).toString("base64"));

      const userMessage: Record<string, unknown> = { role: "user", content: prompt };
      if (images?.length) {
        userMessage.images = images;
      }

      const payload = {
        model,
        messages: [
          ...(systemContent ? [{ role: "system", content: systemContent }] : []),
          ...messages,
          userMessage,
        ],
      };

      const res = await ollamaChat(`${baseUrl}/api/chat`, payload, 300_000);
      const responseText = res.content;

      // Store text-only in history
      messages.push({ role: "user", content: prompt });
      messages.push({ role: "assistant", content: responseText });
      history.set(context.chatId, messages);

      return { text: responseText };
    },
  };
}
