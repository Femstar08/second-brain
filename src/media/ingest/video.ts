import { execSync } from "node:child_process";
import { mkdtempSync, readdirSync, rmSync, statSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { logger } from "../../logger.js";
import type { MediaAttachment, ProcessedMedia } from "../types.js";
import { ingestAudio } from "./audio.js";
import { ingestImage } from "./image.js";

export async function ingestVideo(
  attachment: MediaAttachment,
  config: { keyframeInterval: number; visionConfig: { provider: "claude" | "openai"; apiKey?: string } },
): Promise<ProcessedMedia> {
  const { path, mimeType, originalName } = attachment;
  const { keyframeInterval, visionConfig } = config;

  let size: number | undefined;
  try {
    size = statSync(path).size;
  } catch {
    // size stays undefined
  }

  const metadata: ProcessedMedia["metadata"] = { mimeType, size, originalName };

  const tempDir = mkdtempSync(join(tmpdir(), "video-ingest-"));

  try {
    // Step 1: Get duration via ffprobe
    const ffprobeOutput = execSync(
      `ffprobe -v quiet -print_format json -show_format "${path}"`,
      { encoding: "utf-8" },
    ) as string;

    const probeData = JSON.parse(ffprobeOutput) as { format?: { duration?: string } };
    const duration = probeData.format?.duration ? parseFloat(probeData.format.duration) : undefined;
    if (duration !== undefined) {
      metadata.duration = duration;
    }

    // Step 2: Extract keyframes
    const framesDir = join(tempDir, "frames");
    execSync(`mkdir -p "${framesDir}"`);
    execSync(
      `ffmpeg -i "${path}" -vf "fps=1/${keyframeInterval}" "${framesDir}/frame_%03d.jpg" -y`,
      { encoding: "utf-8" },
    );

    // Step 3: Extract audio
    const audioPath = join(tempDir, "audio.opus");
    execSync(
      `ffmpeg -i "${path}" -vn -c:a libopus "${audioPath}" -y`,
      { encoding: "utf-8" },
    );

    // Step 4: Process keyframes (max 5)
    const frameFiles = (readdirSync(framesDir) as string[])
      .filter((f) => f.endsWith(".jpg"))
      .sort()
      .slice(0, 5);

    const frameResults = await Promise.all(
      frameFiles.map((file) =>
        ingestImage(
          {
            type: "image",
            path: join(framesDir, file),
            mimeType: "image/jpeg",
            originalName: file,
          },
          visionConfig,
        ),
      ),
    );

    // Step 5: Process audio
    const audioResult = await ingestAudio({
      type: "audio",
      path: audioPath,
      mimeType: "audio/opus",
    });

    // Step 6: Combine results
    const frameParts = frameResults
      .filter((r) => !r.error)
      .map((r) => r.description);

    const audioPart = audioResult.error ? null : audioResult.description;

    const parts: string[] = [];
    if (frameParts.length > 0) {
      parts.push(`[Visual content]\n${frameParts.join("\n")}`);
    }
    if (audioPart) {
      parts.push(`[Audio content]\n${audioPart}`);
    }

    const description = parts.join("\n\n") || "[Video processed — no content extracted]";

    const extractedText = audioPart ?? undefined;

    return {
      type: "video",
      description,
      extractedText,
      sourcePath: path,
      metadata,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error({ err, path }, "Video ingest failed");

    return {
      type: "video",
      description: "[Video processing failed]",
      sourcePath: path,
      metadata,
      error: message,
    };
  } finally {
    try {
      rmSync(tempDir, { recursive: true, force: true });
    } catch {
      // ignore cleanup errors
    }
  }
}
