// src/index.ts
import { writeFileSync, existsSync, mkdirSync, readFileSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import type { ChannelAdapter } from "./channels/adapter.js";
import { createCLIAdapter } from "./channels/cli.js";
import { createWebAdapter } from "./channels/web.js";
import { PROJECT_ROOT, STORE_DIR, MEMORY_DIR, SKILLS_DIR, loadConfig } from "./config.js";
import { createAgent } from "./core/agent.js";
import { initDatabase } from "./db.js";
import {
  readEnvFile,
  SENSITIVE_TOKEN_MAP,
  getNestedValue,
  deleteNestedValue,
  writeEnvValue,
} from "./env.js";
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

const PROFILE_LOCK_NAME = `second-brain${process.argv.includes("--profile") ? "-" + process.argv[process.argv.indexOf("--profile") + 1] : ""
  }.pid`;

function acquireLock(): void {
  const pidPath = join(STORE_DIR, PROFILE_LOCK_NAME);
  mkdirSync(STORE_DIR, { recursive: true });

  if (existsSync(pidPath)) {
    const oldPid = parseInt(readFileSync(pidPath, "utf-8").trim(), 10);
    try {
      if (oldPid !== process.pid) {
        process.kill(oldPid, 0); // check if alive
        process.kill(oldPid, "SIGTERM");
        logger.info({ oldPid }, "Killed previous instance");
      }
    } catch {
      // stale PID file
    }
  }
  writeFileSync(pidPath, String(process.pid));
}

function releaseLock(): void {
  try {
    const pidPath = join(STORE_DIR, PROFILE_LOCK_NAME);
    unlinkSync(pidPath);
  } catch {
    /* ignore */
  }
}

async function main(): Promise<void> {
  const isProfile = process.argv.includes("--profile");
  const profileName = isProfile ? process.argv[process.argv.indexOf("--profile") + 1] : "default";
  console.log(`\n  Second Brain [Profile: ${profileName}]\n`);

  acquireLock();

  const config = loadConfig(isProfile ? join(PROJECT_ROOT, "profiles", profileName, "config.json") : undefined);
  const rootEnvPath = join(PROJECT_ROOT, ".env");
  const envPath = isProfile ? join(PROJECT_ROOT, "profiles", profileName, ".env") : rootEnvPath;
  // If isolated .env doesn't exist, fallback to reading root env
  let env = existsSync(envPath) ? readEnvFile(envPath) : readEnvFile(rootEnvPath);

  // Migrate tokens from config.json → .env
  const configPath = isProfile ? join(PROJECT_ROOT, "profiles", profileName, "config.json") : join(PROJECT_ROOT, "config.json");
  let configDirty = false;
  const rawConfig = (() => {
    try {
      return JSON.parse(readFileSync(configPath, "utf-8")) as Record<string, unknown>;
    } catch {
      return null;
    }
  })();

  if (rawConfig) {
    for (const [envKey, path] of Object.entries(SENSITIVE_TOKEN_MAP)) {
      const configValue = getNestedValue(rawConfig, path) as string | undefined;
      if (configValue && !env[envKey]) {
        // Token in config but not in .env — migrate it
        writeEnvValue(envPath, envKey, configValue);
        deleteNestedValue(rawConfig, path);
        configDirty = true;
        logger.info({ key: envKey }, "Migrated token from config.json to .env");
      } else if (configValue && env[envKey]) {
        // Token in both — remove from config, .env takes precedence
        deleteNestedValue(rawConfig, path);
        configDirty = true;
      }
    }
    if (configDirty) {
      writeFileSync(configPath, JSON.stringify(rawConfig, null, 2));
      env = readEnvFile(envPath);
    }
  }

  // Ensure directories exist
  mkdirSync(MEMORY_DIR, { recursive: true });
  mkdirSync(join(MEMORY_DIR, "daily"), { recursive: true });
  mkdirSync(SKILLS_DIR, { recursive: true });

  mkdirSync(STORE_DIR, { recursive: true });
  const db = initDatabase(join(STORE_DIR, "second-brain.db"));
  logger.info({ dbPath: join(STORE_DIR, "second-brain.db") }, "Database initialized");

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
    appConfig: config,
  });

  // Start all configured channels
  const adapters: ChannelAdapter[] = [];

  // Web — always start (serves UI + API)
  adapters.push(
    createWebAdapter({
      port: config.channels.web.port,
      host: config.channels.web.host,
      onMessage: (msg) => agent.handleMessage(msg),
    }),
  );

  // Telegram — start if token is available
  const telegramToken = env.TELEGRAM_BOT_TOKEN ?? config.channels.telegram.botToken;
  if (telegramToken) {
    const allowedIds = (env.TELEGRAM_ALLOWED_CHAT_IDS ?? "").split(",").filter(Boolean);
    const { createTelegramAdapter } = await import("./channels/telegram.js");
    adapters.push(
      createTelegramAdapter(telegramToken, allowedIds, (msg) => agent.handleMessage(msg)),
    );
  }

  // CLI — start if no other interactive channels, or if explicitly requested
  if (adapters.length === 0) {
    adapters.push(createCLIAdapter((msg) => agent.handleMessage(msg)));
  }

  logger.info({ channels: adapters.map((a) => a.id) }, "Channels configured");

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
        await Promise.all(adapters.map((a) => a.send(chatId, text)));
      },
    );
    logger.info("Scheduler started");
  }

  // Graceful shutdown
  const shutdown = () => {
    logger.info("Shutting down...");
    for (const a of adapters) void a.stop();
    db.close();
    releaseLock();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  // Start all channels
  await Promise.all(adapters.map((a) => a.start()));
}

main().catch((err) => {
  logger.fatal({ err }, "Fatal error");
  releaseLock();
  process.exit(1);
});
