import type { Database } from "../db.js";
import { clearSession, getSession, setSession } from "../db.js";
import { logger } from "../logger.js";
import { ingestMedia, buildMediaFallback } from "../media/ingest/index.js";
import { saveMediaRecord } from "../media/store/index.js";
import type { MediaAttachment } from "../media/types.js";
import { loadAlwaysContext, appendDailyLog } from "../memory/index.js";
import { buildMemoryContext, saveConversationTurn } from "../memory/search.js";
import type { Router } from "../providers/router.js";
import type { Provider, ProviderResult } from "../providers/types.js";

export interface InboundMessage {
  chatId: string;
  text: string;
  senderId: string;
  platform: string;
  media?: MediaAttachment[];
  replyToId?: string;
}

export interface AgentConfig {
  provider: Provider;
  db: Database;
  memoryDir: string;
  memoryMode: "full" | "simple" | "none";
  skillContext?: string;
  router?: Router;
  availableProviders?: string[];
  appConfig?: import("../config.js").SecondBrainConfig;
}

export interface Agent {
  handleMessage(msg: InboundMessage): Promise<ProviderResult>;
}

export function createAgent(config: AgentConfig): Agent {
  const { provider, db, memoryDir, memoryMode } = config;

  return {
    async handleMessage(msg: InboundMessage): Promise<ProviderResult> {
      // Handle /provider command
      if (msg.text.startsWith("/provider")) {
        return handleProviderCommand(msg.text, config);
      }

      // Handle /newchat command
      if (msg.text.startsWith("/newchat")) {
        clearSession(db, msg.chatId);
        return { text: "Session cleared. Starting fresh." };
      }
      logger.info({ chatId: msg.chatId, platform: msg.platform }, "Handling message");

      // 1. Build memory context from always-on files + searched memories
      const alwaysContext = loadAlwaysContext(memoryDir);
      const searchContext =
        memoryMode === "full" ? buildMemoryContext(db, msg.chatId, msg.text) : "";

      // Build media context if relevant keywords detected
      const mediaSearchTerms = ["find", "photo", "image", "video", "document", "article", "that", "remember"];
      const hasMediaQuery = mediaSearchTerms.some(term => msg.text.toLowerCase().includes(term));
      let mediaContext = "";
      if (hasMediaQuery && config.appConfig) {
        const { searchMedia } = await import("../media/store/index.js");
        // Search by message text
        const results = searchMedia(db, msg.text).slice(0, 5);
        if (results.length > 0) {
          mediaContext = "\n\n[Media search results]:\n" + results.map(r =>
            `- ${r.type} (${r.createdAt}): ${r.description?.slice(0, 100) ?? "no description"}${r.path ? ` [${r.path}]` : " [archived]"}`
          ).join("\n");
        }
      }

      const memoryContextFull = [alwaysContext, searchContext, mediaContext].filter(Boolean).join("\n\n");

      // 2. Ingest media through new pipeline
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

      // 3. Build prompt — prepend media fallback text for non-vision providers
      let prompt = msg.text;
      if (media?.length) {
        const fallback = buildMediaFallback(media);
        prompt = fallback + (prompt ? `\n\n${prompt}` : "");
      }

      // 4. Get existing session for this chat+provider pair
      const sessionId = getSession(db, msg.chatId, provider.id) ?? undefined;

      // 5. Send to provider with full context
      const result = await provider.send(prompt, {
        chatId: msg.chatId,
        sessionId,
        memoryContext: memoryContextFull,
        skillContext: config.skillContext,
        media,
      });

      // 6. Save session if the provider returned one
      if (result.sessionId) {
        setSession(db, msg.chatId, provider.id, result.sessionId);
      }

      // 7. Save to daily log (simple + full modes)
      if (memoryMode !== "none") {
        appendDailyLog(memoryDir, "user", msg.text);
        appendDailyLog(memoryDir, "assistant", result.text);
      }

      // 8. Save to FTS memory (full mode only)
      if (memoryMode === "full") {
        saveConversationTurn(db, msg.chatId, msg.text, result.text);
      }

      return result;
    },
  };
}

function handleProviderCommand(text: string, config: AgentConfig): ProviderResult {
  const { router, availableProviders } = config;
  const args = text.replace(/^\/provider\s*/, "").trim();

  if (!router) {
    return { text: "Provider switching not available." };
  }

  const providers = availableProviders ?? [];

  // No argument — show current provider and available options
  if (!args) {
    const current = router.currentProvider();
    const list = providers.length > 0 ? providers.join(", ") : "unknown";
    return { text: `Current provider: ${current}\nAvailable: ${list}` };
  }

  // Switch to requested provider
  if (providers.length > 0 && !providers.includes(args)) {
    return { text: `Unknown provider "${args}". Available: ${providers.join(", ")}` };
  }

  router.setProvider(args);
  logger.info({ provider: args }, "Switched provider");
  return { text: `Switched to ${args}` };
}
