import { describe, it, expect, vi, beforeEach } from "vitest";
import type { MediaAttachment } from "../types.js";

vi.mock("node:fs", () => ({
  readFileSync: vi.fn(),
  statSync: vi.fn(),
}));

vi.mock("../../logger.js", () => ({
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
}));

import { readFileSync, statSync } from "node:fs";
import { ingestImage } from "./image.js";

const mockReadFileSync = vi.mocked(readFileSync);
const mockStatSync = vi.mocked(statSync);

const makeAttachment = (overrides?: Partial<MediaAttachment>): MediaAttachment => ({
  type: "image",
  path: "/tmp/photo.jpg",
  mimeType: "image/jpeg",
  originalName: "photo.jpg",
  ...overrides,
});

describe("ingestImage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStatSync.mockReturnValue({ size: 98765 } as ReturnType<typeof statSync>);
  });

  describe("claude provider", () => {
    it("returns placeholder description without calling any API", async () => {
      const result = await ingestImage(makeAttachment(), { provider: "claude" });

      expect(result.type).toBe("image");
      expect(result.description).toBe("[Image attached — described by LLM provider]");
      expect(result.sourcePath).toBe("/tmp/photo.jpg");
      expect(result.metadata.mimeType).toBe("image/jpeg");
      expect(result.error).toBeUndefined();
      expect(mockReadFileSync).not.toHaveBeenCalled();
    });

    it("does not require an apiKey", async () => {
      const result = await ingestImage(makeAttachment(), { provider: "claude" });
      expect(result.error).toBeUndefined();
    });
  });

  describe("openai provider", () => {
    beforeEach(() => {
      const fakeImageBuffer = Buffer.from("fake-image-data");
      mockReadFileSync.mockReturnValue(fakeImageBuffer);
    });

    it("sends image to OpenAI vision API and returns description", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: "A photo of a cat sitting on a chair." } }],
        }),
      });
      vi.stubGlobal("fetch", mockFetch);

      const result = await ingestImage(makeAttachment(), {
        provider: "openai",
        apiKey: "test-api-key",
      });

      expect(result.description).toBe("A photo of a cat sitting on a chair.");
      expect(result.error).toBeUndefined();

      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toBe("https://api.openai.com/v1/chat/completions");
      const body = JSON.parse(options.body);
      expect(body.model).toBe("gpt-4o");
      expect(options.headers["Authorization"]).toBe("Bearer test-api-key");

      vi.unstubAllGlobals();
    });

    it("returns error result when OpenAI API responds with non-ok status", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        text: async () => "Unauthorized",
      });
      vi.stubGlobal("fetch", mockFetch);

      const result = await ingestImage(makeAttachment(), {
        provider: "openai",
        apiKey: "bad-key",
      });

      expect(result.description).toBe("[Image description failed]");
      expect(result.error).toBeDefined();

      vi.unstubAllGlobals();
    });

    it("returns error result when fetch throws", async () => {
      const mockFetch = vi.fn().mockRejectedValue(new Error("network error"));
      vi.stubGlobal("fetch", mockFetch);

      const result = await ingestImage(makeAttachment(), {
        provider: "openai",
        apiKey: "test-key",
      });

      expect(result.description).toBe("[Image description failed]");
      expect(result.error).toContain("network error");

      vi.unstubAllGlobals();
    });

    it("includes size in metadata", async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: "An image." } }],
        }),
      });
      vi.stubGlobal("fetch", mockFetch);

      const result = await ingestImage(makeAttachment(), {
        provider: "openai",
        apiKey: "test-key",
      });

      expect(result.metadata.size).toBe(98765);

      vi.unstubAllGlobals();
    });
  });

  it("never throws — always returns ProcessedMedia", async () => {
    mockStatSync.mockImplementation(() => {
      throw new Error("unexpected");
    });

    await expect(
      ingestImage(makeAttachment(), { provider: "claude" }),
    ).resolves.toBeDefined();
  });
});
