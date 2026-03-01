import type { Database } from "../db.js";
import { clearSession, getSession, setSession } from "../db.js";
import { logger } from "../logger.js";
import { loadAlwaysContext, appendDailyLog } from "../memory/index.js";
import { buildMemoryContext, saveConversationTurn } from "../memory/search.js";
import type { Router } from "../providers/router.js";
import type { Provider, ProviderResult } from "../providers/types.js";

export interface InboundMessage {
  chatId: string;
  text: string;
  senderId: string;
  platform: string;
  mediaPath?: string;
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

      const memoryContext = [alwaysContext, searchContext].filter(Boolean).join("\n\n");

      // 2. Get existing session for this chat+provider pair
      const sessionId = getSession(db, msg.chatId, provider.id) ?? undefined;

      // 3. Send to provider with full context
      const result = await provider.send(msg.text, {
        chatId: msg.chatId,
        sessionId,
        memoryContext,
        skillContext: config.skillContext,
      });

      // 4. Save session if the provider returned one
      if (result.sessionId) {
        setSession(db, msg.chatId, provider.id, result.sessionId);
      }

      // 5. Save to daily log (simple + full modes)
      if (memoryMode !== "none") {
        appendDailyLog(memoryDir, "user", msg.text);
        appendDailyLog(memoryDir, "assistant", result.text);
      }

      // 6. Save to FTS memory (full mode only)
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
