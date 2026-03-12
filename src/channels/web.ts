import { existsSync, readFileSync, writeFileSync, readdirSync } from "node:fs";
import { extname, join, resolve } from "node:path";
import { serve } from "@hono/node-server";
import { createNodeWebSocket } from "@hono/node-ws";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { PROJECT_ROOT, loadConfig } from "../config.js";
import {
  SENSITIVE_TOKEN_MAP,
  maskToken,
  getNestedValue,
  deleteNestedValue,
  writeEnvValue,
  readEnvFile,
} from "../env.js";
import { logger } from "../logger.js";
import { saveMediaFile } from "../media/store/local.js";
import type { MediaAttachment, MediaType } from "../media/types.js";
import type { ChannelAdapter, MessageHandler } from "./adapter.js";

export interface WebAppDeps {
  configPath: string;
  guidesDir: string;
  envPath: string;
}

/** Build tokenStatus object and strip sensitive fields from config. */
function prepareConfigResponse(
  config: Record<string, unknown>,
  envPath: string,
): Record<string, unknown> {
  const cleaned = structuredClone(config);
  const env = readEnvFile(envPath);
  const tokenStatus: Record<string, { set: boolean; masked: string }> = {};

  for (const [envKey, configPath] of Object.entries(SENSITIVE_TOKEN_MAP)) {
    const envValue = env[envKey];
    const configValue = getNestedValue(cleaned, configPath) as string | undefined;

    // Prefer env value, fall back to config value
    const value = envValue ?? configValue ?? "";
    tokenStatus[envKey] = {
      set: !!value,
      masked: value ? maskToken(value) : "",
    };

    // Strip the sensitive field from the config response
    deleteNestedValue(cleaned, configPath);
  }

  cleaned.tokenStatus = tokenStatus;
  return cleaned;
}

/** Strip any sensitive token fields from a config object before saving. */
function stripTokensFromConfig(config: Record<string, unknown>): Record<string, unknown> {
  const cleaned = structuredClone(config);
  for (const configPath of Object.values(SENSITIVE_TOKEN_MAP)) {
    deleteNestedValue(cleaned, configPath);
  }
  // Also remove tokenStatus if frontend accidentally sends it back
  delete cleaned.tokenStatus;
  return cleaned;
}

export function setupApiRoutes(app: Hono, deps: WebAppDeps): void {
  app.use("/api/*", cors());

  app.get("/api/health", (c) => c.json({ status: "ok" }));

  app.get("/api/config", (c) => {
    const config = loadConfig(deps.configPath);
    return c.json(
      prepareConfigResponse(config as unknown as Record<string, unknown>, deps.envPath),
    );
  });

  app.put("/api/config", async (c) => {
    const body = await c.req.json();
    if (typeof body !== "object" || body === null || Array.isArray(body)) {
      return c.json({ error: "Invalid config: must be a JSON object" }, 400);
    }
    // Strip any token fields before saving to config.json
    const cleaned = stripTokensFromConfig(body as Record<string, unknown>);
    writeFileSync(deps.configPath, JSON.stringify(cleaned, null, 2));
    return c.json({ ok: true });
  });

  app.put("/api/tokens", async (c) => {
    const body = await c.req.json();
    if (typeof body !== "object" || body === null || Array.isArray(body)) {
      return c.json({ error: "Invalid tokens: must be a JSON object" }, 400);
    }

    const tokens = body as Record<string, string>;
    const unknownKeys = Object.keys(tokens).filter((k) => !(k in SENSITIVE_TOKEN_MAP));
    if (unknownKeys.length > 0) {
      return c.json({ error: `Unknown token keys: ${unknownKeys.join(", ")}` }, 400);
    }

    for (const [key, value] of Object.entries(tokens)) {
      if (typeof value !== "string") {
        return c.json({ error: `Token value for ${key} must be a string` }, 400);
      }
      writeEnvValue(deps.envPath, key, value);
    }

    return c.json({ ok: true });
  });

  app.get("/api/docs", (c) => {
    if (!existsSync(deps.guidesDir)) {
      return c.json({ docs: [] });
    }
    const files = readdirSync(deps.guidesDir)
      .filter((f) => f.endsWith(".md"))
      .map((f) => f.replace(".md", ""));
    return c.json({ docs: files });
  });

  app.get("/api/docs/:slug", (c) => {
    const slug = c.req.param("slug");
    const filePath = resolve(deps.guidesDir, `${slug}.md`);
    if (!filePath.startsWith(resolve(deps.guidesDir))) {
      return c.json({ error: "Not found" }, 404);
    }
    if (!existsSync(filePath)) {
      return c.json({ error: "Not found" }, 404);
    }
    const content = readFileSync(filePath, "utf-8");
    return c.json({ slug, content });
  });

  app.post("/api/upload", async (c) => {
    const body = await c.req.parseBody();
    const file = body["file"];
    if (!(file instanceof File)) {
      return c.json({ error: "No file provided" }, 400);
    }

    const ext = extname(file.name) || ".bin";
    const buffer = Buffer.from(await file.arrayBuffer());
    const path = saveMediaFile(buffer, ext);
    const mimeType = file.type || "application/octet-stream";

    const type: MediaType = mimeType.startsWith("image/")
      ? "image"
      : mimeType.startsWith("audio/")
        ? "audio"
        : "document";

    const attachment: MediaAttachment = {
      type,
      path,
      mimeType,
      originalName: file.name,
    };

    return c.json(attachment);
  });
}

interface WebAdapterOptions {
  port: number;
  host: string;
  onMessage: MessageHandler;
}

export function createWebAdapter(options: WebAdapterOptions): ChannelAdapter {
  const { port, host, onMessage } = options;
  const app = new Hono();
  const nodeWs = createNodeWebSocket({ app });

  const configPath = join(PROJECT_ROOT, "config.json");
  const guidesDir = join(PROJECT_ROOT, "docs", "guides");
  const envPath = join(PROJECT_ROOT, ".env");
  setupApiRoutes(app, { configPath, guidesDir, envPath });

  let server: ReturnType<typeof serve> | null = null;
  const wsClients = new Set<{ send: (data: string) => void; close: () => void }>();

  // WebSocket endpoint
  app.get(
    "/ws",
    nodeWs.upgradeWebSocket(() => ({
      onOpen(_event, ws) {
        wsClients.add(ws);
        logger.info("WebSocket client connected");
      },
      onClose(_event, ws) {
        wsClients.delete(ws);
        logger.info("WebSocket client disconnected");
      },
      async onMessage(event, ws) {
        try {
          const raw = typeof event.data === "string" ? event.data : JSON.stringify(event.data);
          const data = JSON.parse(raw) as {
            type: string;
            text: string;
            media?: MediaAttachment[];
          };
          ws.send(JSON.stringify({ type: "typing" }));

          const result = await onMessage({
            chatId: "web-default",
            text: data.text,
            senderId: "web-user",
            platform: "web",
            media: data.media,
          });

          ws.send(JSON.stringify({ type: "response", text: result.text, done: true }));
        } catch (err) {
          logger.error({ err }, "WebSocket message error");
          ws.send(JSON.stringify({ type: "error", message: "Failed to process message" }));
        }
      },
    })),
  );

  // Serve uploaded media files
  app.get("/api/media/:filename", (c) => {
    const filename = c.req.param("filename");
    const mediaDir = join(PROJECT_ROOT, "store", "media");
    const filePath = resolve(mediaDir, filename);
    if (!filePath.startsWith(resolve(mediaDir)) || !existsSync(filePath)) {
      return c.notFound();
    }
    const content = readFileSync(filePath);
    const ext = extname(filename).slice(1);
    const mimeTypes: Record<string, string> = {
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      png: "image/png",
      gif: "image/gif",
      webp: "image/webp",
      ogg: "audio/ogg",
      mp3: "audio/mpeg",
      mp4: "video/mp4",
      pdf: "application/pdf",
    };
    return new Response(content, {
      headers: { "Content-Type": mimeTypes[ext] || "application/octet-stream" },
    });
  });

  // Static files — serve built React app
  const webDistDir = join(PROJECT_ROOT, "web", "dist");

  app.get("*", (c) => {
    const urlPath = new URL(c.req.url).pathname;
    const filePath = join(webDistDir, urlPath === "/" ? "index.html" : urlPath);

    if (existsSync(filePath)) {
      const content = readFileSync(filePath);
      const ext = filePath.split(".").pop() ?? "";
      const mimeTypes: Record<string, string> = {
        html: "text/html",
        js: "application/javascript",
        css: "text/css",
        json: "application/json",
        png: "image/png",
        jpg: "image/jpeg",
        svg: "image/svg+xml",
        ico: "image/x-icon",
        woff2: "font/woff2",
        woff: "font/woff",
      };
      return new Response(content, {
        headers: { "Content-Type": mimeTypes[ext] || "application/octet-stream" },
      });
    }

    // SPA fallback — serve index.html for client-side routing
    const indexPath = join(webDistDir, "index.html");
    if (existsSync(indexPath)) {
      return c.html(readFileSync(indexPath, "utf-8"));
    }
    return c.text("Web UI not built. Run: cd web && npm run build", 404);
  });

  return {
    id: "web",
    async start() {
      server = serve({ fetch: app.fetch, port, hostname: host }, (info) => {
        logger.info({ port: info.port, host }, "Web server started");
        console.log(`\n  Clio Web UI: http://${host}:${info.port}\n`);
      });
      nodeWs.injectWebSocket(server);
    },
    async stop() {
      server?.close();
      for (const ws of wsClients) {
        ws.close();
      }
    },
    async send(_chatId: string, text: string) {
      const message = JSON.stringify({ type: "response", text, done: true });
      for (const ws of wsClients) {
        ws.send(message);
      }
    },
  };
}
