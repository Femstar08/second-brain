import { writeFileSync, mkdirSync, rmSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { loadAlwaysContext, appendDailyLog } from "./index.js";

const tmpDir = join(import.meta.dirname, "../../.test-tmp-memory");

describe("memory", () => {
  beforeEach(() => {
    mkdirSync(join(tmpDir, "daily"), { recursive: true });
    writeFileSync(join(tmpDir, "soul.md"), "# Soul\nBe helpful.");
    writeFileSync(join(tmpDir, "user.md"), "# User\nName: Test");
    writeFileSync(join(tmpDir, "memory.md"), "# Memory\nLikes coffee.");
    writeFileSync(join(tmpDir, "agent.md"), "# Agent\nRules here.");
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("loads all always-context files", () => {
    const ctx = loadAlwaysContext(tmpDir);
    expect(ctx).toContain("Be helpful");
    expect(ctx).toContain("Name: Test");
    expect(ctx).toContain("Likes coffee");
    expect(ctx).toContain("Rules here");
  });

  it("includes today daily log if it exists", () => {
    const today = new Date().toISOString().slice(0, 10);
    writeFileSync(join(tmpDir, "daily", `${today}.md`), "## Today\nHad a meeting.");
    const ctx = loadAlwaysContext(tmpDir);
    expect(ctx).toContain("Had a meeting");
  });

  it("appends to daily log", () => {
    appendDailyLog(tmpDir, "user", "Hello there");
    appendDailyLog(tmpDir, "assistant", "Hi! How can I help?");
    const today = new Date().toISOString().slice(0, 10);
    const content = readFileSync(join(tmpDir, "daily", `${today}.md`), "utf-8");
    expect(content).toContain("Hello there");
    expect(content).toContain("Hi! How can I help?");
  });
});
