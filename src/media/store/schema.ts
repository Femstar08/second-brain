import type { Database } from "../../db.js";

export const MEDIA_FILES_SQL = `
  CREATE TABLE IF NOT EXISTS media_files (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT NOT NULL,
    source TEXT NOT NULL,
    path TEXT NOT NULL,
    mime_type TEXT,
    size INTEGER,
    description TEXT,
    chat_id TEXT,
    drive_file_id TEXT,
    tags TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    archived_at TEXT
  );

  CREATE INDEX IF NOT EXISTS idx_media_type ON media_files(type);
  CREATE INDEX IF NOT EXISTS idx_media_chat ON media_files(chat_id);
  CREATE INDEX IF NOT EXISTS idx_media_created ON media_files(created_at);

  CREATE VIRTUAL TABLE IF NOT EXISTS media_files_fts USING fts5(
    description, tags, content=media_files, content_rowid=id
  );

  CREATE TRIGGER IF NOT EXISTS media_files_ai AFTER INSERT ON media_files BEGIN
    INSERT INTO media_files_fts(rowid, description, tags)
    VALUES (new.id, new.description, new.tags);
  END;

  CREATE TRIGGER IF NOT EXISTS media_files_ad AFTER DELETE ON media_files BEGIN
    INSERT INTO media_files_fts(media_files_fts, rowid, description, tags)
    VALUES ('delete', old.id, old.description, old.tags);
  END;

  CREATE TRIGGER IF NOT EXISTS media_files_au AFTER UPDATE ON media_files BEGIN
    INSERT INTO media_files_fts(media_files_fts, rowid, description, tags)
    VALUES ('delete', old.id, old.description, old.tags);
    INSERT INTO media_files_fts(rowid, description, tags)
    VALUES (new.id, new.description, new.tags);
  END;
`;

export function initMediaSchema(db: Database): void {
  db.exec(MEDIA_FILES_SQL);
}
