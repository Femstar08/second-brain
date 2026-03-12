# Media Pipeline Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add full media literacy to second-brain — understand incoming media (images, audio, video, URLs, documents), generate outgoing media (speech, images), and persist/recall media as searchable memory with Google Drive archival.

**Architecture:** Three subsystems under `src/media/`: `ingest/` (process incoming), `generate/` (create outgoing), `store/` (persist + recall). All share a common set of types in `src/media/types.ts` and a `media_files` SQLite table for metadata. The agent orchestrates between them.

**Tech Stack:** TypeScript, better-sqlite3 (FTS5), ffmpeg (video), Whisper (transcription), OpenAI API (vision, DALL-E, Whisper API), googleapis (Drive archival), @mozilla/readability + jsdom (URL extraction), vitest (tests)

**Spec:** `docs/superpowers/specs/2026-03-12-media-pipeline-design.md`

---

## Chunk 1: Foundation (Types, Config, Store, Schema)

### Task 1: Extend types and add config schema

**Files:**
- Modify: `src/media/types.ts`
- Modify: `src/config/schema.ts`
- Modify: `src/config.test.ts`

- [ ] **Step 1: Write failing test for new config**

Add to `src/config.test.ts`:

```typescript
it("returns media defaults when no media config provided", () => {
  const cfg = loadConfig(join(tmpDir, "nope.json"));
  expect(cfg.media.ingest.visionProvider).toBe("claude");
  expect(cfg.media.ingest.transcriptionProvider).toBe("whisper-local");
  expect(cfg.media.generate.imageProvider).toBe("dall-e");
  expect(cfg.media.generate.ttsProvider).toBe("gtts");
  expect(cfg.media.store.archiveDays).toBe(7);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/config.test.ts`
Expected: FAIL — `cfg.media` is undefined

- [ ] **Step 3: Update types.ts with new types**

Replace the contents of `src/media/types.ts` with the full type definitions from the spec:

```typescript
export type MediaType = "image" | "audio" | "video" | "document" | "url";

export interface MediaAttachment {
  type: MediaType;
  path: string;
  mimeType: string;
  originalName?: string;
  transcription?: string;
  extractedText?: string;
}

export interface ProcessedMedia {
  type: MediaType;
  description: string;
  extractedText?: string;
  sourcePath: string;
  metadata: {
    mimeType: string;
    size?: number;
    originalName?: string;
    duration?: number;
    dimensions?: { width: number; height: number };
  };
  error?: string;
}

export interface GenerateRequest {
  type: "speech" | "image" | "video";
  prompt: string;
  provider?: string;
  options?: Record<string, unknown>;
}

export interface GeneratedMedia {
  type: "speech" | "image" | "video";
  path: string;
  mimeType: string;
  size: number;
  provider: string;
  prompt: string;
}

export interface MediaRecord {
  id: number;
  type: MediaType;
  source: "inbound" | "generated";
  path: string;
  mimeType: string | null;
  size: number | null;
  description: string | null;
  chatId: string | null;
  driveFileId: string | null;
  tags: string[];
  createdAt: string;
  archivedAt: string | null;
}
```

- [ ] **Step 4: Add media section to ConfigSchema**

In `src/config/schema.ts`, add the `media` property to the `ConfigSchema` object (before the closing of `z.object`):

```typescript
media: z.object({
  ingest: z.object({
    visionProvider: z.enum(["claude", "openai"]).default("claude"),
    transcriptionProvider: z.enum(["whisper-local", "whisper-api", "deepgram"]).default("whisper-local"),
    videoKeyframeInterval: z.number().default(5),
  }).default({ visionProvider: "claude", transcriptionProvider: "whisper-local", videoKeyframeInterval: 5 }),
  generate: z.object({
    imageProvider: z.enum(["dall-e", "flux", "nanobanana"]).default("dall-e"),
    ttsProvider: z.enum(["gtts", "openai", "elevenlabs", "off"]).default("gtts"),
    ttsVoice: z.string().default("onyx"),
  }).default({ imageProvider: "dall-e", ttsProvider: "gtts", ttsVoice: "onyx" }),
  store: z.object({
    archiveDays: z.number().default(7),
    localRetentionDays: z.number().default(30),
    archiveDeleteLocal: z.boolean().default(false),
    driveFolderName: z.string().default("second-brain-media"),
    driveAccount: z.enum(["personal", "business"]).default("personal"),
  }).default({
    archiveDays: 7,
    localRetentionDays: 30,
    archiveDeleteLocal: false,
    driveFolderName: "second-brain-media",
    driveAccount: "personal",
  }),
}).default({
  ingest: { visionProvider: "claude", transcriptionProvider: "whisper-local", videoKeyframeInterval: 5 },
  generate: { imageProvider: "dall-e", ttsProvider: "gtts", ttsVoice: "onyx" },
  store: { archiveDays: 7, localRetentionDays: 30, archiveDeleteLocal: false, driveFolderName: "second-brain-media", driveAccount: "personal" },
}),
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/config.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/media/types.ts src/config/schema.ts src/config.test.ts
git commit -m "feat(media): extend types and add media config schema"
```

---

### Task 2: Media store schema (SQLite)

**Files:**
- Create: `src/media/store/schema.ts`
- Modify: `src/db.ts`
- Create: `src/media/store/schema.test.ts`

- [ ] **Step 1: Write failing test**

Create `src/media/store/schema.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import BetterSqlite3 from "better-sqlite3";
import { initDatabase } from "../../db.js";

describe("media_files schema", () => {
  let db: BetterSqlite3.Database;

  beforeEach(() => {
    db = initDatabase(":memory:");
  });

  afterEach(() => {
    db.close();
  });

  it("creates media_files table", () => {
    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='media_files'")
      .all();
    expect(tables).toHaveLength(1);
  });

  it("creates FTS table for media_files", () => {
    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='media_files_fts'")
      .all();
    expect(tables).toHaveLength(1);
  });

  it("auto-populates FTS on insert", () => {
    db.prepare(
      `INSERT INTO media_files (type, source, path, description, tags)
       VALUES ('image', 'inbound', '/tmp/test.jpg', 'a sunset over the ocean', '["nature","sunset"]')`
    ).run();

    const results = db
      .prepare("SELECT * FROM media_files_fts WHERE media_files_fts MATCH 'sunset'")
      .all();
    expect(results).toHaveLength(1);
  });

  it("updates FTS on record update", () => {
    db.prepare(
      `INSERT INTO media_files (type, source, path, description, tags)
       VALUES ('image', 'inbound', '/tmp/test.jpg', 'a sunset', '[]')`
    ).run();

    db.prepare(
      `UPDATE media_files SET description = 'a mountain landscape' WHERE id = 1`
    ).run();

    const oldResults = db
      .prepare("SELECT * FROM media_files_fts WHERE media_files_fts MATCH 'sunset'")
      .all();
    expect(oldResults).toHaveLength(0);

    const newResults = db
      .prepare("SELECT * FROM media_files_fts WHERE media_files_fts MATCH 'mountain'")
      .all();
    expect(newResults).toHaveLength(1);
  });

  it("removes FTS entry on delete", () => {
    db.prepare(
      `INSERT INTO media_files (type, source, path, description, tags)
       VALUES ('image', 'inbound', '/tmp/test.jpg', 'a sunset', '[]')`
    ).run();

    db.prepare("DELETE FROM media_files WHERE id = 1").run();

    const results = db
      .prepare("SELECT * FROM media_files_fts WHERE media_files_fts MATCH 'sunset'")
      .all();
    expect(results).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/media/store/schema.test.ts`
Expected: FAIL — media_files table doesn't exist

- [ ] **Step 3: Create schema.ts**

Create `src/media/store/schema.ts`:

```typescript
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
```

- [ ] **Step 4: Wire schema into db.ts**

In `src/db.ts`, add at the top:

```typescript
import { initMediaSchema } from "./media/store/schema.js";
```

At the end of `initDatabase`, before `return db;`, add:

```typescript
  initMediaSchema(db);
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/media/store/schema.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/media/store/schema.ts src/media/store/schema.test.ts src/db.ts
git commit -m "feat(media): add media_files schema with FTS5 triggers"
```

---

### Task 3: Media store operations

**Files:**
- Create: `src/media/store/index.ts`
- Create: `src/media/store/local.ts`
- Create: `src/media/store/index.test.ts`

- [ ] **Step 1: Write failing test**

Create `src/media/store/index.test.ts`:

```typescript
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import BetterSqlite3 from "better-sqlite3";
import { initDatabase } from "../../db.js";
import { saveMediaRecord, queryMedia, searchMedia, getMediaRecord } from "./index.js";

describe("media store", () => {
  let db: BetterSqlite3.Database;

  beforeEach(() => {
    db = initDatabase(":memory:");
  });

  afterEach(() => {
    db.close();
  });

  it("saves and retrieves a media record", () => {
    const id = saveMediaRecord(db, {
      type: "image",
      source: "inbound",
      path: "/tmp/test.jpg",
      mimeType: "image/jpeg",
      size: 12345,
      description: "a sunset over the ocean",
      chatId: "chat-1",
      tags: ["nature", "sunset"],
    });

    const record = getMediaRecord(db, id);
    expect(record).toBeDefined();
    expect(record!.type).toBe("image");
    expect(record!.description).toBe("a sunset over the ocean");
    expect(record!.tags).toEqual(["nature", "sunset"]);
    expect(record!.chatId).toBe("chat-1");
  });

  it("queries media by type and chatId", () => {
    saveMediaRecord(db, { type: "image", source: "inbound", path: "/a.jpg", chatId: "chat-1", tags: [] });
    saveMediaRecord(db, { type: "audio", source: "inbound", path: "/b.ogg", chatId: "chat-1", tags: [] });
    saveMediaRecord(db, { type: "image", source: "inbound", path: "/c.jpg", chatId: "chat-2", tags: [] });

    const images = queryMedia(db, { type: "image", chatId: "chat-1" });
    expect(images).toHaveLength(1);
    expect(images[0].path).toBe("/a.jpg");
  });

  it("searches media via FTS", () => {
    saveMediaRecord(db, { type: "image", source: "inbound", path: "/a.jpg", description: "a beautiful sunset", tags: [] });
    saveMediaRecord(db, { type: "image", source: "inbound", path: "/b.jpg", description: "a mountain landscape", tags: [] });

    const results = searchMedia(db, "sunset");
    expect(results).toHaveLength(1);
    expect(results[0].path).toBe("/a.jpg");
  });

  it("searches media by tags via FTS", () => {
    saveMediaRecord(db, { type: "image", source: "inbound", path: "/a.jpg", description: "photo", tags: ["vacation", "beach"] });

    const results = searchMedia(db, "beach");
    expect(results).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/media/store/index.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Create store/local.ts**

Create `src/media/store/local.ts` — relocate and extend existing `src/media/store.ts`:

```typescript
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { STORE_DIR } from "../../config.js";

function getMediaDir(): string {
  const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
  const dir = join(STORE_DIR, "media", today);
  mkdirSync(dir, { recursive: true });
  return dir;
}

export function saveMediaFile(buffer: Buffer, ext: string): string {
  const dir = getMediaDir();
  const filename = `${randomUUID()}${ext}`;
  const filepath = join(dir, filename);
  writeFileSync(filepath, buffer);
  return filepath;
}

export async function downloadAndSaveFile(url: string, ext: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Download failed: ${res.status}`);
  }
  const buffer = Buffer.from(await res.arrayBuffer());
  return saveMediaFile(buffer, ext);
}
```

- [ ] **Step 4: Create store/index.ts**

Create `src/media/store/index.ts`:

```typescript
import type { Database } from "../../db.js";
import type { MediaRecord, MediaType } from "../types.js";

export { saveMediaFile, downloadAndSaveFile } from "./local.js";

interface SaveMediaInput {
  type: MediaType;
  source: "inbound" | "generated";
  path: string;
  mimeType?: string;
  size?: number;
  description?: string;
  chatId?: string;
  tags: string[];
}

interface QueryMediaFilter {
  type?: MediaType;
  chatId?: string;
  source?: "inbound" | "generated";
  limit?: number;
}

function rowToRecord(row: any): MediaRecord {
  return {
    id: row.id,
    type: row.type,
    source: row.source,
    path: row.path,
    mimeType: row.mime_type,
    size: row.size,
    description: row.description,
    chatId: row.chat_id,
    driveFileId: row.drive_file_id,
    tags: row.tags ? JSON.parse(row.tags) : [],
    createdAt: row.created_at,
    archivedAt: row.archived_at,
  };
}

export function saveMediaRecord(db: Database, input: SaveMediaInput): number {
  const result = db.prepare(
    `INSERT INTO media_files (type, source, path, mime_type, size, description, chat_id, tags)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    input.type,
    input.source,
    input.path,
    input.mimeType ?? null,
    input.size ?? null,
    input.description ?? null,
    input.chatId ?? null,
    JSON.stringify(input.tags),
  );
  return Number(result.lastInsertRowid);
}

export function getMediaRecord(db: Database, id: number): MediaRecord | undefined {
  const row = db.prepare("SELECT * FROM media_files WHERE id = ?").get(id) as any;
  return row ? rowToRecord(row) : undefined;
}

export function queryMedia(db: Database, filter: QueryMediaFilter): MediaRecord[] {
  const conditions: string[] = [];
  const params: any[] = [];

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

  const rows = db
    .prepare(`SELECT * FROM media_files ${where} ORDER BY created_at DESC LIMIT ?`)
    .all(...params, limit) as any[];

  return rows.map(rowToRecord);
}

export function searchMedia(db: Database, query: string, limit = 20): MediaRecord[] {
  const rows = db
    .prepare(
      `SELECT m.* FROM media_files m
       JOIN media_files_fts fts ON m.id = fts.rowid
       WHERE media_files_fts MATCH ?
       ORDER BY rank
       LIMIT ?`
    )
    .all(query, limit) as any[];

  return rows.map(rowToRecord);
}

export function updateMediaRecord(
  db: Database,
  id: number,
  updates: Partial<Pick<MediaRecord, "description" | "driveFileId" | "archivedAt" | "path" | "tags">>,
): void {
  const sets: string[] = [];
  const params: any[] = [];

  if (updates.description !== undefined) { sets.push("description = ?"); params.push(updates.description); }
  if (updates.driveFileId !== undefined) { sets.push("drive_file_id = ?"); params.push(updates.driveFileId); }
  if (updates.archivedAt !== undefined) { sets.push("archived_at = ?"); params.push(updates.archivedAt); }
  if (updates.path !== undefined) { sets.push("path = ?"); params.push(updates.path); }
  if (updates.tags !== undefined) { sets.push("tags = ?"); params.push(JSON.stringify(updates.tags)); }

  if (sets.length === 0) return;

  params.push(id);
  db.prepare(`UPDATE media_files SET ${sets.join(", ")} WHERE id = ?`).run(...params);
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/media/store/index.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/media/store/index.ts src/media/store/local.ts src/media/store/index.test.ts
git commit -m "feat(media): add media store with save, query, FTS search"
```

---

## Chunk 2: Ingest Pipeline

### Task 4: Relocate existing processors to ingest/

**Files:**
- Create: `src/media/ingest/audio.ts`
- Create: `src/media/ingest/document.ts`
- Create: `src/media/ingest/audio.test.ts`
- Create: `src/media/ingest/document.test.ts`

- [ ] **Step 1: Write failing test for audio**

Create `src/media/ingest/audio.test.ts`:

```typescript
import { describe, it, expect, vi } from "vitest";
import { ingestAudio } from "./audio.js";
import type { MediaAttachment } from "../types.js";

// Mock child_process to avoid needing real whisper binary
vi.mock("node:child_process", () => ({
  execSync: vi.fn(() => ""),
}));

vi.mock("node:fs", async () => {
  const actual = await vi.importActual("node:fs");
  return {
    ...actual,
    readFileSync: vi.fn((path: string) => {
      if (path.endsWith(".txt")) return "Hello this is a test transcription";
      return (actual as any).readFileSync(path);
    }),
  };
});

describe("ingestAudio", () => {
  it("returns ProcessedMedia with transcription", async () => {
    const attachment: MediaAttachment = {
      type: "audio",
      path: "/tmp/test.ogg",
      mimeType: "audio/ogg",
    };

    const result = await ingestAudio(attachment);
    expect(result.type).toBe("audio");
    expect(result.description).toBe("Hello this is a test transcription");
    expect(result.sourcePath).toBe("/tmp/test.ogg");
    expect(result.error).toBeUndefined();
  });

  it("returns error field on transcription failure", async () => {
    const { execSync } = await import("node:child_process");
    (execSync as any).mockImplementationOnce(() => { throw new Error("whisper not found"); });

    const attachment: MediaAttachment = {
      type: "audio",
      path: "/tmp/test.ogg",
      mimeType: "audio/ogg",
    };

    const result = await ingestAudio(attachment);
    expect(result.error).toBeDefined();
    expect(result.description).toContain("[Audio transcription failed]");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/media/ingest/audio.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Create ingest/audio.ts**

Create `src/media/ingest/audio.ts` — relocate from `processor.ts`:

```typescript
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { logger } from "../../logger.js";
import type { MediaAttachment, ProcessedMedia } from "../types.js";

function findWhisperBin(): string {
  try {
    const which = execSync("which whisper 2>/dev/null", { encoding: "utf-8" }).trim();
    if (which) return which;
  } catch { /* not on PATH */ }
  const fallback = "/Library/Frameworks/Python.framework/Versions/3.9/bin/whisper";
  return fallback;
}

const WHISPER_BIN = findWhisperBin();

function transcribeWhisperLocal(path: string): string {
  const result = execSync(`"${WHISPER_BIN}" "${path}" --output_format txt --output_dir /tmp --model tiny --language en`, {
    timeout: 120_000,
    encoding: "utf-8",
  });
  const baseName = path.split("/").pop()!.replace(/\.[^.]+$/, "");
  try {
    return readFileSync(`/tmp/${baseName}.txt`, "utf-8").trim();
  } catch {
    return result.trim();
  }
}

export async function ingestAudio(attachment: MediaAttachment): Promise<ProcessedMedia> {
  try {
    const transcription = transcribeWhisperLocal(attachment.path);
    return {
      type: "audio",
      description: transcription,
      extractedText: transcription,
      sourcePath: attachment.path,
      metadata: {
        mimeType: attachment.mimeType,
        originalName: attachment.originalName,
      },
    };
  } catch (err) {
    logger.error({ err, path: attachment.path }, "Audio transcription failed");
    return {
      type: "audio",
      description: "[Audio transcription failed]",
      sourcePath: attachment.path,
      metadata: { mimeType: attachment.mimeType },
      error: `Transcription failed: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}
```

- [ ] **Step 4: Write failing test for document**

Create `src/media/ingest/document.test.ts`:

```typescript
import { describe, it, expect, vi } from "vitest";
import { ingestDocument } from "./document.js";
import type { MediaAttachment } from "../types.js";

vi.mock("node:child_process", () => ({
  execSync: vi.fn(() => "This is the PDF text content"),
}));

describe("ingestDocument", () => {
  it("extracts text from PDF", async () => {
    const attachment: MediaAttachment = {
      type: "document",
      path: "/tmp/test.pdf",
      mimeType: "application/pdf",
      originalName: "test.pdf",
    };

    const result = await ingestDocument(attachment);
    expect(result.type).toBe("document");
    expect(result.description).toContain("This is the PDF text content");
    expect(result.extractedText).toBe("This is the PDF text content");
  });

  it("returns error for unsupported document format", async () => {
    const attachment: MediaAttachment = {
      type: "document",
      path: "/tmp/test.xlsx",
      mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      originalName: "test.xlsx",
    };

    const result = await ingestDocument(attachment);
    expect(result.error).toBeDefined();
  });
});
```

- [ ] **Step 5: Create ingest/document.ts**

Create `src/media/ingest/document.ts` — relocate from `processor.ts`:

```typescript
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { logger } from "../../logger.js";
import type { MediaAttachment, ProcessedMedia } from "../types.js";

export async function ingestDocument(attachment: MediaAttachment): Promise<ProcessedMedia> {
  const { path, mimeType, originalName } = attachment;

  if (mimeType === "application/pdf") {
    try {
      const text = execSync(`pdftotext "${path}" -`, {
        timeout: 30_000,
        encoding: "utf-8",
      }).trim();

      return {
        type: "document",
        description: `[Document: ${originalName ?? "file"}]\n${text.slice(0, 500)}${text.length > 500 ? "..." : ""}`,
        extractedText: text,
        sourcePath: path,
        metadata: { mimeType, originalName },
      };
    } catch (err) {
      logger.error({ err, path }, "PDF text extraction failed");
      return {
        type: "document",
        description: "[PDF text extraction failed]",
        sourcePath: path,
        metadata: { mimeType, originalName },
        error: `PDF extraction failed: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  }

  if (mimeType.startsWith("text/")) {
    try {
      const text = readFileSync(path, "utf-8").trim();
      return {
        type: "document",
        description: `[Document: ${originalName ?? "file"}]\n${text.slice(0, 500)}${text.length > 500 ? "..." : ""}`,
        extractedText: text,
        sourcePath: path,
        metadata: { mimeType, originalName },
      };
    } catch {
      return {
        type: "document",
        description: "[Could not read document]",
        sourcePath: path,
        metadata: { mimeType, originalName },
        error: "Could not read text document",
      };
    }
  }

  return {
    type: "document",
    description: `[Unsupported document format: ${mimeType}]`,
    sourcePath: path,
    metadata: { mimeType, originalName },
    error: `Unsupported document format: ${mimeType}`,
  };
}
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `npx vitest run src/media/ingest/`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/media/ingest/audio.ts src/media/ingest/audio.test.ts src/media/ingest/document.ts src/media/ingest/document.test.ts
git commit -m "feat(media): add audio and document ingest processors"
```

---

### Task 5: Image ingest processor (vision)

**Files:**
- Create: `src/media/ingest/image.ts`
- Create: `src/media/ingest/image.test.ts`

- [ ] **Step 1: Write failing test**

Create `src/media/ingest/image.test.ts`:

```typescript
import { describe, it, expect, vi } from "vitest";
import { ingestImage } from "./image.js";
import type { MediaAttachment } from "../types.js";

// Mock fetch for OpenAI vision API
global.fetch = vi.fn();

describe("ingestImage", () => {
  it("returns image description from OpenAI vision", async () => {
    (fetch as any).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        choices: [{ message: { content: "A sunset over the ocean with orange and pink clouds" } }],
      }),
    });

    const attachment: MediaAttachment = {
      type: "image",
      path: "/tmp/test.jpg",
      mimeType: "image/jpeg",
    };

    const result = await ingestImage(attachment, { provider: "openai", apiKey: "test-key" });
    expect(result.type).toBe("image");
    expect(result.description).toBe("A sunset over the ocean with orange and pink clouds");
    expect(result.error).toBeUndefined();
  });

  it("returns error on API failure", async () => {
    (fetch as any).mockResolvedValueOnce({
      ok: false,
      status: 500,
      text: () => Promise.resolve("Internal server error"),
    });

    const attachment: MediaAttachment = {
      type: "image",
      path: "/tmp/test.jpg",
      mimeType: "image/jpeg",
    };

    const result = await ingestImage(attachment, { provider: "openai", apiKey: "test-key" });
    expect(result.error).toBeDefined();
    expect(result.description).toContain("[Image description failed]");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/media/ingest/image.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Create ingest/image.ts**

Create `src/media/ingest/image.ts`:

```typescript
import { readFileSync, statSync } from "node:fs";
import { logger } from "../../logger.js";
import type { MediaAttachment, ProcessedMedia } from "../types.js";

interface VisionConfig {
  provider: "claude" | "openai";
  apiKey?: string;
}

export async function ingestImage(
  attachment: MediaAttachment,
  config: VisionConfig,
): Promise<ProcessedMedia> {
  const { path, mimeType } = attachment;

  try {
    const imageBuffer = readFileSync(path);
    const base64 = imageBuffer.toString("base64");
    const dataUrl = `data:${mimeType};base64,${base64}`;

    let description: string;

    if (config.provider === "openai" && config.apiKey) {
      description = await describeWithOpenAI(dataUrl, mimeType, config.apiKey);
    } else {
      // Default: return placeholder — Claude vision happens at the provider level
      // since the image is passed as a MediaAttachment to the LLM
      description = "[Image attached — described by LLM provider]";
    }

    const stats = statSync(path);

    return {
      type: "image",
      description,
      sourcePath: path,
      metadata: {
        mimeType,
        size: stats.size,
        originalName: attachment.originalName,
      },
    };
  } catch (err) {
    logger.error({ err, path }, "Image description failed");
    return {
      type: "image",
      description: "[Image description failed]",
      sourcePath: path,
      metadata: { mimeType },
      error: `Image processing failed: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}

async function describeWithOpenAI(dataUrl: string, mimeType: string, apiKey: string): Promise<string> {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o",
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: "Describe this image concisely. Focus on what is shown, any text visible, and the overall context." },
            { type: "image_url", image_url: { url: dataUrl } },
          ],
        },
      ],
      max_tokens: 300,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`OpenAI Vision API error ${response.status}: ${body}`);
  }

  const data = await response.json();
  return data.choices[0].message.content;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/media/ingest/image.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/media/ingest/image.ts src/media/ingest/image.test.ts
git commit -m "feat(media): add image ingest processor with OpenAI vision"
```

---

### Task 6: URL ingest processor

**Files:**
- Create: `src/media/ingest/url.ts`
- Create: `src/media/ingest/url.test.ts`

**Note:** Install dependencies first: `npm install @mozilla/readability jsdom`

- [ ] **Step 1: Install dependencies**

Run: `npm install @mozilla/readability jsdom && npm install -D @types/jsdom`

- [ ] **Step 2: Write failing test**

Create `src/media/ingest/url.test.ts`:

```typescript
import { describe, it, expect, vi } from "vitest";
import { ingestUrl } from "./url.js";

global.fetch = vi.fn();

describe("ingestUrl", () => {
  it("extracts readable content from a URL", async () => {
    (fetch as any).mockResolvedValueOnce({
      ok: true,
      text: () => Promise.resolve(`
        <html><head><title>Test Article</title></head>
        <body>
          <article>
            <h1>Test Article</h1>
            <p>This is the main content of the article. It has enough text to be considered readable content by the readability algorithm.</p>
            <p>Another paragraph with more content to ensure readability picks it up as the main article text.</p>
          </article>
        </body></html>
      `),
    });

    const result = await ingestUrl("https://example.com/article");
    expect(result.type).toBe("url");
    expect(result.description).toContain("Test Article");
    expect(result.extractedText).toBeDefined();
    expect(result.error).toBeUndefined();
  });

  it("returns error on fetch failure", async () => {
    (fetch as any).mockResolvedValueOnce({
      ok: false,
      status: 404,
      text: () => Promise.resolve("Not Found"),
    });

    const result = await ingestUrl("https://example.com/missing");
    expect(result.error).toBeDefined();
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run src/media/ingest/url.test.ts`
Expected: FAIL — module not found

- [ ] **Step 4: Create ingest/url.ts**

Create `src/media/ingest/url.ts`:

```typescript
import { Readability } from "@mozilla/readability";
import { JSDOM } from "jsdom";
import { logger } from "../../logger.js";
import type { ProcessedMedia } from "../types.js";

export async function ingestUrl(url: string): Promise<ProcessedMedia> {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Fetch failed: ${response.status}`);
    }

    const html = await response.text();
    const dom = new JSDOM(html, { url });
    const reader = new Readability(dom.window.document);
    const article = reader.parse();

    if (!article) {
      return {
        type: "url",
        description: `[URL: ${url}] — Could not extract readable content`,
        sourcePath: url,
        metadata: { mimeType: "text/html" },
        error: "Readability could not parse the page",
      };
    }

    const text = article.textContent.trim();
    const title = article.title || url;
    const summary = text.slice(0, 500) + (text.length > 500 ? "..." : "");

    return {
      type: "url",
      description: `[${title}]\n${summary}`,
      extractedText: text,
      sourcePath: url,
      metadata: { mimeType: "text/html" },
    };
  } catch (err) {
    logger.error({ err, url }, "URL extraction failed");
    return {
      type: "url",
      description: `[URL extraction failed: ${url}]`,
      sourcePath: url,
      metadata: { mimeType: "text/html" },
      error: `URL extraction failed: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/media/ingest/url.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/media/ingest/url.ts src/media/ingest/url.test.ts package.json package-lock.json
git commit -m "feat(media): add URL ingest processor with readability extraction"
```

---

### Task 7: Video ingest processor

**Files:**
- Create: `src/media/ingest/video.ts`
- Create: `src/media/ingest/video.test.ts`

- [ ] **Step 1: Write failing test**

Create `src/media/ingest/video.test.ts`:

```typescript
import { describe, it, expect, vi } from "vitest";
import { ingestVideo } from "./video.js";
import type { MediaAttachment } from "../types.js";

vi.mock("node:child_process", () => ({
  execSync: vi.fn((cmd: string) => {
    if (cmd.includes("ffprobe")) return "30.5"; // duration
    if (cmd.includes("-vf") && cmd.includes("select")) return ""; // keyframe extraction
    if (cmd.includes("-vn")) return ""; // audio extraction
    return "";
  }),
}));

// Mock the audio and image ingest functions
vi.mock("./audio.js", () => ({
  ingestAudio: vi.fn(async () => ({
    type: "audio",
    description: "Person speaking about technology",
    sourcePath: "/tmp/audio.ogg",
    metadata: { mimeType: "audio/ogg" },
  })),
}));

vi.mock("./image.js", () => ({
  ingestImage: vi.fn(async () => ({
    type: "image",
    description: "A person at a desk with a computer",
    sourcePath: "/tmp/frame.jpg",
    metadata: { mimeType: "image/jpeg" },
  })),
}));

describe("ingestVideo", () => {
  it("extracts keyframes and audio, combines results", async () => {
    const attachment: MediaAttachment = {
      type: "video",
      path: "/tmp/test.mp4",
      mimeType: "video/mp4",
    };

    const result = await ingestVideo(attachment, {
      keyframeInterval: 5,
      visionConfig: { provider: "openai", apiKey: "test" },
    });

    expect(result.type).toBe("video");
    expect(result.description).toContain("Person speaking about technology");
    expect(result.metadata.duration).toBe(30.5);
  });

  it("returns error when ffmpeg is not available", async () => {
    const { execSync } = await import("node:child_process");
    (execSync as any).mockImplementation(() => { throw new Error("ffmpeg not found"); });

    const attachment: MediaAttachment = {
      type: "video",
      path: "/tmp/test.mp4",
      mimeType: "video/mp4",
    };

    const result = await ingestVideo(attachment, {
      keyframeInterval: 5,
      visionConfig: { provider: "openai", apiKey: "test" },
    });

    expect(result.error).toBeDefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/media/ingest/video.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Create ingest/video.ts**

Create `src/media/ingest/video.ts`:

```typescript
import { execSync } from "node:child_process";
import { mkdirSync, readdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { logger } from "../../logger.js";
import type { MediaAttachment, ProcessedMedia } from "../types.js";
import { ingestAudio } from "./audio.js";
import { ingestImage } from "./image.js";

interface VideoIngestConfig {
  keyframeInterval: number;
  visionConfig: { provider: "claude" | "openai"; apiKey?: string };
}

export async function ingestVideo(
  attachment: MediaAttachment,
  config: VideoIngestConfig,
): Promise<ProcessedMedia> {
  const { path, mimeType } = attachment;
  const tmpDir = join("/tmp", `video-ingest-${randomUUID()}`);

  try {
    mkdirSync(tmpDir, { recursive: true });

    // Get duration
    let duration: number | undefined;
    try {
      const durationStr = execSync(
        `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${path}"`,
        { encoding: "utf-8", timeout: 10_000 },
      ).trim();
      duration = parseFloat(durationStr);
    } catch {
      logger.warn({ path }, "Could not get video duration");
    }

    // Extract keyframes
    const framesDir = join(tmpDir, "frames");
    mkdirSync(framesDir);
    try {
      execSync(
        `ffmpeg -i "${path}" -vf "fps=1/${config.keyframeInterval}" "${framesDir}/frame_%03d.jpg" -y`,
        { timeout: 60_000, stdio: "pipe" },
      );
    } catch (err) {
      logger.warn({ err, path }, "Keyframe extraction failed");
    }

    // Extract audio
    const audioPath = join(tmpDir, "audio.ogg");
    try {
      execSync(
        `ffmpeg -i "${path}" -vn -c:a libopus "${audioPath}" -y`,
        { timeout: 60_000, stdio: "pipe" },
      );
    } catch {
      logger.warn({ path }, "Audio extraction failed");
    }

    // Process keyframes through vision
    const frameDescriptions: string[] = [];
    const frameFiles = readdirSync(framesDir).filter(f => f.endsWith(".jpg")).sort();
    for (const frame of frameFiles.slice(0, 5)) { // Max 5 frames
      const frameAttachment: MediaAttachment = {
        type: "image",
        path: join(framesDir, frame),
        mimeType: "image/jpeg",
      };
      const frameResult = await ingestImage(frameAttachment, config.visionConfig);
      if (!frameResult.error) {
        frameDescriptions.push(frameResult.description);
      }
    }

    // Process audio through transcription
    let transcription = "";
    try {
      const audioAttachment: MediaAttachment = { type: "audio", path: audioPath, mimeType: "audio/ogg" };
      const audioResult = await ingestAudio(audioAttachment);
      if (!audioResult.error) {
        transcription = audioResult.description;
      }
    } catch { /* audio may not exist */ }

    // Combine results
    const parts: string[] = [];
    if (frameDescriptions.length > 0) {
      parts.push(`Visual: ${frameDescriptions.join("; ")}`);
    }
    if (transcription) {
      parts.push(`Audio: ${transcription}`);
    }

    const description = parts.length > 0
      ? `[Video]\n${parts.join("\n")}`
      : "[Video — could not extract content]";

    return {
      type: "video",
      description,
      extractedText: transcription || undefined,
      sourcePath: path,
      metadata: {
        mimeType,
        duration,
        originalName: attachment.originalName,
      },
    };
  } catch (err) {
    logger.error({ err, path }, "Video ingest failed");
    return {
      type: "video",
      description: "[Video processing failed]",
      sourcePath: path,
      metadata: { mimeType },
      error: `Video ingest failed: ${err instanceof Error ? err.message : String(err)}`,
    };
  } finally {
    try { rmSync(tmpDir, { recursive: true, force: true }); } catch { /* cleanup */ }
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/media/ingest/video.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/media/ingest/video.ts src/media/ingest/video.test.ts
git commit -m "feat(media): add video ingest processor with keyframe + audio extraction"
```

---

### Task 8: Ingest router

**Files:**
- Create: `src/media/ingest/index.ts`
- Create: `src/media/ingest/index.test.ts`

- [ ] **Step 1: Write failing test**

Create `src/media/ingest/index.test.ts`:

```typescript
import { describe, it, expect, vi } from "vitest";
import { ingestMedia, buildMediaFallback } from "./index.js";
import type { MediaAttachment, ProcessedMedia } from "../types.js";

vi.mock("./audio.js", () => ({
  ingestAudio: vi.fn(async (): Promise<ProcessedMedia> => ({
    type: "audio", description: "transcribed text", sourcePath: "/tmp/a.ogg", metadata: { mimeType: "audio/ogg" },
  })),
}));

vi.mock("./document.js", () => ({
  ingestDocument: vi.fn(async (): Promise<ProcessedMedia> => ({
    type: "document", description: "[Doc] text", extractedText: "text", sourcePath: "/tmp/d.pdf", metadata: { mimeType: "application/pdf" },
  })),
}));

vi.mock("./image.js", () => ({
  ingestImage: vi.fn(async (): Promise<ProcessedMedia> => ({
    type: "image", description: "a sunset", sourcePath: "/tmp/i.jpg", metadata: { mimeType: "image/jpeg" },
  })),
}));

vi.mock("./video.js", () => ({
  ingestVideo: vi.fn(async (): Promise<ProcessedMedia> => ({
    type: "video", description: "[Video] scene", sourcePath: "/tmp/v.mp4", metadata: { mimeType: "video/mp4" },
  })),
}));

describe("ingestMedia", () => {
  it("routes audio to audio processor", async () => {
    const attachment: MediaAttachment = { type: "audio", path: "/tmp/a.ogg", mimeType: "audio/ogg" };
    const result = await ingestMedia(attachment, {} as any);
    expect(result.type).toBe("audio");
    expect(result.description).toBe("transcribed text");
  });

  it("routes image to image processor", async () => {
    const attachment: MediaAttachment = { type: "image", path: "/tmp/i.jpg", mimeType: "image/jpeg" };
    const result = await ingestMedia(attachment, {} as any);
    expect(result.type).toBe("image");
  });

  it("routes video to video processor", async () => {
    const attachment: MediaAttachment = { type: "video", path: "/tmp/v.mp4", mimeType: "video/mp4" };
    const result = await ingestMedia(attachment, {} as any);
    expect(result.type).toBe("video");
  });

  it("routes document to document processor", async () => {
    const attachment: MediaAttachment = { type: "document", path: "/tmp/d.pdf", mimeType: "application/pdf" };
    const result = await ingestMedia(attachment, {} as any);
    expect(result.type).toBe("document");
  });
});

describe("buildMediaFallback", () => {
  it("builds fallback text for all media types", () => {
    const attachments: MediaAttachment[] = [
      { type: "image", path: "/a.jpg", mimeType: "image/jpeg" },
      { type: "audio", path: "/b.ogg", mimeType: "audio/ogg", transcription: "hello" },
      { type: "video", path: "/c.mp4", mimeType: "video/mp4" },
      { type: "document", path: "/d.pdf", mimeType: "application/pdf", extractedText: "doc content", originalName: "report.pdf" },
    ];

    const result = buildMediaFallback(attachments);
    expect(result).toContain("[Image attached]");
    expect(result).toContain("hello");
    expect(result).toContain("[Video attached]");
    expect(result).toContain("doc content");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/media/ingest/index.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Create ingest/index.ts**

Create `src/media/ingest/index.ts`:

```typescript
import type { SecondBrainConfig } from "../../config.js";
import type { MediaAttachment, ProcessedMedia } from "../types.js";
import { ingestAudio } from "./audio.js";
import { ingestDocument } from "./document.js";
import { ingestImage } from "./image.js";
import { ingestVideo } from "./video.js";

export { ingestUrl } from "./url.js";

export async function ingestMedia(
  attachment: MediaAttachment,
  config: SecondBrainConfig,
): Promise<ProcessedMedia> {
  const mediaConfig = config.media;

  switch (attachment.type) {
    case "audio":
      return ingestAudio(attachment);

    case "image":
      return ingestImage(attachment, {
        provider: mediaConfig?.ingest?.visionProvider ?? "claude",
        apiKey: process.env.OPENAI_API_KEY,
      });

    case "video":
      return ingestVideo(attachment, {
        keyframeInterval: mediaConfig?.ingest?.videoKeyframeInterval ?? 5,
        visionConfig: {
          provider: mediaConfig?.ingest?.visionProvider ?? "claude",
          apiKey: process.env.OPENAI_API_KEY,
        },
      });

    case "document":
      return ingestDocument(attachment);

    default:
      return {
        type: attachment.type,
        description: `[Unsupported media type: ${attachment.type}]`,
        sourcePath: attachment.path,
        metadata: { mimeType: attachment.mimeType },
        error: `Unsupported media type: ${attachment.type}`,
      };
  }
}

export function buildMediaFallback(attachments: MediaAttachment[]): string {
  const parts: string[] = [];

  for (const a of attachments) {
    switch (a.type) {
      case "image":
        parts.push("[Image attached]");
        break;
      case "audio":
        parts.push(
          a.transcription
            ? `[Voice message transcription]: ${a.transcription}`
            : "[Voice message attached]",
        );
        break;
      case "video":
        parts.push("[Video attached]");
        break;
      case "document":
        parts.push(
          a.extractedText
            ? `[Document: ${a.originalName ?? "file"}]\n${a.extractedText}`
            : `[Document attached: ${a.originalName ?? "file"}]`,
        );
        break;
      case "url":
        parts.push(
          a.extractedText
            ? `[URL content]: ${a.extractedText}`
            : "[URL attached]",
        );
        break;
    }
  }

  return parts.join("\n\n");
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/media/ingest/index.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/media/ingest/index.ts src/media/ingest/index.test.ts
git commit -m "feat(media): add ingest router with buildMediaFallback"
```

---

## Chunk 3: Generate Pipeline

### Task 9: Relocate TTS to generate/tts.ts

**Files:**
- Create: `src/media/generate/tts.ts`
- Create: `src/media/generate/tts.test.ts`

- [ ] **Step 1: Write failing test**

Create `src/media/generate/tts.test.ts`:

```typescript
import { describe, it, expect, vi } from "vitest";
import { generateSpeech } from "./tts.js";
import type { GenerateRequest } from "../types.js";

vi.mock("node:child_process", () => ({
  execSync: vi.fn(),
}));

vi.mock("../store/local.js", () => ({
  saveMediaFile: vi.fn(() => "/tmp/saved.ogg"),
}));

describe("generateSpeech", () => {
  it("returns null when provider is off", async () => {
    const request: GenerateRequest = { type: "speech", prompt: "Hello world" };
    const result = await generateSpeech(request, { provider: "off" });
    expect(result).toBeNull();
  });

  it("returns null for empty prompt", async () => {
    const request: GenerateRequest = { type: "speech", prompt: "   " };
    const result = await generateSpeech(request, { provider: "gtts" });
    expect(result).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/media/generate/tts.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Create generate/tts.ts**

Create `src/media/generate/tts.ts` — refactor existing `src/media/tts.ts` to use `GenerateRequest`/`GeneratedMedia`:

```typescript
import { execSync } from "node:child_process";
import { writeFileSync, unlinkSync, existsSync } from "node:fs";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { logger } from "../../logger.js";
import type { GenerateRequest, GeneratedMedia } from "../types.js";
import { saveMediaFile } from "../store/local.js";

export interface TTSConfig {
  provider: "openai" | "gtts" | "elevenlabs" | "off";
  openaiApiKey?: string;
  voice?: string;
}

const MAX_TTS_LENGTH = 4000;

export async function generateSpeech(
  request: GenerateRequest,
  config: TTSConfig,
): Promise<GeneratedMedia | null> {
  if (config.provider === "off" || !request.prompt.trim()) {
    return null;
  }

  const input = request.prompt.length > MAX_TTS_LENGTH
    ? request.prompt.slice(0, MAX_TTS_LENGTH) + "..."
    : request.prompt;

  const cleanText = stripMarkdown(input);

  try {
    let audioPath: string;

    if (config.provider === "openai" && config.openaiApiKey) {
      audioPath = await synthesizeOpenAI(cleanText, config);
    } else {
      audioPath = await synthesizeGTTS(cleanText);
    }

    const { statSync } = await import("node:fs");
    const stats = statSync(audioPath);

    return {
      type: "speech",
      path: audioPath,
      mimeType: "audio/ogg",
      size: stats.size,
      provider: config.provider,
      prompt: request.prompt.slice(0, 200),
    };
  } catch (err) {
    logger.error({ err, provider: config.provider }, "TTS synthesis failed");
    throw err;
  }
}

/** Keep backward-compatible export for telegram.ts during migration */
export async function synthesizeSpeech(
  text: string,
  config: { provider: "openai" | "gtts" | "off"; openaiApiKey?: string; voice?: string },
): Promise<string | null> {
  const result = await generateSpeech(
    { type: "speech", prompt: text },
    { ...config, provider: config.provider === "off" ? "off" : config.provider },
  );
  return result?.path ?? null;
}

async function synthesizeOpenAI(text: string, config: TTSConfig): Promise<string> {
  const voice = config.voice ?? "onyx";
  const response = await fetch("https://api.openai.com/v1/audio/speech", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.openaiApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "tts-1",
      input: text,
      voice,
      response_format: "opus",
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`OpenAI TTS API error ${response.status}: ${body}`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  return saveMediaFile(buffer, ".ogg");
}

async function synthesizeGTTS(text: string): Promise<string> {
  const id = randomUUID();
  const inputPath = join("/tmp", `tts-input-${id}.txt`);
  const mp3Path = join("/tmp", `tts-output-${id}.mp3`);
  const oggPath = join("/tmp", `tts-output-${id}.ogg`);

  try {
    writeFileSync(inputPath, text, "utf-8");
    execSync(
      `python3 -c "from gtts import gTTS; tts = gTTS(open('${inputPath}').read(), lang='en', tld='co.uk'); tts.save('${mp3Path}')"`,
      { timeout: 30_000 },
    );
    execSync(
      `ffmpeg -y -i "${mp3Path}" -c:a libopus -b:a 48k "${oggPath}"`,
      { timeout: 15_000, stdio: "pipe" },
    );

    const { readFileSync } = await import("node:fs");
    const buffer = readFileSync(oggPath);
    return saveMediaFile(buffer, ".ogg");
  } finally {
    for (const p of [inputPath, mp3Path, oggPath]) {
      try { if (existsSync(p)) unlinkSync(p); } catch { /* ignore */ }
    }
  }
}

function stripMarkdown(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, "")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/\*(.+?)\*/g, "$1")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/<[^>]+>/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/media/generate/tts.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/media/generate/tts.ts src/media/generate/tts.test.ts
git commit -m "feat(media): relocate TTS to generate/tts.ts with GeneratedMedia interface"
```

---

### Task 10: Image generation

**Files:**
- Create: `src/media/generate/image.ts`
- Create: `src/media/generate/image.test.ts`

- [ ] **Step 1: Write failing test**

Create `src/media/generate/image.test.ts`:

```typescript
import { describe, it, expect, vi } from "vitest";
import { generateImage } from "./image.js";
import type { GenerateRequest } from "../types.js";

global.fetch = vi.fn();

vi.mock("../store/local.js", () => ({
  saveMediaFile: vi.fn(() => "/tmp/generated.png"),
}));

describe("generateImage", () => {
  it("generates an image via DALL-E", async () => {
    (fetch as any).mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({
        data: [{ b64_json: "iVBORw0KGgoAAAANSUhEUg==" }],
      }),
    });

    const request: GenerateRequest = { type: "image", prompt: "a sunset over mountains" };
    const result = await generateImage(request, { provider: "dall-e", apiKey: "test-key" });

    expect(result.type).toBe("image");
    expect(result.path).toBe("/tmp/generated.png");
    expect(result.provider).toBe("dall-e");
    expect(result.prompt).toBe("a sunset over mountains");
  });

  it("throws on API failure", async () => {
    (fetch as any).mockResolvedValueOnce({
      ok: false,
      status: 400,
      text: () => Promise.resolve("Bad Request"),
    });

    const request: GenerateRequest = { type: "image", prompt: "test" };
    await expect(generateImage(request, { provider: "dall-e", apiKey: "test-key" }))
      .rejects.toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/media/generate/image.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Create generate/image.ts**

Create `src/media/generate/image.ts`:

```typescript
import { logger } from "../../logger.js";
import type { GenerateRequest, GeneratedMedia } from "../types.js";
import { saveMediaFile } from "../store/local.js";

interface ImageGenConfig {
  provider: "dall-e" | "flux" | "nanobanana";
  apiKey?: string;
}

export async function generateImage(
  request: GenerateRequest,
  config: ImageGenConfig,
): Promise<GeneratedMedia> {
  switch (config.provider) {
    case "dall-e":
      return generateDallE(request, config.apiKey!);
    case "nanobanana":
      return generateNanoBanana(request, config.apiKey!);
    case "flux":
      return generateFlux(request, config.apiKey!);
    default:
      throw new Error(`Unsupported image provider: ${config.provider}`);
  }
}

async function generateDallE(request: GenerateRequest, apiKey: string): Promise<GeneratedMedia> {
  const size = (request.options?.size as string) ?? "1024x1024";

  const response = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "dall-e-3",
      prompt: request.prompt,
      n: 1,
      size,
      response_format: "b64_json",
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`DALL-E API error ${response.status}: ${body}`);
  }

  const data = await response.json();
  const b64 = data.data[0].b64_json;
  const buffer = Buffer.from(b64, "base64");
  const path = saveMediaFile(buffer, ".png");

  return {
    type: "image",
    path,
    mimeType: "image/png",
    size: buffer.length,
    provider: "dall-e",
    prompt: request.prompt,
  };
}

async function generateNanoBanana(request: GenerateRequest, apiKey: string): Promise<GeneratedMedia> {
  // Nano Banana API integration — placeholder structure
  // Replace URL and payload format with actual Nano Banana API docs
  const response = await fetch("https://api.nanobanana.com/v1/generate", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ prompt: request.prompt }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Nano Banana API error ${response.status}: ${body}`);
  }

  const data = await response.json();
  const buffer = Buffer.from(data.image, "base64");
  const path = saveMediaFile(buffer, ".png");

  return {
    type: "image",
    path,
    mimeType: "image/png",
    size: buffer.length,
    provider: "nanobanana",
    prompt: request.prompt,
  };
}

async function generateFlux(request: GenerateRequest, apiKey: string): Promise<GeneratedMedia> {
  // Flux API integration — placeholder structure
  const response = await fetch("https://api.flux.ai/v1/generate", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ prompt: request.prompt }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Flux API error ${response.status}: ${body}`);
  }

  const data = await response.json();
  const buffer = Buffer.from(data.image, "base64");
  const path = saveMediaFile(buffer, ".png");

  return {
    type: "image",
    path,
    mimeType: "image/png",
    size: buffer.length,
    provider: "flux",
    prompt: request.prompt,
  };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/media/generate/image.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/media/generate/image.ts src/media/generate/image.test.ts
git commit -m "feat(media): add image generation with DALL-E, Flux, Nano Banana"
```

---

### Task 11: Generate router and video stub

**Files:**
- Create: `src/media/generate/index.ts`
- Create: `src/media/generate/video.ts`

- [ ] **Step 1: Create generate/video.ts stub**

Create `src/media/generate/video.ts`:

```typescript
import type { GenerateRequest, GeneratedMedia } from "../types.js";

export async function generateVideo(_request: GenerateRequest): Promise<GeneratedMedia> {
  throw new Error("Video generation is not yet implemented. Coming soon with Sora/Runway support.");
}
```

- [ ] **Step 2: Create generate/index.ts**

Create `src/media/generate/index.ts`:

```typescript
import type { SecondBrainConfig } from "../../config.js";
import type { GenerateRequest, GeneratedMedia } from "../types.js";
import { generateSpeech, type TTSConfig } from "./tts.js";
import { generateImage } from "./image.js";
import { generateVideo } from "./video.js";

export { synthesizeSpeech } from "./tts.js";
export type { TTSConfig } from "./tts.js";

export async function generateMedia(
  request: GenerateRequest,
  config: SecondBrainConfig,
): Promise<GeneratedMedia | null> {
  const mediaConfig = config.media;

  switch (request.type) {
    case "speech": {
      const ttsConfig: TTSConfig = {
        provider: (mediaConfig?.generate?.ttsProvider ?? "gtts") as TTSConfig["provider"],
        openaiApiKey: process.env.OPENAI_API_KEY,
        voice: mediaConfig?.generate?.ttsVoice ?? "onyx",
      };
      return generateSpeech(request, ttsConfig);
    }

    case "image":
      return generateImage(request, {
        provider: mediaConfig?.generate?.imageProvider ?? "dall-e",
        apiKey: getImageApiKey(mediaConfig?.generate?.imageProvider ?? "dall-e"),
      });

    case "video":
      return generateVideo(request);

    default:
      throw new Error(`Unsupported generation type: ${request.type}`);
  }
}

function getImageApiKey(provider: string): string | undefined {
  switch (provider) {
    case "dall-e": return process.env.OPENAI_API_KEY;
    case "nanobanana": return process.env.NANOBANANA_API_KEY;
    case "flux": return process.env.FLUX_API_KEY;
    default: return undefined;
  }
}
```

- [ ] **Step 3: Run all generate tests**

Run: `npx vitest run src/media/generate/`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/media/generate/index.ts src/media/generate/video.ts
git commit -m "feat(media): add generate router with video stub"
```

---

## Chunk 4: Integration (Wire Everything Together)

### Task 12: Update agent.ts to use new ingest pipeline

**Files:**
- Modify: `src/core/agent.ts`

- [ ] **Step 1: Update imports in agent.ts**

Replace the old imports:

```typescript
// OLD
import { preprocessMedia, buildMediaFallback } from "../media/processor.js";
```

With:

```typescript
// NEW
import { ingestMedia, buildMediaFallback } from "../media/ingest/index.js";
import { saveMediaRecord } from "../media/store/index.js";
```

- [ ] **Step 2: Update media preprocessing in handleMessage**

Replace lines 65-73 in `agent.ts` (the media preprocessing section):

```typescript
// OLD
const media = msg.media ? preprocessMedia(msg.media) : undefined;
let prompt = msg.text;
if (media?.length) {
  const fallback = buildMediaFallback(media);
  prompt = fallback + (prompt ? `\n\n${prompt}` : "");
}
```

With:

```typescript
// NEW — ingest media through new pipeline
let media = msg.media;
if (media?.length && config.appConfig) {
  const processed = await Promise.all(
    media.map(async (a) => {
      const result = await ingestMedia(a, config.appConfig!);
      // Enrich attachment with processed data
      if (result.extractedText && a.type === "audio") a.transcription = result.extractedText;
      if (result.extractedText && a.type === "document") a.extractedText = result.extractedText;
      // Persist to media store
      saveMediaRecord(db, {
        type: a.type,
        source: "inbound",
        path: a.path,
        mimeType: a.mimeType,
        description: result.description,
        chatId: msg.chatId,
        tags: [],
      });
      return result;
    }),
  );
  // Log any processing errors
  for (const p of processed) {
    if (p.error) logger.warn({ type: p.type, error: p.error }, "Media processing partial failure");
  }
}

let prompt = msg.text;
if (media?.length) {
  const fallback = buildMediaFallback(media);
  prompt = fallback + (prompt ? `\n\n${prompt}` : "");
}
```

- [ ] **Step 3: Add config to AgentConfig interface**

In `src/core/agent.ts`, add to `AgentConfig`:

```typescript
appConfig?: import("../config.js").SecondBrainConfig;
```

And update `createAgent` to use it — pass `config.appConfig` when calling `ingestMedia`.

- [ ] **Step 4: Run existing tests to verify nothing broke**

Run: `npx vitest run`
Expected: PASS (all existing tests still pass)

- [ ] **Step 5: Commit**

```bash
git add src/core/agent.ts
git commit -m "refactor(agent): wire ingest pipeline into handleMessage"
```

---

### Task 13: Update Telegram channel

**Files:**
- Modify: `src/channels/telegram.ts`

- [ ] **Step 1: Update imports**

Replace:

```typescript
import { downloadAndSave } from "../media/store.js";
import { synthesizeSpeech, type TTSConfig } from "../media/tts.js";
```

With:

```typescript
import { downloadAndSaveFile } from "../media/store/local.js";
import { synthesizeSpeech, type TTSConfig } from "../media/generate/tts.js";
```

- [ ] **Step 2: Update downloadAndSave calls**

Replace all `downloadAndSave` calls with `downloadAndSaveFile` in `buildAttachment`.

- [ ] **Step 3: Fix video type**

In the video handler (line 286), change `"document"` to `"video"`:

```typescript
// OLD
"document",
// NEW
"video",
```

- [ ] **Step 4: Run existing tests**

Run: `npx vitest run`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/channels/telegram.ts
git commit -m "refactor(telegram): use new media store/generate imports, fix video type"
```

---

### Task 14: Update index.ts and delete old files

**Files:**
- Modify: `src/index.ts`
- Delete: `src/media/processor.ts`
- Delete: `src/media/store.ts`
- Keep: `src/media/tts.ts` (delete after verifying telegram.ts uses new import)

- [ ] **Step 1: Update index.ts to pass appConfig to agent**

In `src/index.ts`, update the `createAgent` call to include `appConfig`:

```typescript
const agent = createAgent({
  provider: skillAwareProvider,
  db,
  memoryDir: MEMORY_DIR,
  memoryMode: config.memory.mode,
  router,
  availableProviders: Object.keys(providers),
  appConfig: config,
  hooks: {
    onLLMInput: (p) => logger.debug({ hook: "onLLMInput", ...p }, "Gateway sending to LLM"),
    onLLMOutput: (p) => logger.debug({ hook: "onLLMOutput", ...p }, "Gateway received from LLM"),
    onAgentEnd: (p) => logger.debug({ hook: "onAgentEnd", ...p }, "Gateway finished turn"),
  }
});
```

- [ ] **Step 2: Delete old files**

```bash
rm src/media/processor.ts src/media/store.ts
```

- [ ] **Step 3: Search for stale imports and verify no broken references**

Run: `grep -r "media/processor" src/ --include="*.ts" && grep -r "media/store.js" src/ --include="*.ts" && grep -r "media/tts.js" src/ --include="*.ts"`
Expected: No results (all old imports should be updated)

Then: `npx tsc --noEmit`
Expected: No errors

- [ ] **Step 4: Run all tests**

Run: `npx vitest run`
Expected: PASS

- [ ] **Step 5: Delete old tts.ts**

After confirming telegram.ts uses `src/media/generate/tts.js`:

```bash
rm src/media/tts.ts
```

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "refactor: remove old media files, complete migration to new pipeline"
```

---

## Chunk 5: Drive Archival (Future — Stub Only)

### Task 15: Create Drive archival stub

**Files:**
- Create: `src/media/store/drive.ts`

This task creates the interface and a no-op implementation. Full googleapis integration is deferred since it requires installing the `googleapis` package and setting up a separate OAuth client.

- [ ] **Step 1: Create drive.ts stub**

Create `src/media/store/drive.ts`:

```typescript
import { logger } from "../../logger.js";
import type { Database } from "../../db.js";

export interface DriveArchivalConfig {
  archiveDays: number;
  deleteLocal: boolean;
  folderName: string;
  account: "personal" | "business";
}

/**
 * Archive old media files to Google Drive.
 * TODO: Implement with googleapis package.
 */
export async function runArchivalJob(db: Database, config: DriveArchivalConfig): Promise<void> {
  logger.info("Drive archival job: not yet implemented (stub)");
}
```

- [ ] **Step 2: Commit**

```bash
git add src/media/store/drive.ts
git commit -m "feat(media): add Drive archival stub"
```

---

## Chunk 6: Media Recall

### Task 16: Expose media search to the agent

**Files:**
- Create: `src/skills/media-recall/SKILL.md`

The agent uses the skills system to understand when and how to search media. This skill teaches the agent to query the media store when users ask to find past media.

- [ ] **Step 1: Create the media recall skill**

Create `src/skills/media-recall/SKILL.md` (or `skills/media-recall/SKILL.md` depending on where skills live):

```markdown
---
name: media-recall
description: Search and retrieve previously shared or generated media
triggers: find photo, find image, find video, find document, find article, that photo, that image, that video, remember the, media from
---

When the user asks you to find or recall media they previously shared or that was generated, search the media_files database.

## How to search

Use the searchMedia and queryMedia functions available in your context. The media store supports:

- **FTS search**: Search descriptions and tags by keyword (e.g., "sunset", "meeting notes")
- **Filter by type**: image, audio, video, document, url
- **Filter by chat**: Media from a specific conversation
- **Filter by date**: Recent media or media from a specific time period

## Response format

When you find matching media:
1. Describe what you found (type, description, when it was shared)
2. If the file still exists locally, mention the path
3. If multiple matches, list the top results and ask which one they meant

If no matches found, say so plainly and suggest they may have shared it before the media pipeline was active.
```

- [ ] **Step 2: Wire searchMedia into agent context**

In `src/core/agent.ts`, after the media ingest section, add a media search utility that the agent can reference:

Add to the `handleMessage` method, after building the memory context (around line 63):

```typescript
// Build media context if relevant keywords detected
const mediaSearchTerms = ["find", "photo", "image", "video", "document", "article", "that", "remember"];
const hasMediaQuery = mediaSearchTerms.some(term => msg.text.toLowerCase().includes(term));
let mediaContext = "";
if (hasMediaQuery && config.appConfig) {
  const { searchMedia, queryMedia } = await import("../media/store/index.js");
  // Search by message text
  const results = searchMedia(db, msg.text, 5);
  if (results.length > 0) {
    mediaContext = "\n\n[Media search results]:\n" + results.map(r =>
      `- ${r.type} (${r.createdAt}): ${r.description?.slice(0, 100) ?? "no description"}${r.path ? ` [${r.path}]` : " [archived]"}`
    ).join("\n");
  }
}
```

Then include `mediaContext` in the memory context:

```typescript
const memoryContextFull = [alwaysContext, searchContext, mediaContext].filter(Boolean).join("\n\n");
```

- [ ] **Step 3: Run existing tests**

Run: `npx vitest run`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add skills/media-recall/SKILL.md src/core/agent.ts
git commit -m "feat(media): add media recall skill and wire search into agent"
```

---

### Summary of all tasks

| Task | Description | New files | Modified files |
|------|-------------|-----------|---------------|
| 1 | Extend types + config schema | — | `types.ts`, `schema.ts`, `config.test.ts` |
| 2 | Media store schema (SQLite) | `store/schema.ts`, `store/schema.test.ts` | `db.ts` |
| 3 | Media store operations | `store/index.ts`, `store/local.ts`, `store/index.test.ts` | — |
| 4 | Relocate audio + document processors | `ingest/audio.ts`, `ingest/document.ts`, tests | — |
| 5 | Image ingest (vision) | `ingest/image.ts`, test | — |
| 6 | URL ingest | `ingest/url.ts`, test | `package.json` |
| 7 | Video ingest | `ingest/video.ts`, test | — |
| 8 | Ingest router | `ingest/index.ts`, test | — |
| 9 | Relocate TTS | `generate/tts.ts`, test | — |
| 10 | Image generation | `generate/image.ts`, test | — |
| 11 | Generate router + video stub | `generate/index.ts`, `generate/video.ts` | — |
| 12 | Wire agent.ts | — | `agent.ts` |
| 13 | Wire telegram.ts | — | `telegram.ts` |
| 14 | Cleanup old files | — | `index.ts`, delete old files |
| 15 | Drive archival stub | `store/drive.ts` | — |
| 16 | Media recall | `skills/media-recall/SKILL.md` | `agent.ts` |
