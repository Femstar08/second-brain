import type { Database } from "../../db.js";
import type { MediaRecord, MediaType } from "../types.js";

export { saveMediaFile, downloadAndSaveFile } from "./local.js";

// ---------- types ----------

export interface SaveMediaInput {
  type: MediaType;
  source: string;
  path: string;
  mimeType?: string | null;
  size?: number | null;
  description?: string | null;
  chatId?: string | null;
  driveFileId?: string | null;
  tags?: string[];
}

export interface MediaFilter {
  type?: MediaType;
  chatId?: string;
  source?: string;
  limit?: number;
}

// ---------- helpers ----------

interface MediaRow {
  id: number;
  type: string;
  source: string;
  path: string;
  mime_type: string | null;
  size: number | null;
  description: string | null;
  chat_id: string | null;
  drive_file_id: string | null;
  tags: string | null;
  created_at: string;
  archived_at: string | null;
}

function rowToRecord(row: MediaRow): MediaRecord {
  return {
    id: row.id,
    type: row.type as MediaType,
    source: row.source as "inbound" | "generated",
    path: row.path,
    mimeType: row.mime_type,
    size: row.size,
    description: row.description,
    chatId: row.chat_id,
    driveFileId: row.drive_file_id,
    tags: row.tags ? (JSON.parse(row.tags) as string[]) : [],
    createdAt: row.created_at,
    archivedAt: row.archived_at,
  };
}

// ---------- operations ----------

export function saveMediaRecord(db: Database, input: SaveMediaInput): number {
  const result = db
    .prepare(
      `INSERT INTO media_files
        (type, source, path, mime_type, size, description, chat_id, drive_file_id, tags)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      input.type,
      input.source,
      input.path,
      input.mimeType ?? null,
      input.size ?? null,
      input.description ?? null,
      input.chatId ?? null,
      input.driveFileId ?? null,
      JSON.stringify(input.tags ?? []),
    );
  return result.lastInsertRowid as number;
}

export function getMediaRecord(db: Database, id: number): MediaRecord | null {
  const row = db
    .prepare("SELECT * FROM media_files WHERE id = ?")
    .get(id) as MediaRow | undefined;
  return row ? rowToRecord(row) : null;
}

export function queryMedia(db: Database, filter: MediaFilter = {}): MediaRecord[] {
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (filter.type) {
    conditions.push("type = ?");
    params.push(filter.type);
  }
  if (filter.chatId) {
    conditions.push("chat_id = ?");
    params.push(filter.chatId);
  }
  if (filter.source) {
    conditions.push("source = ?");
    params.push(filter.source);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  const limit = filter.limit ?? 50;
  params.push(limit);

  const rows = db
    .prepare(`SELECT * FROM media_files ${where} ORDER BY created_at DESC LIMIT ?`)
    .all(...params) as MediaRow[];

  return rows.map(rowToRecord);
}

export function searchMedia(db: Database, query: string): MediaRecord[] {
  const rows = db
    .prepare(
      `SELECT mf.* FROM media_files mf
       JOIN media_files_fts fts ON mf.id = fts.rowid
       WHERE media_files_fts MATCH ?
       ORDER BY rank`,
    )
    .all(query) as MediaRow[];
  return rows.map(rowToRecord);
}

export function updateMediaRecord(
  db: Database,
  id: number,
  updates: Partial<Omit<SaveMediaInput, "type" | "source" | "path">>,
): void {
  const fields: string[] = [];
  const params: unknown[] = [];

  if (updates.mimeType !== undefined) {
    fields.push("mime_type = ?");
    params.push(updates.mimeType);
  }
  if (updates.size !== undefined) {
    fields.push("size = ?");
    params.push(updates.size);
  }
  if (updates.description !== undefined) {
    fields.push("description = ?");
    params.push(updates.description);
  }
  if (updates.chatId !== undefined) {
    fields.push("chat_id = ?");
    params.push(updates.chatId);
  }
  if (updates.driveFileId !== undefined) {
    fields.push("drive_file_id = ?");
    params.push(updates.driveFileId);
  }
  if (updates.tags !== undefined) {
    fields.push("tags = ?");
    params.push(JSON.stringify(updates.tags));
  }

  if (fields.length === 0) return;

  params.push(id);
  db.prepare(`UPDATE media_files SET ${fields.join(", ")} WHERE id = ?`).run(...params);
}
