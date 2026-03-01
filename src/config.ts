import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const PROJECT_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
export const STORE_DIR = join(PROJECT_ROOT, "store");
export const MEMORY_DIR = join(PROJECT_ROOT, "memory");
export const SKILLS_DIR = join(PROJECT_ROOT, "skills");

export interface SecondBrainConfig {
  provider: string;
  onboarded: boolean;
  providers: {
    claude: Record<string, unknown>;
    codex: Record<string, unknown>;
    openai: { apiKey?: string; model?: string };
    openrouter: { apiKey?: string; model?: string };
    ollama: { model?: string; baseUrl?: string };
  };
  channels: {
    active: string;
    web: { port: number; host: string };
    telegram: { botToken?: string; allowedChatIds?: string[] };
    slack: { botToken?: string; appToken?: string; allowedUserIds?: string[] };
    discord: { botToken?: string; allowedUserIds?: string[] };
  };
  heartbeat: {
    enabled: boolean;
    intervalMinutes: number;
    activeHours: { start: string; end: string };
  };
  memory: {
    mode: "full" | "simple" | "none";
    embeddings: { enabled: boolean; provider: string };
  };
}

const DEFAULTS: SecondBrainConfig = {
  provider: "claude",
  onboarded: false,
  providers: {
    claude: {},
    codex: {},
    openai: { model: "gpt-4o" },
    openrouter: { model: "anthropic/claude-sonnet-4-6" },
    ollama: { model: "llama3.1", baseUrl: "http://localhost:11434" },
  },
  channels: {
    active: "cli",
    web: { port: 3000, host: "localhost" },
    telegram: {},
    slack: {},
    discord: {},
  },
  heartbeat: {
    enabled: true,
    intervalMinutes: 30,
    activeHours: { start: "08:00", end: "22:00" },
  },
  memory: {
    mode: "full",
    embeddings: { enabled: false, provider: "openai" },
  },
};

export function loadConfig(configPath?: string): SecondBrainConfig {
  const path = configPath ?? join(PROJECT_ROOT, "config.json");
  let userConfig: Record<string, unknown> = {};
  try {
    userConfig = JSON.parse(readFileSync(path, "utf-8"));
  } catch {
    // no config file -- use defaults
  }
  return deepMerge(
    DEFAULTS as unknown as Record<string, unknown>,
    userConfig,
  ) as unknown as SecondBrainConfig;
}

function deepMerge(
  target: Record<string, unknown>,
  source: Record<string, unknown>,
): Record<string, unknown> {
  const result = { ...target };
  for (const key of Object.keys(source)) {
    if (
      source[key] &&
      typeof source[key] === "object" &&
      !Array.isArray(source[key]) &&
      target[key] &&
      typeof target[key] === "object" &&
      !Array.isArray(target[key])
    ) {
      result[key] = deepMerge(
        target[key] as Record<string, unknown>,
        source[key] as Record<string, unknown>,
      );
    } else {
      result[key] = source[key];
    }
  }
  return result;
}
