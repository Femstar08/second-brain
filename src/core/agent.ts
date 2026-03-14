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
      try {
        return await processMessage(msg, config);
      } catch (err) {
        const detail = err instanceof Error ? err.message : String(err);
        logger.error({ err, chatId: msg.chatId }, "Unhandled error in message handler");
        return { text: `Something went wrong: ${detail}\n\nTry again or rephrase your message.` };
      }
    },
  };
}

async function processMessage(msg: InboundMessage, config: AgentConfig): Promise<ProviderResult> {
  const { provider, db, memoryDir, memoryMode } = config;

      // Handle /provider command
      if (msg.text.startsWith("/provider")) {
        return handleProviderCommand(msg.text, config);
      }

      // Handle /model command
      if (msg.text.startsWith("/model")) {
        return handleModelCommand(msg.text, config);
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
        try {
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
        } catch (err) {
          logger.error({ err, chatId: msg.chatId }, "Media ingestion pipeline failed");
          // Continue without media — don't block the response
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
      let result: ProviderResult;
      try {
        result = await provider.send(prompt, {
          chatId: msg.chatId,
          sessionId,
          memoryContext: memoryContextFull,
          skillContext: config.skillContext,
          media,
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        logger.error({ err, chatId: msg.chatId, provider: provider.id }, "Provider call failed");

        // Always return a response — never leave the user hanging
        return {
          text: `I ran into an issue processing your message: ${message}\n\nPlease try again or rephrase your request.`,
        };
      }

      // Guard against empty responses
      if (!result.text?.trim()) {
        logger.warn({ chatId: msg.chatId, provider: provider.id }, "Provider returned empty response");
        result = {
          ...result,
          text: "I processed your message but got an empty response. Could you try again?",
        };
      }

      // Append route info footer if enabled
      if (result.routeInfo && config.appConfig?.routing?.showRouteInfo) {
        const ri = result.routeInfo;
        const via = ri.model ? `${ri.provider}/${ri.model}` : ri.provider;
        const failoverNote = ri.failedOver
          ? `, failed over from ${ri.attempts.slice(0, -1).join(" → ")}`
          : "";
        result = { ...result, text: `${result.text}\n\n[via ${via}${failoverNote}]` };
      }

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
}

// Preset models for quick switching — grouped by row
const MODEL_PRESETS = [
  { text: "Gemini Flash 2.0", id: "google/gemini-flash-2.0" },
  { text: "Llama 3.1 8B", id: "meta-llama/llama-3.1-8b-instruct" },
  { text: "Qwen 3.5 9B", id: "qwen/qwen3.5-9b" },
  { text: "DeepSeek Chat", id: "deepseek/deepseek-chat" },
  { text: "Claude Haiku", id: "anthropic/claude-haiku-4-5-20251001" },
  { text: "Claude Sonnet", id: "anthropic/claude-sonnet-4-6" },
  { text: "Liquid LFM2", id: "liquid/lfm-2-24b-a2b" },
  { text: "Mistral Small", id: "mistralai/mistral-small-creative" },
];

function handleModelCommand(text: string, config: AgentConfig): ProviderResult {
  const { router } = config;
  const args = text.replace(/^\/model\s*/, "").trim();

  if (!router) {
    return { text: "Model switching not available." };
  }

  const current = router.currentModel();
  const providerName = router.currentProvider();

  // No argument — show picker with inline buttons
  if (!args) {
    const buttons = [];
    for (let i = 0; i < MODEL_PRESETS.length; i += 2) {
      const row = [MODEL_PRESETS[i]];
      if (MODEL_PRESETS[i + 1]) row.push(MODEL_PRESETS[i + 1]);
      buttons.push(row.map(m => ({
        text: m.id === current ? `✓ ${m.text}` : m.text,
        callbackData: `model:${m.id}`,
      })));
    }
    return {
      text: `Current model: ${current ?? "unknown"}\nPick a model:`,
      buttons,
    };
  }

  // Try to switch
  const ok = router.setModel(args);
  if (!ok) {
    return { text: `Provider "${providerName}" doesn't support model switching.` };
  }

  logger.info({ model: args, provider: providerName }, "Switched model");
  return { text: `Switched to ${args}` };
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
