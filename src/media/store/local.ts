import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { STORE_DIR } from "../../config.js";

function getMediaDir(): string {
  const today = new Date().toISOString().split("T")[0];
  const dir = join(STORE_DIR, "media", today);
  mkdirSync(dir, { recursive: true });
  return dir;
}

export function saveMediaFile(buffer: Buffer, ext: string): string {
  const dir = getMediaDir();
  const filename = `${randomUUID()}${ext}`;
  const filepath = join(dir, filename);
  writeFileSync(filepath, buffer);
  return filepath;
}

export async function downloadAndSaveFile(url: string, ext: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Download failed: ${res.status}`);
  const buffer = Buffer.from(await res.arrayBuffer());
  return saveMediaFile(buffer, ext);
}
