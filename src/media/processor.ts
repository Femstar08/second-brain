import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { logger } from "../logger.js";
import type { MediaAttachment } from "./types.js";

export function transcribeAudio(path: string): string {
  try {
    const result = execSync(`whisper "${path}" --output_format txt --output_dir /tmp`, {
      timeout: 120_000,
      encoding: "utf-8",
    });
    // whisper outputs to /tmp/<basename>.txt
    const baseName = path.split("/").pop()!.replace(/\.[^.]+$/, "");
    try {
      return readFileSync(`/tmp/${baseName}.txt`, "utf-8").trim();
    } catch {
      // Some whisper versions output directly to stdout
      return result.trim();
    }
  } catch (err) {
    logger.error({ err, path }, "Whisper transcription failed");
    return "[Audio transcription failed]";
  }
}

export function extractDocumentText(path: string, mimeType: string): string {
  if (mimeType === "application/pdf") {
    try {
      return execSync(`pdftotext "${path}" -`, {
        timeout: 30_000,
        encoding: "utf-8",
      }).trim();
    } catch (err) {
      logger.error({ err, path }, "PDF text extraction failed");
      return "[PDF text extraction failed]";
    }
  }

  // Plain text files
  if (mimeType.startsWith("text/")) {
    try {
      return readFileSync(path, "utf-8").trim();
    } catch {
      return "[Could not read document]";
    }
  }

  return "[Unsupported document format]";
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
    }
  }

  return parts.join("\n\n");
}

export function preprocessMedia(attachments: MediaAttachment[]): MediaAttachment[] {
  return attachments.map((a) => {
    if (a.type === "audio" && !a.transcription) {
      return { ...a, transcription: transcribeAudio(a.path) };
    }
    if (a.type === "document" && !a.extractedText) {
      return { ...a, extractedText: extractDocumentText(a.path, a.mimeType) };
    }
    return a;
  });
}
