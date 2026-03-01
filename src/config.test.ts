import { writeFileSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect, afterEach } from "vitest";
import { loadConfig } from "./config.js";

const tmpDir = join(import.meta.dirname, "..", ".test-tmp-config");

describe("loadConfig", () => {
  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("returns defaults when no config file exists", () => {
    const cfg = loadConfig(join(tmpDir, "nope.json"));
    expect(cfg.provider).toBe("claude");
    expect(cfg.heartbeat.enabled).toBe(true);
    expect(cfg.heartbeat.intervalMinutes).toBe(30);
    expect(cfg.memory.mode).toBe("full");
  });

  it("merges user config over defaults", () => {
    mkdirSync(tmpDir, { recursive: true });
    const cfgPath = join(tmpDir, "config.json");
    writeFileSync(
      cfgPath,
      JSON.stringify({ provider: "codex", heartbeat: { intervalMinutes: 15 } }),
    );
    const cfg = loadConfig(cfgPath);
    expect(cfg.provider).toBe("codex");
    expect(cfg.heartbeat.intervalMinutes).toBe(15);
    expect(cfg.heartbeat.enabled).toBe(true); // default preserved
  });
});
