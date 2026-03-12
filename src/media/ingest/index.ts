import type { SecondBrainConfig } from "../../config.js";
import type { MediaAttachment, ProcessedMedia } from "../types.js";
import { ingestAudio } from "./audio.js";
import { ingestDocument } from "./document.js";
import { ingestImage } from "./image.js";
import { ingestVideo } from "./video.js";
import { ingestUrl } from "./url.js";

export { ingestUrl } from "./url.js";

export async function ingestMedia(
  attachment: MediaAttachment,
  config: SecondBrainConfig,
): Promise<ProcessedMedia> {
  const visionConfig = {
    provider: config.media.ingest.visionProvider,
    apiKey:
      config.media.ingest.visionProvider === "openai"
        ? config.providers.openai.apiKey
        : undefined,
  };

  switch (attachment.type) {
    case "audio":
      return ingestAudio(attachment);

    case "document":
      return ingestDocument(attachment);

    case "image":
      return ingestImage(attachment, visionConfig);

    case "video":
      return ingestVideo(attachment, {
        keyframeInterval: config.media.ingest.videoKeyframeInterval,
        visionConfig,
      });

    case "url":
      return ingestUrl(attachment.path);
  }
}

export function buildMediaFallback(attachments: MediaAttachment[]): string {
  const parts: string[] = [];

  for (const a of attachments) {
    switch (a.type) {
      case "image":
        parts.push("[Image attached]");
        break;
      case "audio":
        parts.push(
          a.transcription
            ? `[Voice message transcription]: ${a.transcription}`
            : "[Voice message attached]",
        );
        break;
      case "document":
        parts.push(
          a.extractedText
            ? `[Document: ${a.originalName ?? "file"}]\n${a.extractedText}`
            : `[Document attached: ${a.originalName ?? "file"}]`,
        );
        break;
      case "video":
        parts.push("[Video attached]");
        break;
      case "url":
        parts.push(
          a.extractedText
            ? `[URL content]: ${a.extractedText}`
            : "[URL content]",
        );
        break;
    }
  }

  return parts.join("\n\n");
}
