import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../store/local.js", () => ({
  saveMediaFile: vi.fn().mockReturnValue("/store/media/2026-03-12/img.png"),
}));

import { generateImage } from "./image.js";
import { saveMediaFile } from "../store/local.js";

const mockSaveMediaFile = vi.mocked(saveMediaFile);

describe("generateImage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSaveMediaFile.mockReturnValue("/store/media/2026-03-12/img.png");
  });

  describe("DALL-E", () => {
    it("returns GeneratedMedia on success", async () => {
      const fakeB64 = Buffer.from("fake image data").toString("base64");
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({
          data: [{ b64_json: fakeB64 }],
        }),
      });

      const result = await generateImage(
        { type: "image", prompt: "a cat" },
        { provider: "dall-e", apiKey: "sk-test" },
      );

      expect(result.type).toBe("image");
      expect(result.mimeType).toBe("image/png");
      expect(result.provider).toBe("dall-e");
      expect(result.prompt).toBe("a cat");
      expect(result.path).toBe("/store/media/2026-03-12/img.png");
      expect(mockSaveMediaFile).toHaveBeenCalledWith(expect.any(Buffer), ".png");
    });

    it("sends correct request to DALL-E API", async () => {
      const fakeB64 = Buffer.from("img").toString("base64");
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({ data: [{ b64_json: fakeB64 }] }),
      });

      await generateImage(
        { type: "image", prompt: "a landscape" },
        { provider: "dall-e", apiKey: "sk-key" },
      );

      expect(global.fetch).toHaveBeenCalledWith(
        "https://api.openai.com/v1/images/generations",
        expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining({
            Authorization: "Bearer sk-key",
          }),
        }),
      );

      const [, options] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
      const body = JSON.parse(options.body);
      expect(body.model).toBe("dall-e-3");
      expect(body.response_format).toBe("b64_json");
      expect(body.prompt).toBe("a landscape");
    });

    it("throws on DALL-E API failure", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 429,
        text: vi.fn().mockResolvedValue("Rate limit exceeded"),
      });

      await expect(
        generateImage(
          { type: "image", prompt: "a cat" },
          { provider: "dall-e", apiKey: "sk-test" },
        ),
      ).rejects.toThrow("DALL-E API error 429: Rate limit exceeded");
    });

    it("includes size from buffer length in result", async () => {
      const imageData = "fake image bytes with length";
      const fakeB64 = Buffer.from(imageData).toString("base64");
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({ data: [{ b64_json: fakeB64 }] }),
      });

      const result = await generateImage(
        { type: "image", prompt: "test" },
        { provider: "dall-e", apiKey: "sk-test" },
      );

      expect(result.size).toBe(Buffer.from(imageData).length);
    });
  });

  describe("Flux (placeholder)", () => {
    it("throws on Flux API failure", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        text: vi.fn().mockResolvedValue("Internal Server Error"),
      });

      await expect(
        generateImage(
          { type: "image", prompt: "a cat" },
          { provider: "flux", apiKey: "flux-key" },
        ),
      ).rejects.toThrow("Flux API error 500");
    });

    it("returns GeneratedMedia with flux provider on success", async () => {
      const fakeB64 = Buffer.from("flux image").toString("base64");
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({ image_b64: fakeB64 }),
      });

      const result = await generateImage(
        { type: "image", prompt: "a dog" },
        { provider: "flux", apiKey: "flux-key" },
      );

      expect(result.provider).toBe("flux");
      expect(result.type).toBe("image");
    });
  });

  describe("NanoBanana (placeholder)", () => {
    it("throws on NanoBanana API failure", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 503,
        text: vi.fn().mockResolvedValue("Service Unavailable"),
      });

      await expect(
        generateImage(
          { type: "image", prompt: "a cat" },
          { provider: "nanobanana", apiKey: "nb-key" },
        ),
      ).rejects.toThrow("NanoBanana API error 503");
    });

    it("returns GeneratedMedia with nanobanana provider on success", async () => {
      const fakeB64 = Buffer.from("nb image").toString("base64");
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({ image_b64: fakeB64 }),
      });

      const result = await generateImage(
        { type: "image", prompt: "a bird" },
        { provider: "nanobanana", apiKey: "nb-key" },
      );

      expect(result.provider).toBe("nanobanana");
      expect(result.type).toBe("image");
    });
  });
});
