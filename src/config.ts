import { readFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// Get root
const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
export const PROJECT_ROOT = ROOT;

// Default to single monolithic instance paths
export let STORE_DIR = join(ROOT, "store");
export let MEMORY_DIR = join(ROOT, "memory");
export let SKILLS_DIR = join(ROOT, "skills");

/**
 * Configure dynamic profile paths to isolate the instance data.
 * Used for building a team of narrow agents. 
 */
export function setProfile(profileName: string): void {
  const profileDir = join(ROOT, "profiles", profileName);
  STORE_DIR = join(profileDir, "store");
  MEMORY_DIR = join(profileDir, "memory");
  SKILLS_DIR = join(profileDir, "skills");
  mkdirSync(profileDir, { recursive: true });
}

// Parse argv upfront to configure the profile before loadConfig runs
const profileArgIndex = process.argv.indexOf("--profile");
if (profileArgIndex !== -1 && process.argv.length > profileArgIndex + 1) {
  const profileName = process.argv[profileArgIndex + 1];
  setProfile(profileName);
}

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
    active?: string; // deprecated — all configured channels start automatically
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
