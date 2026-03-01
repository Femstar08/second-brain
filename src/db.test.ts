import { mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { initDatabase, getSession, setSession, clearSession, type Database } from "./db.js";

const tmpDir = join(import.meta.dirname, "..", ".test-tmp-db");

describe("database", () => {
  let db: Database;

  beforeEach(() => {
    mkdirSync(tmpDir, { recursive: true });
    db = initDatabase(join(tmpDir, "test.db"));
  });

  afterEach(() => {
    db.close();
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("creates tables on init", () => {
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as {
      name: string;
    }[];
    const names = tables.map((t) => t.name);
    expect(names).toContain("sessions");
    expect(names).toContain("memories");
    expect(names).toContain("scheduled_tasks");
  });

  it("stores and retrieves sessions", () => {
    setSession(db, "chat-1", "claude", "session-abc");
    const session = getSession(db, "chat-1", "claude");
    expect(session).toBe("session-abc");
  });

  it("updates existing session", () => {
    setSession(db, "chat-1", "claude", "session-1");
    setSession(db, "chat-1", "claude", "session-2");
    expect(getSession(db, "chat-1", "claude")).toBe("session-2");
  });

  it("clears session", () => {
    setSession(db, "chat-1", "claude", "session-abc");
    clearSession(db, "chat-1");
    expect(getSession(db, "chat-1", "claude")).toBeNull();
  });

  it("returns null for unknown session", () => {
    expect(getSession(db, "nope", "claude")).toBeNull();
  });
});
