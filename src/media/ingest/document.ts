import { execSync } from "node:child_process";
import { readFileSync, statSync } from "node:fs";
import { logger } from "../../logger.js";
import type { MediaAttachment, ProcessedMedia } from "../types.js";

export async function ingestDocument(attachment: MediaAttachment): Promise<ProcessedMedia> {
  const { path, mimeType, originalName } = attachment;

  let size: number | undefined;
  try {
    size = statSync(path).size;
  } catch {
    // size stays undefined
  }

  const metadata = { mimeType, size, originalName };

  if (mimeType === "application/pdf") {
    try {
      const text = (
        execSync(`pdftotext "${path}" -`, {
          timeout: 30_000,
          encoding: "utf-8",
        }) as string
      ).trim();

      return {
        type: "document",
        description: text,
        extractedText: text,
        sourcePath: path,
        metadata,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error({ err, path }, "PDF text extraction failed");

      return {
        type: "document",
        description: "[PDF text extraction failed]",
        sourcePath: path,
        metadata,
        error: message,
      };
    }
  }

  if (mimeType.startsWith("text/")) {
    try {
      const text = (readFileSync(path, "utf-8") as string).trim();

      return {
        type: "document",
        description: text,
        extractedText: text,
        sourcePath: path,
        metadata,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);

      return {
        type: "document",
        description: "[Could not read document]",
        sourcePath: path,
        metadata,
        error: message,
      };
    }
  }

  return {
    type: "document",
    description: "[Unsupported document format]",
    sourcePath: path,
    metadata,
  };
}
