import { readFileSync } from "node:fs";

/**
 * Parse a .env file into a key-value record WITHOUT polluting process.env.
 * This is critical because Claude/Codex subprocesses inherit process.env.
 */
export function readEnvFile(filePath: string, keys?: string[]): Record<string, string> {
  let content: string;
  try {
    content = readFileSync(filePath, "utf-8");
  } catch {
    return {};
  }

  const result: Record<string, string> = {};

  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) {
      continue;
    }

    const key = trimmed.slice(0, eqIdx).trim();
    let value = trimmed.slice(eqIdx + 1).trim();

    // Strip surrounding quotes (double or single)
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (keys && !keys.includes(key)) {
      continue;
    }
    result[key] = value;
  }

  return result;
}
