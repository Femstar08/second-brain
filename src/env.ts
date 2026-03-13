import { existsSync, readFileSync, writeFileSync } from "node:fs";

/**
 * Maps env var names to their config.json paths for sensitive tokens.
 * Used for migration, masking, and stripping tokens from config responses.
 */
export const SENSITIVE_TOKEN_MAP: Record<string, string[]> = {
  ANTHROPIC_API_KEY: ["providers", "anthropic", "apiKey"],
  OPENAI_API_KEY: ["providers", "openai", "apiKey"],
  OPENROUTER_API_KEY: ["providers", "openrouter", "apiKey"],
  TELEGRAM_BOT_TOKEN: ["channels", "telegram", "botToken"],
  SLACK_BOT_TOKEN: ["channels", "slack", "botToken"],
  SLACK_APP_TOKEN: ["channels", "slack", "appToken"],
  DISCORD_BOT_TOKEN: ["channels", "discord", "botToken"],
};

/** Mask a token for display: first 5 chars + "***", or just "***" if short. */
export function maskToken(value: string): string {
  if (!value) {
    return "***";
  }
  if (value.length <= 8) {
    return "***";
  }
  return value.slice(0, 5) + "***";
}

/** Read a nested value from an object using a path array. */
export function getNestedValue(obj: Record<string, unknown>, path: string[]): unknown {
  let current: unknown = obj;
  for (const key of path) {
    if (current == null || typeof current !== "object") {
      return undefined;
    }
    current = (current as Record<string, unknown>)[key];
  }
  return current;
}

/** Delete a nested value from an object using a path array. Returns true if deleted. */
export function deleteNestedValue(obj: Record<string, unknown>, path: string[]): boolean {
  if (path.length === 0) {
    return false;
  }
  let current: unknown = obj;
  for (let i = 0; i < path.length - 1; i++) {
    if (current == null || typeof current !== "object") {
      return false;
    }
    current = (current as Record<string, unknown>)[path[i]];
  }
  if (current == null || typeof current !== "object") {
    return false;
  }
  const lastKey = path[path.length - 1];
  if (lastKey in (current as Record<string, unknown>)) {
    delete (current as Record<string, unknown>)[lastKey];
    return true;
  }
  return false;
}

/**
 * Write or update a single key in a .env file, preserving comments and other keys.
 * Creates the file if it doesn't exist.
 */
export function writeEnvValue(filePath: string, key: string, value: string): void {
  let lines: string[] = [];
  if (existsSync(filePath)) {
    lines = readFileSync(filePath, "utf-8").split("\n");
  }

  let found = false;
  const newLine = `${key}=${value}`;
  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) {
      continue;
    }
    const lineKey = trimmed.slice(0, eqIdx).trim();
    if (lineKey === key) {
      lines[i] = newLine;
      found = true;
      break;
    }
  }

  if (!found) {
    // Append; ensure there's a newline before if file doesn't end with one
    if (lines.length > 0 && lines[lines.length - 1] !== "") {
      lines.push(newLine);
    } else if (lines.length > 0) {
      // Last line is empty — insert before trailing newline
      lines.splice(lines.length - 1, 0, newLine);
    } else {
      lines.push(newLine, "");
    }
  }

  writeFileSync(filePath, lines.join("\n"));
}

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
