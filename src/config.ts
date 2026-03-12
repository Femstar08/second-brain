import { readFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { ConfigSchema } from "./config/schema.js";

export type { SecondBrainConfig } from "./config/schema.js";

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

export function loadConfig(configPath?: string) {
  const path = configPath ?? join(PROJECT_ROOT, "config.json");
  let userConfig: Record<string, unknown> = {};
  try {
    userConfig = JSON.parse(readFileSync(path, "utf-8"));
  } catch {
    // no config file -- use defaults
  }
  return ConfigSchema.parse(userConfig);
}
