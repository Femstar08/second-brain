import { mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { initDatabase, type Database } from "../db.js";
import { saveMemory, searchMemories, runDecaySweep } from "./search.js";

const tmpDir = join(import.meta.dirname, "../../.test-tmp-search");

describe("memory search", () => {
  let db: Database;

  beforeEach(() => {
    mkdirSync(tmpDir, { recursive: true });
    db = initDatabase(join(tmpDir, "test.db"));
  });

  afterEach(() => {
    db.close();
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("saves and searches semantic memories", () => {
    saveMemory(db, "chat-1", "I prefer TypeScript over JavaScript", "semantic");
    saveMemory(db, "chat-1", "My name is Femi", "semantic");
    const results = searchMemories(db, "chat-1", "TypeScript");
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].content).toContain("TypeScript");
  });

  it("classifies messages into sectors", () => {
    saveMemory(db, "chat-1", "I always use Vim", "semantic");
    saveMemory(db, "chat-1", "The weather is nice today", "episodic");
    const all = db.prepare("SELECT sector FROM memories").all() as { sector: string }[];
    expect(all.map((r) => r.sector)).toContain("semantic");
    expect(all.map((r) => r.sector)).toContain("episodic");
  });

  it("decays old memories and deletes low-salience ones", () => {
    // Insert a memory with old timestamp and low salience
    const oldTime = Date.now() - 86_400_000 * 60; // 60 days ago
    db.prepare(
      `INSERT INTO memories (chat_id, content, sector, salience, created_at, accessed_at) VALUES (?, ?, ?, ?, ?, ?)`,
    ).run("chat-1", "ancient memory", "episodic", 0.05, oldTime, oldTime);

    runDecaySweep(db);

    const remaining = db.prepare("SELECT * FROM memories WHERE content = ?").get("ancient memory");
    expect(remaining).toBeUndefined(); // deleted because salience < 0.1
  });
});
