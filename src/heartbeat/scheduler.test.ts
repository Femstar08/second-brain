import { mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { initDatabase, type Database } from "../db.js";
import { computeNextRun, getDueTasks, createScheduledTask } from "./scheduler.js";

const tmpDir = join(import.meta.dirname, "../../.test-tmp-heartbeat");

describe("scheduler", () => {
  let db: Database;

  beforeEach(() => {
    mkdirSync(tmpDir, { recursive: true });
    db = initDatabase(join(tmpDir, "test.db"));
  });

  afterEach(() => {
    db.close();
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("computes next cron run", () => {
    const next = computeNextRun("*/30 * * * *");
    expect(next).toBeGreaterThan(Date.now() / 1000);
  });

  it("creates and retrieves due tasks", () => {
    const pastTime = Math.floor(Date.now() / 1000) - 60;
    createScheduledTask(db, {
      chatId: "chat-1",
      prompt: "Check emails",
      schedule: "*/30 * * * *",
      nextRun: pastTime,
    });

    const due = getDueTasks(db);
    expect(due).toHaveLength(1);
    expect(due[0].prompt).toBe("Check emails");
  });

  it("does not return future tasks", () => {
    const futureTime = Math.floor(Date.now() / 1000) + 3600;
    createScheduledTask(db, {
      chatId: "chat-1",
      prompt: "Future task",
      schedule: "0 9 * * *",
      nextRun: futureTime,
    });

    const due = getDueTasks(db);
    expect(due).toHaveLength(0);
  });
});
