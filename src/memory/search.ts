import type { Database } from "../db.js";

export interface MemoryResult {
  id: number;
  content: string;
  sector: string;
  salience: number;
}

// Signals that a message contains long-term personal/preference info
const SEMANTIC_SIGNALS =
  /\b(my|i am|i'm|i prefer|remember|always|never|i like|i hate|i use|i work)\b/i;

/**
 * Classify a message as semantic (persistent user facts/preferences)
 * or episodic (transient conversation context).
 */
export function classifyMessage(text: string): "semantic" | "episodic" {
  return SEMANTIC_SIGNALS.test(text) ? "semantic" : "episodic";
}

/** Insert a new memory into the database with full salience. */
export function saveMemory(
  db: Database,
  chatId: string,
  content: string,
  sector: "semantic" | "episodic",
): void {
  const now = Date.now();
  db.prepare(
    `INSERT INTO memories (chat_id, content, sector, salience, created_at, accessed_at) VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(chatId, content, sector, 1.0, now, now);
}

/**
 * Search memories using FTS5 full-text search, combined with recent access.
 * Touching retrieved memories boosts their salience (reinforcement).
 */
export function searchMemories(
  db: Database,
  chatId: string,
  query: string,
  limit = 5,
): MemoryResult[] {
  // Sanitize query for FTS5: strip non-alphanumeric, add prefix matching
  const sanitized = query.replace(/[^\w\s]/g, "").trim();
  if (!sanitized) {
    return [];
  }

  const ftsQuery = sanitized
    .split(/\s+/)
    .map((w) => `"${w}"*`)
    .join(" OR ");

  const ftsResults = db
    .prepare(
      `
    SELECT m.id, m.content, m.sector, m.salience
    FROM memories_fts f
    JOIN memories m ON m.id = f.rowid
    WHERE memories_fts MATCH ? AND m.chat_id = ?
    ORDER BY rank
    LIMIT ?
  `,
    )
    .all(ftsQuery, chatId, limit) as MemoryResult[];

  // Also fetch recent memories for context
  const recentResults = db
    .prepare(
      `
    SELECT id, content, sector, salience
    FROM memories
    WHERE chat_id = ?
    ORDER BY accessed_at DESC
    LIMIT ?
  `,
    )
    .all(chatId, limit) as MemoryResult[];

  // Deduplicate by id, FTS results first (higher relevance)
  const seen = new Set<number>();
  const combined: MemoryResult[] = [];
  for (const r of [...ftsResults, ...recentResults]) {
    if (!seen.has(r.id)) {
      seen.add(r.id);
      combined.push(r);
    }
  }

  // Reinforce accessed memories (salience boost, capped at 5.0)
  const now = Date.now();
  for (const r of combined) {
    db.prepare(
      "UPDATE memories SET accessed_at = ?, salience = MIN(salience + 0.1, 5.0) WHERE id = ?",
    ).run(now, r.id);
  }

  return combined.slice(0, limit);
}

/** Build a context string from relevant memories for a given user message. */
export function buildMemoryContext(db: Database, chatId: string, userMessage: string): string {
  const results = searchMemories(db, chatId, userMessage);
  if (results.length === 0) {
    return "";
  }
  const lines = results.map((r) => `- ${r.content} (${r.sector})`);
  return `[Recalled memories]\n${lines.join("\n")}`;
}

/**
 * Save a conversation turn to memory if it's substantive.
 * Short messages and commands are skipped.
 */
export function saveConversationTurn(
  db: Database,
  chatId: string,
  userMsg: string,
  _assistantMsg: string,
): void {
  if (userMsg.length <= 20 || userMsg.startsWith("/")) {
    return;
  }
  const sector = classifyMessage(userMsg);
  saveMemory(db, chatId, userMsg, sector);
}

/**
 * Decay old memories and prune those below the salience threshold.
 * Memories older than 1 day lose 2% salience per sweep.
 * Memories below 0.1 salience are permanently deleted.
 */
export function runDecaySweep(db: Database): void {
  const oneDayAgo = Date.now() - 86_400_000;
  db.prepare("UPDATE memories SET salience = salience * 0.98 WHERE created_at < ?").run(oneDayAgo);
  db.prepare("DELETE FROM memories WHERE salience < 0.1").run();
}
