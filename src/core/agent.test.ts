import { mkdirSync, rmSync, writeFileSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { initDatabase } from "../db.js";
import { createRouter } from "../providers/router.js";
import type { Provider } from "../providers/types.js";
import { createAgent } from "./agent.js";

const tmpDir = join(import.meta.dirname, "../../.test-tmp-agent");
const memDir = join(tmpDir, "memory");
const storeDir = join(tmpDir, "store");

const mockProvider: Provider = {
  id: "mock",
  async send(prompt) {
    return { text: `response to: ${prompt.slice(-20)}`, sessionId: "sess-1" };
  },
};

describe("agent core", () => {
  beforeEach(() => {
    mkdirSync(join(memDir, "daily"), { recursive: true });
    mkdirSync(storeDir, { recursive: true });
    writeFileSync(join(memDir, "soul.md"), "# Soul\nBe helpful.");
    writeFileSync(join(memDir, "user.md"), "# User");
    writeFileSync(join(memDir, "memory.md"), "# Memory");
    writeFileSync(join(memDir, "agent.md"), "# Agent");
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("handles a message and returns a response", async () => {
    const db = initDatabase(join(storeDir, "test.db"));
    const agent = createAgent({
      provider: mockProvider,
      db,
      memoryDir: memDir,
      memoryMode: "full",
    });

    const result = await agent.handleMessage({
      chatId: "chat-1",
      text: "Hello world",
      senderId: "user-1",
      platform: "test",
    });
    expect(result.text).toContain("response to:");
    db.close();
  });

  it("appends to daily log after response", async () => {
    const db = initDatabase(join(storeDir, "test.db"));
    const agent = createAgent({
      provider: mockProvider,
      db,
      memoryDir: memDir,
      memoryMode: "full",
    });

    await agent.handleMessage({
      chatId: "chat-1",
      text: "Remember this",
      senderId: "user-1",
      platform: "test",
    });
    const today = new Date().toISOString().slice(0, 10);
    const log = readFileSync(join(memDir, "daily", `${today}.md`), "utf-8");
    expect(log).toContain("Remember this");
    db.close();
  });

  it("saves session from provider response", async () => {
    const db = initDatabase(join(storeDir, "test.db"));
    const agent = createAgent({
      provider: mockProvider,
      db,
      memoryDir: memDir,
      memoryMode: "full",
    });

    await agent.handleMessage({
      chatId: "chat-1",
      text: "Hello",
      senderId: "user-1",
      platform: "test",
    });

    const { getSession } = await import("../db.js");
    const session = getSession(db, "chat-1", "mock");
    expect(session).toBe("sess-1");
    db.close();
  });

  it("skips memory writes in none mode", async () => {
    const db = initDatabase(join(storeDir, "test.db"));
    const agent = createAgent({
      provider: mockProvider,
      db,
      memoryDir: memDir,
      memoryMode: "none",
    });

    await agent.handleMessage({
      chatId: "chat-1",
      text: "This should not be logged to daily file",
      senderId: "user-1",
      platform: "test",
    });

    const today = new Date().toISOString().slice(0, 10);
    const logPath = join(memDir, "daily", `${today}.md`);
    let logExists = false;
    try {
      readFileSync(logPath);
      logExists = true;
    } catch {
      // expected: file should not exist
    }
    expect(logExists).toBe(false);
    db.close();
  });

  it("saves conversation turn to FTS in full mode", async () => {
    const db = initDatabase(join(storeDir, "test.db"));
    const agent = createAgent({
      provider: mockProvider,
      db,
      memoryDir: memDir,
      memoryMode: "full",
    });

    // Send a message long enough to be saved (>20 chars)
    await agent.handleMessage({
      chatId: "chat-1",
      text: "I prefer using TypeScript for all my projects",
      senderId: "user-1",
      platform: "test",
    });

    const memories = db.prepare("SELECT content FROM memories WHERE chat_id = ?").all("chat-1") as {
      content: string;
    }[];
    expect(memories.length).toBeGreaterThan(0);
    expect(memories[0].content).toContain("TypeScript");
    db.close();
  });

  it("/provider shows current provider and available list", async () => {
    const db = initDatabase(join(storeDir, "test.db"));
    const otherProvider: Provider = { id: "other", async send() { return { text: "other" }; } };
    const router = createRouter({ mock: mockProvider, other: otherProvider }, "mock");

    const agent = createAgent({
      provider: mockProvider,
      db,
      memoryDir: memDir,
      memoryMode: "none",
      router,
      availableProviders: ["mock", "other"],
    });

    const result = await agent.handleMessage({
      chatId: "chat-1",
      text: "/provider",
      senderId: "user-1",
      platform: "test",
    });
    expect(result.text).toContain("Current provider: mock");
    expect(result.text).toContain("mock, other");
    db.close();
  });

  it("/provider <name> switches the active provider", async () => {
    const db = initDatabase(join(storeDir, "test.db"));
    const otherProvider: Provider = { id: "other", async send() { return { text: "other" }; } };
    const router = createRouter({ mock: mockProvider, other: otherProvider }, "mock");

    const agent = createAgent({
      provider: mockProvider,
      db,
      memoryDir: memDir,
      memoryMode: "none",
      router,
      availableProviders: ["mock", "other"],
    });

    const result = await agent.handleMessage({
      chatId: "chat-1",
      text: "/provider other",
      senderId: "user-1",
      platform: "test",
    });
    expect(result.text).toBe("Switched to other");
    expect(router.currentProvider()).toBe("other");
    db.close();
  });

  it("/provider rejects unknown provider", async () => {
    const db = initDatabase(join(storeDir, "test.db"));
    const router = createRouter({ mock: mockProvider }, "mock");

    const agent = createAgent({
      provider: mockProvider,
      db,
      memoryDir: memDir,
      memoryMode: "none",
      router,
      availableProviders: ["mock"],
    });

    const result = await agent.handleMessage({
      chatId: "chat-1",
      text: "/provider nope",
      senderId: "user-1",
      platform: "test",
    });
    expect(result.text).toContain('Unknown provider "nope"');
    db.close();
  });

  it("/newchat clears the session", async () => {
    const db = initDatabase(join(storeDir, "test.db"));
    const { setSession, getSession } = await import("../db.js");
    setSession(db, "chat-1", "mock", "old-session");

    const agent = createAgent({
      provider: mockProvider,
      db,
      memoryDir: memDir,
      memoryMode: "none",
    });

    const result = await agent.handleMessage({
      chatId: "chat-1",
      text: "/newchat",
      senderId: "user-1",
      platform: "test",
    });
    expect(result.text).toContain("Session cleared");
    expect(getSession(db, "chat-1", "mock")).toBeNull();
    db.close();
  });
});
