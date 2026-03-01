import { mkdirSync, rmSync, writeFileSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { Hono } from "hono";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { setupApiRoutes } from "./web.js";

const tmpDir = join(import.meta.dirname, "../../.test-tmp-web");

describe("web adapter HTTP API", () => {
  beforeEach(() => {
    mkdirSync(tmpDir, { recursive: true });
    mkdirSync(join(tmpDir, "guides"), { recursive: true });
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  function createTestApp() {
    const configPath = join(tmpDir, "config.json");
    writeFileSync(configPath, JSON.stringify({ provider: "claude", onboarded: false }));
    const app = new Hono();
    setupApiRoutes(app, { configPath, guidesDir: join(tmpDir, "guides") });
    return { app, configPath };
  }

  it("GET /api/health returns ok", async () => {
    const { app } = createTestApp();
    const res = await app.request("/api/health");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("ok");
  });

  it("GET /api/config returns config", async () => {
    const { app } = createTestApp();
    const res = await app.request("/api/config");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.provider).toBe("claude");
  });

  it("PUT /api/config writes config file", async () => {
    const { app, configPath } = createTestApp();
    const newConfig = { provider: "openai", onboarded: true };
    const res = await app.request("/api/config", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newConfig),
    });
    expect(res.status).toBe(200);
    const saved = JSON.parse(readFileSync(configPath, "utf-8"));
    expect(saved.provider).toBe("openai");
    expect(saved.onboarded).toBe(true);
  });

  it("GET /api/docs lists available docs", async () => {
    writeFileSync(join(tmpDir, "guides", "getting-started.md"), "# Getting Started");
    writeFileSync(join(tmpDir, "guides", "commands.md"), "# Commands");
    const { app } = createTestApp();
    const res = await app.request("/api/docs");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.docs).toContain("getting-started");
    expect(body.docs).toContain("commands");
  });

  it("GET /api/docs/:slug returns doc content", async () => {
    writeFileSync(join(tmpDir, "guides", "commands.md"), "# Commands\nList of commands");
    const { app } = createTestApp();
    const res = await app.request("/api/docs/commands");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.slug).toBe("commands");
    expect(body.content).toContain("# Commands");
  });

  it("GET /api/docs/:slug returns 404 for missing doc", async () => {
    const { app } = createTestApp();
    const res = await app.request("/api/docs/nonexistent");
    expect(res.status).toBe(404);
  });

  it("GET /api/docs/:slug rejects path traversal", async () => {
    const { app } = createTestApp();
    const res = await app.request("/api/docs/..%2F..%2Fetc%2Fpasswd");
    expect(res.status).toBe(404);
  });

  it("PUT /api/config rejects non-object body", async () => {
    const { app } = createTestApp();
    const res = await app.request("/api/config", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify("not an object"),
    });
    expect(res.status).toBe(400);
  });
});
