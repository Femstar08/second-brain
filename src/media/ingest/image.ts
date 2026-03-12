import { readFileSync, statSync } from "node:fs";
import { logger } from "../../logger.js";
import type { MediaAttachment, ProcessedMedia } from "../types.js";

export async function ingestImage(
  attachment: MediaAttachment,
  config: { provider: "claude" | "openai"; apiKey?: string },
): Promise<ProcessedMedia> {
  const { path, mimeType, originalName } = attachment;

  let size: number | undefined;
  try {
    size = statSync(path).size;
  } catch {
    // size stays undefined
  }

  const metadata = { mimeType, size, originalName };

  if (config.provider === "claude") {
    return {
      type: "image",
      description: "[Image attached — described by LLM provider]",
      sourcePath: path,
      metadata,
    };
  }

  // OpenAI vision
  try {
    const imageBuffer = readFileSync(path) as Buffer;
    const base64Image = imageBuffer.toString("base64");

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.apiKey ?? ""}`,
      },
      body: JSON.stringify({
        model: "gpt-4o",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "image_url",
                image_url: { url: `data:${mimeType};base64,${base64Image}` },
              },
              { type: "text", text: "Describe this image concisely." },
            ],
          },
        ],
        max_tokens: 500,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenAI API error ${response.status}: ${errorText}`);
    }

    const data = (await response.json()) as {
      choices: Array<{ message: { content: string } }>;
    };

    const description = data.choices[0]?.message?.content ?? "[No description returned]";

    return {
      type: "image",
      description,
      sourcePath: path,
      metadata,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error({ err, path }, "Image description failed");

    return {
      type: "image",
      description: "[Image description failed]",
      sourcePath: path,
      metadata,
      error: message,
    };
  }
}
