import { mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { initDatabase, type Database } from "../../db.js";

const tmpDir = join(import.meta.dirname, "..", "..", "..", ".test-tmp-media-schema");

describe("media schema", () => {
  let db: Database;

  beforeEach(() => {
    mkdirSync(tmpDir, { recursive: true });
    db = initDatabase(join(tmpDir, "test.db"));
  });

  afterEach(() => {
    db.close();
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("creates media_files table", () => {
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as {
      name: string;
    }[];
    const names = tables.map((t) => t.name);
    expect(names).toContain("media_files");
  });

  it("creates media_files_fts virtual table", () => {
    const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as {
      name: string;
    }[];
    const names = tables.map((t) => t.name);
    expect(names).toContain("media_files_fts");
  });

  it("insert trigger populates FTS", () => {
    db.prepare(
      "INSERT INTO media_files (type, source, path, description, tags) VALUES (?, ?, ?, ?, ?)",
    ).run("image", "telegram", "/tmp/a.jpg", "a cat photo", '["cat","photo"]');

    const row = db
      .prepare("SELECT rowid FROM media_files_fts WHERE media_files_fts MATCH 'cat'")
      .get() as { rowid: number } | undefined;
    expect(row).toBeDefined();
  });

  it("update trigger refreshes FTS", () => {
    const info = db
      .prepare(
        "INSERT INTO media_files (type, source, path, description, tags) VALUES (?, ?, ?, ?, ?)",
      )
      .run("image", "telegram", "/tmp/b.jpg", "old description", "[]");
    const id = info.lastInsertRowid;

    db.prepare("UPDATE media_files SET description = ? WHERE id = ?").run("new description", id);

    const oldMatch = db
      .prepare("SELECT rowid FROM media_files_fts WHERE media_files_fts MATCH 'old'")
      .get();
    expect(oldMatch).toBeUndefined();

    const newMatch = db
      .prepare("SELECT rowid FROM media_files_fts WHERE media_files_fts MATCH 'new'")
      .get() as { rowid: number } | undefined;
    expect(newMatch).toBeDefined();
  });

  it("delete trigger removes FTS entry", () => {
    const info = db
      .prepare(
        "INSERT INTO media_files (type, source, path, description, tags) VALUES (?, ?, ?, ?, ?)",
      )
      .run("image", "telegram", "/tmp/c.jpg", "delete me", "[]");
    const id = info.lastInsertRowid;

    db.prepare("DELETE FROM media_files WHERE id = ?").run(id);

    const match = db
      .prepare("SELECT rowid FROM media_files_fts WHERE media_files_fts MATCH 'delete'")
      .get();
    expect(match).toBeUndefined();
  });
});
