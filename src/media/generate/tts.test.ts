import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("node:child_process", () => ({
  execSync: vi.fn(),
}));

vi.mock("node:fs", () => ({
  writeFileSync: vi.fn(),
  unlinkSync: vi.fn(),
  existsSync: vi.fn().mockReturnValue(false),
  readFileSync: vi.fn().mockReturnValue(Buffer.from("audio data")),
  statSync: vi.fn().mockReturnValue({ size: 1234 }),
}));

vi.mock("../../logger.js", () => ({
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
}));

vi.mock("../store/local.js", () => ({
  saveMediaFile: vi.fn().mockReturnValue("/store/media/2026-03-12/abc.ogg"),
}));

import { execSync } from "node:child_process";
import { generateSpeech, synthesizeSpeech } from "./tts.js";
import { saveMediaFile } from "../store/local.js";

const mockExecSync = vi.mocked(execSync);
const mockSaveMediaFile = vi.mocked(saveMediaFile);

describe("generateSpeech", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSaveMediaFile.mockReturnValue("/store/media/2026-03-12/abc.ogg");
    mockExecSync.mockReturnValue("");
  });

  it("returns null when provider is off", async () => {
    const result = await generateSpeech(
      { type: "speech", prompt: "hello world" },
      { provider: "off" },
    );
    expect(result).toBeNull();
  });

  it("returns null when prompt is empty", async () => {
    const result = await generateSpeech(
      { type: "speech", prompt: "   " },
      { provider: "gtts" },
    );
    expect(result).toBeNull();
  });

  it("returns null when prompt is empty string", async () => {
    const result = await generateSpeech(
      { type: "speech", prompt: "" },
      { provider: "gtts" },
    );
    expect(result).toBeNull();
  });

  it("returns GeneratedMedia with gtts provider", async () => {
    const result = await generateSpeech(
      { type: "speech", prompt: "hello" },
      { provider: "gtts" },
    );

    expect(result).not.toBeNull();
    expect(result!.type).toBe("speech");
    expect(result!.mimeType).toBe("audio/ogg");
    expect(result!.provider).toBe("gtts");
    expect(result!.prompt).toBe("hello");
    expect(result!.path).toBe("/store/media/2026-03-12/abc.ogg");
    expect(mockSaveMediaFile).toHaveBeenCalledWith(expect.any(Buffer), ".ogg");
  });

  it("calls OpenAI TTS API when provider is openai", async () => {
    const mockResponse = {
      ok: true,
      arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(8)),
    };
    global.fetch = vi.fn().mockResolvedValue(mockResponse);

    const result = await generateSpeech(
      { type: "speech", prompt: "hello openai" },
      { provider: "openai", openaiApiKey: "sk-test", voice: "alloy" },
    );

    expect(global.fetch).toHaveBeenCalledWith(
      "https://api.openai.com/v1/audio/speech",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer sk-test",
        }),
      }),
    );
    expect(result!.provider).toBe("openai");
    expect(result!.type).toBe("speech");
  });

  it("throws when OpenAI TTS API returns error", async () => {
    const mockResponse = {
      ok: false,
      status: 401,
      text: vi.fn().mockResolvedValue("Unauthorized"),
    };
    global.fetch = vi.fn().mockResolvedValue(mockResponse);

    await expect(
      generateSpeech(
        { type: "speech", prompt: "hello" },
        { provider: "openai", openaiApiKey: "bad-key" },
      ),
    ).rejects.toThrow("OpenAI TTS API error 401");
  });

  it("throws when gtts fails", async () => {
    mockExecSync.mockImplementation(() => {
      throw new Error("python3 not found");
    });

    await expect(
      generateSpeech({ type: "speech", prompt: "hello" }, { provider: "gtts" }),
    ).rejects.toThrow("python3 not found");
  });

  it("strips markdown from prompt before synthesis", async () => {
    await generateSpeech(
      { type: "speech", prompt: "**bold** and `code`" },
      { provider: "gtts" },
    );

    // execSync is called with python3 command writing text to file
    // The writeFileSync mock is called with stripped text
    const { writeFileSync } = await import("node:fs");
    const mockWrite = vi.mocked(writeFileSync);
    expect(mockWrite).toHaveBeenCalledWith(
      expect.stringContaining("/tmp/tts-input-"),
      "bold and code",
      "utf-8",
    );
  });
});

describe("synthesizeSpeech", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSaveMediaFile.mockReturnValue("/store/media/2026-03-12/abc.ogg");
    mockExecSync.mockReturnValue("");
  });

  it("returns null when provider is off", async () => {
    const result = await synthesizeSpeech("hello", { provider: "off" });
    expect(result).toBeNull();
  });

  it("returns null when text is empty", async () => {
    const result = await synthesizeSpeech("", { provider: "gtts" });
    expect(result).toBeNull();
  });

  it("returns file path on success", async () => {
    const result = await synthesizeSpeech("hello world", { provider: "gtts" });
    expect(result).toBe("/store/media/2026-03-12/abc.ogg");
  });

  it("returns null on error (backward compat)", async () => {
    mockExecSync.mockImplementation(() => {
      throw new Error("gtts failed");
    });

    const result = await synthesizeSpeech("hello", { provider: "gtts" });
    expect(result).toBeNull();
  });
});
