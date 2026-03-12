import { execSync } from "node:child_process";
import { writeFileSync, unlinkSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { logger } from "../../logger.js";
import { saveMediaFile } from "../store/local.js";
import type { GenerateRequest, GeneratedMedia } from "../types.js";

export interface TTSConfig {
  provider: "openai" | "gtts" | "elevenlabs" | "off";
  openaiApiKey?: string;
  /** OpenAI voice: alloy, echo, fable, onyx, nova, shimmer. Default: onyx */
  voice?: string;
}

const MAX_TTS_LENGTH = 4000;

/**
 * Generate speech from a GenerateRequest.
 * Returns null if provider is "off" or prompt is empty.
 * Throws on synthesis failure.
 */
export async function generateSpeech(
  request: GenerateRequest,
  config: TTSConfig,
): Promise<GeneratedMedia | null> {
  if (config.provider === "off" || !request.prompt.trim()) {
    return null;
  }

  // Truncate to avoid TTS limits
  const input =
    request.prompt.length > MAX_TTS_LENGTH
      ? request.prompt.slice(0, MAX_TTS_LENGTH) + "..."
      : request.prompt;

  const cleanText = stripMarkdown(input);

  let path: string;
  let provider: string;

  if (config.provider === "openai" && config.openaiApiKey) {
    path = await synthesizeOpenAI(cleanText, config);
    provider = "openai";
  } else if (config.provider === "gtts") {
    path = await synthesizeGTTS(cleanText);
    provider = "gtts";
  } else {
    // elevenlabs placeholder or openai without key falls through to gtts
    path = await synthesizeGTTS(cleanText);
    provider = config.provider;
  }

  let size = 0;
  try {
    const { statSync } = await import("node:fs");
    size = statSync(path).size;
  } catch {
    // size stays 0
  }

  return {
    type: "speech",
    path,
    mimeType: "audio/ogg",
    size,
    provider,
    prompt: request.prompt,
  };
}

/**
 * Backward-compatible wrapper for callers that only need the path.
 * Returns null if TTS is disabled, empty prompt, or synthesis fails.
 */
export async function synthesizeSpeech(
  text: string,
  config: { provider: "openai" | "gtts" | "off"; openaiApiKey?: string; voice?: string },
): Promise<string | null> {
  try {
    const result = await generateSpeech(
      { type: "speech", prompt: text },
      { ...config, provider: config.provider === "off" ? "off" : config.provider },
    );
    return result?.path ?? null;
  } catch (err) {
    logger.error({ err, provider: config.provider }, "TTS synthesis failed");
    return null;
  }
}

/**
 * OpenAI TTS API — outputs opus directly, no ffmpeg needed.
 */
async function synthesizeOpenAI(text: string, config: TTSConfig): Promise<string> {
  const voice = config.voice ?? "onyx";

  const response = await fetch("https://api.openai.com/v1/audio/speech", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.openaiApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "tts-1",
      input: text,
      voice,
      response_format: "opus",
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`OpenAI TTS API error ${response.status}: ${body}`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  return saveMediaFile(buffer, ".ogg");
}

/**
 * gTTS (Google Translate TTS) — free, uses Python + ffmpeg for ogg conversion.
 */
async function synthesizeGTTS(text: string): Promise<string> {
  const id = randomUUID();
  const inputPath = join("/tmp", `tts-input-${id}.txt`);
  const mp3Path = join("/tmp", `tts-output-${id}.mp3`);
  const oggPath = join("/tmp", `tts-output-${id}.ogg`);

  try {
    // Write text to temp file to avoid shell escaping issues
    writeFileSync(inputPath, text, "utf-8");

    // Generate mp3 with gTTS
    execSync(
      `python3 -c "from gtts import gTTS; tts = gTTS(open('${inputPath}').read(), lang='en', tld='co.uk'); tts.save('${mp3Path}')"`,
      { timeout: 30_000 },
    );

    // Convert to ogg/opus for Telegram voice notes
    execSync(`ffmpeg -y -i "${mp3Path}" -c:a libopus -b:a 48k "${oggPath}"`, {
      timeout: 15_000,
      stdio: "pipe",
    });

    const buffer = readFileSync(oggPath);
    return saveMediaFile(buffer, ".ogg");
  } finally {
    // Clean up temp files
    for (const p of [inputPath, mp3Path, oggPath]) {
      try {
        if (existsSync(p)) unlinkSync(p);
      } catch {
        /* ignore */
      }
    }
  }
}

/**
 * Strip markdown formatting for cleaner TTS output.
 */
function stripMarkdown(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, "")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/\*(.+?)\*/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/<[^>]+>/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
