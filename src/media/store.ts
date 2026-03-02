import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { PROJECT_ROOT } from "../config.js";

const MEDIA_DIR = join(PROJECT_ROOT, "store", "media");

export function getMediaDir(): string {
  mkdirSync(MEDIA_DIR, { recursive: true });
  return MEDIA_DIR;
}

export function saveMedia(buffer: Buffer, ext: string): string {
  const dir = getMediaDir();
  const filename = `${randomUUID()}${ext}`;
  const filepath = join(dir, filename);
  writeFileSync(filepath, buffer);
  return filepath;
}

export async function downloadAndSave(url: string, ext: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Download failed: ${res.status}`);
  }
  const buffer = Buffer.from(await res.arrayBuffer());
  return saveMedia(buffer, ext);
}
