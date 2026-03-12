import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("./tts.js", () => ({
  generateSpeech: vi.fn(),
  synthesizeSpeech: vi.fn(),
}));

vi.mock("./image.js", () => ({
  generateImage: vi.fn(),
}));

vi.mock("./video.js", () => ({
  generateVideo: vi.fn(),
}));

import { generateMedia, getImageApiKey } from "./index.js";
import { generateSpeech } from "./tts.js";
import { generateImage } from "./image.js";
import * as videoModule from "./video.js";
import type { SecondBrainConfig } from "../../config.js";

const mockGenerateSpeech = vi.mocked(generateSpeech);
const mockGenerateImage = vi.mocked(generateImage);
const mockGenerateVideo = vi.mocked(videoModule.generateVideo);

const makeConfig = (overrides?: Partial<SecondBrainConfig["media"]["generate"]>): SecondBrainConfig =>
  ({
    provider: "claude",
    onboarded: false,
    providers: {
      claude: {},
      codex: {},
      openai: { apiKey: "sk-openai", model: "gpt-4o" },
      openrouter: { apiKey: undefined, model: "anthropic/claude-sonnet-4-6" },
      ollama: { model: "llama3.1", baseUrl: "http://localhost:11434" },
    },
    channels: {
      web: { port: 3000, host: "localhost" },
      telegram: {},
      slack: {},
      discord: {},
    },
    heartbeat: {
      enabled: true,
      intervalMinutes: 30,
      activeHours: { start: "08:00", end: "22:00" },
    },
    memory: {
      mode: "full",
      embeddings: { enabled: false, provider: "openai" },
    },
    media: {
      ingest: {
        visionProvider: "claude",
        transcriptionProvider: "whisper-local",
        videoKeyframeInterval: 5,
      },
      generate: {
        imageProvider: "dall-e",
        ttsProvider: "gtts",
        ttsVoice: "onyx",
        ...overrides,
      },
      store: {
        archiveDays: 7,
        localRetentionDays: 30,
        archiveDeleteLocal: false,
        driveFolderName: "second-brain-media",
        driveAccount: "personal",
      },
    },
  }) as unknown as SecondBrainConfig;

describe("generateMedia", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("routes speech to generateSpeech", async () => {
    const fakeSpeech = {
      type: "speech" as const,
      path: "/store/abc.ogg",
      mimeType: "audio/ogg",
      size: 100,
      provider: "gtts",
      prompt: "hello",
    };
    mockGenerateSpeech.mockResolvedValue(fakeSpeech);

    const result = await generateMedia({ type: "speech", prompt: "hello" }, makeConfig());

    expect(mockGenerateSpeech).toHaveBeenCalledWith(
      { type: "speech", prompt: "hello" },
      expect.objectContaining({ provider: "gtts", voice: "onyx" }),
    );
    expect(result).toBe(fakeSpeech);
  });

  it("routes speech with openai key from config", async () => {
    mockGenerateSpeech.mockResolvedValue(null);
    const config = makeConfig({ ttsProvider: "openai" });

    await generateMedia({ type: "speech", prompt: "test" }, config);

    expect(mockGenerateSpeech).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({ provider: "openai", openaiApiKey: "sk-openai" }),
    );
  });

  it("returns null when generateSpeech returns null", async () => {
    mockGenerateSpeech.mockResolvedValue(null);

    const result = await generateMedia({ type: "speech", prompt: "" }, makeConfig());

    expect(result).toBeNull();
  });

  it("routes image to generateImage", async () => {
    const fakeImage = {
      type: "image" as const,
      path: "/store/img.png",
      mimeType: "image/png",
      size: 2048,
      provider: "dall-e",
      prompt: "a cat",
    };
    mockGenerateImage.mockResolvedValue(fakeImage);

    const result = await generateMedia({ type: "image", prompt: "a cat" }, makeConfig());

    expect(mockGenerateImage).toHaveBeenCalledWith(
      { type: "image", prompt: "a cat" },
      expect.objectContaining({ provider: "dall-e" }),
    );
    expect(result).toBe(fakeImage);
  });

  it("routes video to generateVideo", async () => {
    const fakeVideo = {
      type: "video" as const,
      path: "/store/vid.mp4",
      mimeType: "video/mp4",
      size: 5000,
      provider: "sora",
      prompt: "a scene",
    };
    mockGenerateVideo.mockResolvedValue(fakeVideo);

    const result = await generateMedia({ type: "video", prompt: "a scene" }, makeConfig());

    expect(videoModule.generateVideo).toHaveBeenCalledWith({ type: "video", prompt: "a scene" });
    expect(result).toBe(fakeVideo);
  });
});


describe("getImageApiKey", () => {
  beforeEach(() => {
    delete process.env.OPENAI_API_KEY;
    delete process.env.FLUX_API_KEY;
    delete process.env.NANOBANANA_API_KEY;
  });

  it("returns OPENAI_API_KEY for dall-e", () => {
    process.env.OPENAI_API_KEY = "sk-openai";
    expect(getImageApiKey("dall-e")).toBe("sk-openai");
  });

  it("returns FLUX_API_KEY for flux", () => {
    process.env.FLUX_API_KEY = "flux-key";
    expect(getImageApiKey("flux")).toBe("flux-key");
  });

  it("returns NANOBANANA_API_KEY for nanobanana", () => {
    process.env.NANOBANANA_API_KEY = "nb-key";
    expect(getImageApiKey("nanobanana")).toBe("nb-key");
  });

  it("returns undefined for unknown provider", () => {
    expect(getImageApiKey("unknown")).toBeUndefined();
  });
});
