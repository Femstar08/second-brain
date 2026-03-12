# Media Pipeline Design

Full media literacy for second-brain: understand incoming media, generate outgoing media, and persist/recall media as memory.

## Architecture

Three subsystems under `src/media/`, sharing a common store:

- **`media/ingest/`** — Process incoming media into text/descriptions the agent can reason about
- **`media/generate/`** — Create media (speech, images, video) on behalf of the agent
- **`media/store/`** — Persist files locally + metadata in SQLite, archive to Google Drive

### Inbound Flow

```
Channel → media/ingest/ (route by type → processor) → ProcessedMedia
  ├── media/store/ (save file + metadata)
  └── Agent (receives extracted text/description as message context)
```

### Outbound Flow

```
Agent (decides to generate) → media/generate/ (route by type → generator) → GeneratedMedia
  ├── media/store/ (save file + metadata)
  └── Channel (send attachment to user)
```

## Type Migration

### Existing types (`src/media/types.ts`)

```typescript
// Current
export type MediaType = "image" | "audio" | "document";
export interface MediaAttachment {
  type: MediaType;
  path: string;
  mimeType: string;
  originalName?: string;
  transcription?: string;
  extractedText?: string;
}
```

### New types (`src/media/types.ts` — extended)

```typescript
export type MediaType = "image" | "audio" | "video" | "document" | "url";

// MediaAttachment stays as the channel-level type (what channels produce)
export interface MediaAttachment {
  type: MediaType;
  path: string;
  mimeType: string;
  originalName?: string;
  transcription?: string;
  extractedText?: string;
}

// What ingest processors return
export interface ProcessedMedia {
  type: MediaType;
  description: string;        // Human-readable: vision description, transcription, summary
  extractedText?: string;     // Raw extracted text (for documents, URLs)
  sourcePath: string;         // Original file path
  metadata: {
    mimeType: string;
    size?: number;
    originalName?: string;
    duration?: number;         // Audio/video duration in seconds
    dimensions?: { width: number; height: number };  // Images/video
  };
  error?: string;             // Set if processing partially failed (still returns best-effort result)
}

// What the agent sends to media/generate/
export interface GenerateRequest {
  type: "speech" | "image" | "video";
  prompt: string;              // Text description of what to generate
  provider?: string;           // Override default provider
  options?: Record<string, unknown>;  // Provider-specific options (voice, size, etc.)
}

// What generators return
export interface GeneratedMedia {
  type: "speech" | "image" | "video";
  path: string;                // Local file path
  mimeType: string;
  size: number;
  provider: string;            // Which provider generated it
  prompt: string;              // The prompt used
}

// Database record for stored media
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

### Error handling contract

Ingest processors return `ProcessedMedia` with best-effort results. If processing partially fails (e.g., audio transcription fails but file is valid), the `error` field is set and `description` contains a fallback string like `"[Audio transcription failed]"`. Callers check `error` to decide whether to surface the failure to the user. Processors never throw — they always return a result.

Generators throw on failure (since generation is explicit and user-requested — the agent should report the failure).

### Tags serialization

`MediaRecord.tags` is `string[]` in TypeScript but stored as `TEXT` (JSON array) in SQLite. The store layer handles serialization: `JSON.stringify()` on write, `JSON.parse()` on read. This is encapsulated in `store/index.ts` — callers always work with `string[]`.

## Module Structure

```
src/media/
  types.ts              — Extended with new types (see above)
  ingest/
    index.ts            — Router: dispatch to processor by media type
    image.ts            — Vision API description (Claude / OpenAI)
    audio.ts            — Transcription (whisper-local / whisper-api / Deepgram)
    video.ts            — Keyframe extraction + audio split via ffmpeg
    url.ts              — Fetch + readability extraction (on-demand only)
    document.ts         — PDF / text extraction
  generate/
    index.ts            — Router: dispatch to generator by type
    tts.ts              — Speech synthesis (gTTS / OpenAI / ElevenLabs)
    image.ts            — Image generation (DALL-E / Flux / Nano Banana) — confirm before generating
    video.ts            — Video generation (Sora / Runway) — stub for now
  store/
    index.ts            — Save, query, delete media records
    local.ts            — Local filesystem operations
    drive.ts            — Google Drive archival (direct googleapis client)
    schema.ts           — media_files SQL definitions (exported, called from db.ts initDatabase)
```

### Existing code relocation plan

| Current location | New location | Notes |
|-----------------|-------------|-------|
| `src/media/tts.ts` | `src/media/generate/tts.ts` | Refactor to implement generator interface |
| `src/media/processor.ts` → `transcribeAudio()` | `src/media/ingest/audio.ts` | Keep whisper-local support |
| `src/media/processor.ts` → `extractDocumentText()` | `src/media/ingest/document.ts` | Same logic, new home |
| `src/media/processor.ts` → `preprocessMedia()` | `src/media/ingest/index.ts` | Becomes the ingest router |
| `src/media/processor.ts` → `buildMediaFallback()` | `src/media/ingest/index.ts` | Kept as utility for non-vision providers |
| `src/media/store.ts` → `saveMedia()`, `downloadAndSave()` | `src/media/store/local.ts` | Extended with date-organized directories |
| `src/media/types.ts` | `src/media/types.ts` | Extended in-place (see Type Migration) |

After relocation, `src/media/processor.ts` and `src/media/store.ts` are deleted. All imports across the codebase updated.

`buildMediaFallback` is extended with `video` and `url` cases after relocation (e.g., `"[Video: keyframe descriptions + transcription]"`, `"[URL content: summary]"`).

### Existing files modified

- `src/core/agent.ts` — Wire ingest into handleMessage, expose generate to skills
- `src/channels/telegram.ts` — Use ingest for downloads, send generated media back, fix video type from `"document"` to `"video"`
- `src/db.ts` — Import and call `store/schema.ts` SQL from `initDatabase()` (matching existing `CREATE TABLE IF NOT EXISTS` pattern)
- `src/config/schema.ts` — Add media config section (see Configuration)

## Ingest Processors

| Type | Processor | Method |
|------|-----------|--------|
| Image | Vision API (Claude / OpenAI) | Send image to multimodal LLM, return description |
| Audio/Voice | whisper-local / whisper-api / Deepgram | Transcribe to text |
| Video | ffmpeg + image + audio processors | Extract keyframes + audio track, process each, combine |
| URL | Readability extraction | On-demand only (user must ask). Fetch page, extract readable content. |
| Document | PDF/text extraction | Existing logic from processor.ts, relocated. |

Each processor implements: `(attachment: MediaAttachment) → Promise<ProcessedMedia>`

### Audio transcription providers

- **whisper-local** — Existing local whisper CLI binary (free, slower, offline). Current default.
- **whisper-api** — OpenAI Whisper API endpoint (paid, faster, better quality).
- **deepgram** — Deepgram API (paid, fast, good for real-time).

### Video processing (Phase 1)

- Extract keyframes using ffmpeg (1 frame per 5 seconds, configurable)
- Extract audio track using ffmpeg
- Run keyframes through image processor for visual descriptions
- Run audio through audio processor for transcription
- Combine into a single ProcessedMedia result
- **Note:** Telegram limits bot file downloads to 20MB. Videos exceeding this are skipped with a message to the user.

### Video processing (Phase 2 — future)

- Send full video to multimodal API for comprehensive understanding
- Replace keyframe+audio approach when provider support matures

### URL processing

URLs are **not** auto-detected from message text by the ingest router. The agent decides when to process a URL based on user intent (e.g., "summarize this link"). The agent extracts the URL from the message text and calls `ingest/url.ts` directly. This keeps the boundary clear: the ingest router handles `MediaAttachment` objects (files), while URL processing is agent-initiated.

## Generate Producers

| Type | Providers | Behavior |
|------|-----------|----------|
| Speech/TTS | gTTS, OpenAI, ElevenLabs | Auto-generate when appropriate (existing behavior) |
| Image | DALL-E, Flux, Nano Banana | **Confirm before generating.** Agent proposes, user approves. |
| Video | Sora, Runway | Confirm before generating. Stub for now. |

Each generator implements: `(request: GenerateRequest) → Promise<GeneratedMedia>`

### Image generation confirmation flow

1. User asks agent to create an image
2. Agent crafts a prompt description and responds: "I'd generate: [description]. Want me to go ahead?"
3. User confirms
4. Agent calls `generate/image.ts` with the prompt
5. Result saved to store, sent back through channel

## Store

### Local storage

Files saved to `media/` directory under project store, organized by date:

```
store/media/
  2026-03-12/
    img_abc123.jpg
    voice_def456.opus
    gen_ghi789.png
```

### Database schema

```sql
CREATE TABLE IF NOT EXISTS media_files (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  type TEXT NOT NULL,           -- image, audio, video, document, url
  source TEXT NOT NULL,         -- inbound | generated
  path TEXT NOT NULL,           -- local file path
  mime_type TEXT,
  size INTEGER,
  description TEXT,             -- vision description / transcription / summary
  chat_id TEXT,                 -- which conversation it came from
  drive_file_id TEXT,           -- Google Drive ID once archived
  tags TEXT,                    -- JSON array for searchable tags
  created_at TEXT DEFAULT (datetime('now')),
  archived_at TEXT              -- when uploaded to Drive
);

CREATE INDEX IF NOT EXISTS idx_media_type ON media_files(type);
CREATE INDEX IF NOT EXISTS idx_media_chat ON media_files(chat_id);
CREATE INDEX IF NOT EXISTS idx_media_created ON media_files(created_at);

CREATE VIRTUAL TABLE IF NOT EXISTS media_files_fts USING fts5(
  description, tags, content=media_files, content_rowid=id
);

-- FTS sync triggers (matching existing memories_fts pattern)
CREATE TRIGGER media_files_ai AFTER INSERT ON media_files BEGIN
  INSERT INTO media_files_fts(rowid, description, tags)
  VALUES (new.id, new.description, new.tags);
END;

CREATE TRIGGER media_files_ad AFTER DELETE ON media_files BEGIN
  INSERT INTO media_files_fts(media_files_fts, rowid, description, tags)
  VALUES ('delete', old.id, old.description, old.tags);
END;

CREATE TRIGGER media_files_au AFTER UPDATE ON media_files BEGIN
  INSERT INTO media_files_fts(media_files_fts, rowid, description, tags)
  VALUES ('delete', old.id, old.description, old.tags);
  INSERT INTO media_files_fts(rowid, description, tags)
  VALUES (new.id, new.description, new.tags);
END;
```

### Google Drive archival

- Background job runs on agent startup
- Files older than `MEDIA_ARCHIVE_DAYS` (default: 7) uploaded to Google Drive
- **Uses direct `googleapis` npm package** (not MCP) — MCP tools route through the LLM which is inappropriate for background file uploads. A lightweight Google API client authenticates with the same OAuth credentials configured for the MCP server.
- `drive_file_id` and `archived_at` updated after upload
- Local file optionally deleted after confirmed upload (configurable: `mediaArchiveDeleteLocal`)

### Local cleanup

- If Drive archival is disabled, local files older than `MEDIA_LOCAL_RETENTION_DAYS` (default: 30) are deleted on startup to prevent unbounded disk growth.
- SQLite records are kept (description/metadata still searchable) but `path` is cleared.

### Media recall

Agent queries store when user asks to find media:

- "Find that photo I sent last week" → FTS on description + date filter
- "All images from this chat" → type + chat_id filter
- "That article about X" → FTS on description where type=url

## Configuration

Added to `ConfigSchema` in `src/config/schema.ts`:

```typescript
media: z.object({
  ingest: z.object({
    visionProvider: z.enum(["claude", "openai"]).default("claude"),
    transcriptionProvider: z.enum(["whisper-local", "whisper-api", "deepgram"]).default("whisper-local"),
    videoKeyframeInterval: z.number().default(5),  // seconds between keyframes
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

API keys remain in `.env` (secrets stay out of config.json):

```env
DEEPGRAM_API_KEY=               # if using deepgram
OPENAI_API_KEY=                 # for DALL-E + whisper-api
NANOBANANA_API_KEY=             # if using Nano Banana
FLUX_API_KEY=                   # if using Flux
ELEVENLABS_API_KEY=             # if using ElevenLabs
```

Existing `TTS_PROVIDER` and `TTS_VOICE` env vars are migrated to `config.json` under `media.generate`.

## Agent Integration

1. **Inbound media on message** → auto-process through `ingest/`. Results become message context for the LLM. Processors return best-effort results with `error` field on partial failure.
2. **URL in message** → only processed when user explicitly asks ("summarize this", "save this article"). Agent extracts URL and calls `ingest/url.ts` directly.
3. **Image generation request** → agent proposes prompt, asks for confirmation, generates on approval.
4. **Media recall request** → agent queries `store/` by description/date/type, returns matches.
5. **Archival** → background job on startup, checks for files older than configured threshold.

## Testing Strategy

### Unit tests

- Each processor/generator tested in isolation with mocked external APIs
- Store operations: save, query, FTS search, archive
- Router logic: correct processor/generator dispatched per media type
- Error handling: verify partial failures return ProcessedMedia with error field

### Integration tests

- Real image through ingest → description + stored in SQLite
- TTS generation → file created + metadata saved
- URL extraction with real URL → readable content returned
- FTS triggers: insert media record, verify FTS table populated

### Manual testing (via Telegram)

- Send photo → agent responds acknowledging content
- Send voice note → agent responds to transcribed text
- Send video → agent describes visual + audio content
- Send URL + "summarize this" → agent fetches and summarizes
- "Generate an image of X" → agent proposes, confirm, image sent back
- "Find that photo from yesterday" → agent queries store, returns result

### Development aids

- Dry-run flag for expensive APIs (DALL-E, Sora) during development
- `ffmpeg` required locally for video processing

## Dependencies

### System

- `ffmpeg` — video keyframe + audio extraction
- `whisper` CLI — local audio transcription (existing, optional)
- `pdftotext` — PDF extraction (existing)

### npm (new)

- `googleapis` — Google Drive archival (direct API client)
- `@mozilla/readability` + `jsdom` — URL content extraction
- Provider SDKs as needed (OpenAI already in use)

### External APIs

- Vision API — Claude (existing) or OpenAI
- Whisper API — OpenAI (optional, alternative to local)
- Deepgram API — (optional, alternative transcription)
- DALL-E / Flux / Nano Banana — image generation
- Google Drive API — archival (uses same OAuth credentials as MCP)
