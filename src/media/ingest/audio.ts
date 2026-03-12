import { execSync } from "node:child_process";
import { readFileSync, statSync } from "node:fs";
import { logger } from "../../logger.js";
import type { MediaAttachment, ProcessedMedia } from "../types.js";

export async function ingestAudio(attachment: MediaAttachment): Promise<ProcessedMedia> {
  const { path, mimeType, originalName } = attachment;

  let size: number | undefined;
  try {
    size = statSync(path).size;
  } catch {
    // size stays undefined
  }

  const metadata = { mimeType, size, originalName };

  try {
    const result = execSync(`whisper "${path}" --output_format txt --output_dir /tmp`, {
      timeout: 120_000,
      encoding: "utf-8",
    });

    const baseName = path.split("/").pop()!.replace(/\.[^.]+$/, "");
    let transcription: string;
    try {
      transcription = (readFileSync(`/tmp/${baseName}.txt`, "utf-8") as string).trim();
    } catch {
      // Some whisper versions output directly to stdout
      transcription = (result as string).trim();
    }

    return {
      type: "audio",
      description: transcription,
      sourcePath: path,
      metadata,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error({ err, path }, "Whisper transcription failed");

    return {
      type: "audio",
      description: "[Audio transcription failed]",
      sourcePath: path,
      metadata,
      error: message,
    };
  }
}
