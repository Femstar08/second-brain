// src/index.ts
import { writeFileSync, existsSync, mkdirSync, readFileSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import { createCLIAdapter } from "./channels/cli.js";
import { createWebAdapter } from "./channels/web.js";
import { PROJECT_ROOT, STORE_DIR, MEMORY_DIR, SKILLS_DIR, loadConfig } from "./config.js";
import { createAgent } from "./core/agent.js";
import { initDatabase } from "./db.js";
import { readEnvFile } from "./env.js";
import { startSchedulerLoop, createScheduledTask } from "./heartbeat/scheduler.js";
import { logger } from "./logger.js";
import { runDecaySweep } from "./memory/search.js";
import { createClaudeProvider } from "./providers/claude-cli.js";
import { createCodexProvider } from "./providers/codex-cli.js";
import { createOllamaProvider } from "./providers/ollama.js";
import { createOpenAIProvider } from "./providers/openai.js";
import { createOpenRouterProvider } from "./providers/openrouter.js";
import { createRouter } from "./providers/router.js";
import type { Provider } from "./providers/types.js";
import { loadSkills } from "./skills/loader.js";
import { matchSkills, buildSkillContext } from "./skills/registry.js";

const PID_FILE = join(STORE_DIR, "second-brain.pid");

function acquireLock(): void {
  mkdirSync(STORE_DIR, { recursive: true });

  if (existsSync(PID_FILE)) {
    const oldPid = parseInt(readFileSync(PID_FILE, "utf-8").trim(), 10);
    try {
      process.kill(oldPid, 0); // check if alive
      process.kill(oldPid, "SIGTERM");
      logger.info({ oldPid }, "Killed previous instance");
    } catch {
      // stale PID file
    }
  }
  writeFileSync(PID_FILE, String(process.pid));
}

function releaseLock(): void {
  try {
    unlinkSync(PID_FILE);
  } catch {
    /* ignore */
  }
}

async function main(): Promise<void> {
  console.log("\n  Second Brain\n");

  acquireLock();

  const config = loadConfig();
  const env = readEnvFile(join(PROJECT_ROOT, ".env"));

  // Ensure directories exist
  mkdirSync(MEMORY_DIR, { recursive: true });
  mkdirSync(join(MEMORY_DIR, "daily"), { recursive: true });
  mkdirSync(SKILLS_DIR, { recursive: true });

  // Initialize database
  const db = initDatabase(join(STORE_DIR, "second-brain.db"));
  logger.info("Database initialized");

  // Memory decay sweep
  if (config.memory.mode === "full") {
    runDecaySweep(db);
    setInterval(() => runDecaySweep(db), 24 * 60 * 60 * 1000);
  }

  // Build providers
  const providers: Record<string, Provider> = {};
  providers.claude = createClaudeProvider();
  providers.codex = createCodexProvider();

  const orKey = env.OPENROUTER_API_KEY ?? config.providers.openrouter.apiKey;
  if (orKey) {
    providers.openrouter = createOpenRouterProvider(
      orKey,
      config.providers.openrouter.model ?? "anthropic/claude-sonnet-4-6",
    );
  }

  const oaiKey = env.OPENAI_API_KEY ?? config.providers.openai.apiKey;
  if (oaiKey) {
    providers.openai = createOpenAIProvider(oaiKey, config.providers.openai.model ?? "gpt-4o");
  }

  providers.ollama = createOllamaProvider(
    config.providers.ollama.model ?? "llama3.1",
    config.providers.ollama.baseUrl,
  );

  const router = createRouter(providers, config.provider);
  logger.info({ provider: config.provider }, "Provider router ready");

  // Load skills
  const skills = loadSkills(SKILLS_DIR);
  logger.info({ count: skills.length }, "Skills loaded");

  // Create a skill-aware provider wrapper that injects skill context
  const skillAwareProvider: Provider = {
    id: router.currentProvider(),
    async send(prompt, context) {
      const matched = matchSkills(skills, prompt);
      const skillContext = buildSkillContext(matched);
      return router.send(prompt, { ...context, skillContext });
    },
  };

  // Create agent
  const agent = createAgent({
    provider: skillAwareProvider,
    db,
    memoryDir: MEMORY_DIR,
    memoryMode: config.memory.mode,
    router,
    availableProviders: Object.keys(providers),
  });

  // Determine channel
  const channelName = config.channels.active;
  let channelAdapter;

  if (channelName === "web") {
    channelAdapter = createWebAdapter({
      port: config.channels.web.port,
      host: config.channels.web.host,
      onMessage: (msg) => agent.handleMessage(msg),
    });
  } else if (channelName === "telegram") {
    const token = env.TELEGRAM_BOT_TOKEN ?? config.channels.telegram.botToken;
    if (!token) {
      logger.error("TELEGRAM_BOT_TOKEN not set. Set it in .env or config.json");
      process.exit(1);
    }
    const allowedIds = (env.TELEGRAM_ALLOWED_CHAT_IDS ?? "").split(",").filter(Boolean);
    const { createTelegramAdapter } = await import("./channels/telegram.js");
    channelAdapter = createTelegramAdapter(token, allowedIds, (msg) => agent.handleMessage(msg));
  } else {
    // Default: CLI
    channelAdapter = createCLIAdapter((msg) => agent.handleMessage(msg));
  }

  // Start heartbeat scheduler
  if (config.heartbeat.enabled) {
    // Ensure heartbeat task exists
    const existing = db
      .prepare("SELECT id FROM scheduled_tasks WHERE prompt LIKE '%HEARTBEAT_OK%'")
      .get();
    if (!existing) {
      const cronExpr = `*/${config.heartbeat.intervalMinutes} * * * *`;
      createScheduledTask(db, {
        chatId: "heartbeat",
        prompt:
          "Read my memory files. Based on what you know about me, is there anything worth notifying me about right now? If not, respond with HEARTBEAT_OK.",
        schedule: cronExpr,
      });
      logger.info({ interval: config.heartbeat.intervalMinutes }, "Heartbeat task created");
    }

    startSchedulerLoop(
      db,
      async (prompt, chatId) => {
        const result = await router.send(prompt, { chatId, memoryContext: "" });
        return result.text;
      },
      async (chatId, text) => {
        await channelAdapter.send(chatId, text);
      },
    );
    logger.info("Scheduler started");
  }

  // Graceful shutdown
  const shutdown = () => {
    logger.info("Shutting down...");
    void channelAdapter.stop();
    db.close();
    releaseLock();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  // Start channel
  await channelAdapter.start();
}

main().catch((err) => {
  logger.fatal({ err }, "Fatal error");
  releaseLock();
  process.exit(1);
});
