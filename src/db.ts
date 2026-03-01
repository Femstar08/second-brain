import BetterSqlite3 from "better-sqlite3";

export type Database = BetterSqlite3.Database;

export function initDatabase(dbPath: string): Database {
  const db = new BetterSqlite3(dbPath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");

  db.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      chat_id TEXT NOT NULL,
      provider TEXT NOT NULL,
      session_id TEXT NOT NULL,
      updated_at INTEGER NOT NULL,
      PRIMARY KEY (chat_id, provider)
    );

    CREATE TABLE IF NOT EXISTS memories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      chat_id TEXT NOT NULL,
      content TEXT NOT NULL,
      sector TEXT NOT NULL CHECK(sector IN ('semantic','episodic')),
      salience REAL NOT NULL DEFAULT 1.0,
      created_at INTEGER NOT NULL,
      accessed_at INTEGER NOT NULL
    );

    CREATE VIRTUAL TABLE IF NOT EXISTS memories_fts USING fts5(
      content,
      content=memories,
      content_rowid=id
    );

    CREATE TRIGGER IF NOT EXISTS memories_ai AFTER INSERT ON memories BEGIN
      INSERT INTO memories_fts(rowid, content) VALUES (new.id, new.content);
    END;

    CREATE TRIGGER IF NOT EXISTS memories_ad AFTER DELETE ON memories BEGIN
      INSERT INTO memories_fts(memories_fts, rowid, content) VALUES('delete', old.id, old.content);
    END;

    CREATE TRIGGER IF NOT EXISTS memories_au AFTER UPDATE ON memories BEGIN
      INSERT INTO memories_fts(memories_fts, rowid, content) VALUES('delete', old.id, old.content);
      INSERT INTO memories_fts(rowid, content) VALUES (new.id, new.content);
    END;

    CREATE TABLE IF NOT EXISTS scheduled_tasks (
      id TEXT PRIMARY KEY,
      chat_id TEXT NOT NULL,
      prompt TEXT NOT NULL,
      schedule TEXT NOT NULL,
      next_run INTEGER NOT NULL,
      last_run INTEGER,
      last_result TEXT,
      status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','paused')),
      created_at INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_tasks_due ON scheduled_tasks(status, next_run);
  `);

  return db;
}

export function getSession(db: Database, chatId: string, provider: string): string | null {
  const row = db
    .prepare("SELECT session_id FROM sessions WHERE chat_id = ? AND provider = ?")
    .get(chatId, provider) as { session_id: string } | undefined;
  return row?.session_id ?? null;
}

export function setSession(
  db: Database,
  chatId: string,
  provider: string,
  sessionId: string,
): void {
  db.prepare(
    `INSERT INTO sessions (chat_id, provider, session_id, updated_at)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(chat_id, provider) DO UPDATE SET session_id = excluded.session_id, updated_at = excluded.updated_at`,
  ).run(chatId, provider, sessionId, Date.now());
}

export function clearSession(db: Database, chatId: string): void {
  db.prepare("DELETE FROM sessions WHERE chat_id = ?").run(chatId);
}
