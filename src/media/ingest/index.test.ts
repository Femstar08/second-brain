import { describe, it, expect, vi, beforeEach } from "vitest";
import type { MediaAttachment } from "../types.js";

vi.mock("./audio.js", () => ({
  ingestAudio: vi.fn(),
}));

vi.mock("./document.js", () => ({
  ingestDocument: vi.fn(),
}));

vi.mock("./image.js", () => ({
  ingestImage: vi.fn(),
}));

vi.mock("./video.js", () => ({
  ingestVideo: vi.fn(),
}));

vi.mock("./url.js", () => ({
  ingestUrl: vi.fn(),
}));

vi.mock("../../logger.js", () => ({
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
}));

import { ingestAudio } from "./audio.js";
import { ingestDocument } from "./document.js";
import { ingestImage } from "./image.js";
import { ingestVideo } from "./video.js";
import { ingestUrl } from "./url.js";
import { ingestMedia, buildMediaFallback } from "./index.js";
import type { SecondBrainConfig } from "../../config.js";

const mockIngestAudio = vi.mocked(ingestAudio);
const mockIngestDocument = vi.mocked(ingestDocument);
const mockIngestImage = vi.mocked(ingestImage);
const mockIngestVideo = vi.mocked(ingestVideo);
const mockIngestUrl = vi.mocked(ingestUrl);

const makeConfig = (): SecondBrainConfig => ({
  provider: "claude",
  onboarded: false,
  providers: {
    claude: {},
    codex: {},
    openai: { model: "gpt-4o" },
    openrouter: { model: "anthropic/claude-sonnet-4-6" },
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
    },
    store: {
      archiveDays: 7,
      localRetentionDays: 30,
      archiveDeleteLocal: false,
      driveFolderName: "second-brain-media",
      driveAccount: "personal",
    },
  },
});

const makeAttachment = (type: MediaAttachment["type"], overrides?: Partial<MediaAttachment>): MediaAttachment => ({
  type,
  path: `/tmp/test.${type}`,
  mimeType: `${type}/test`,
  originalName: `test.${type}`,
  ...overrides,
});

const makeResult = (type: MediaAttachment["type"]) => ({
  type,
  description: `processed ${type}`,
  sourcePath: `/tmp/test.${type}`,
  metadata: { mimeType: `${type}/test` },
});

describe("ingestMedia", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIngestAudio.mockResolvedValue(makeResult("audio") as ReturnType<typeof mockIngestAudio> extends Promise<infer T> ? T : never);
    mockIngestDocument.mockResolvedValue(makeResult("document") as ReturnType<typeof mockIngestDocument> extends Promise<infer T> ? T : never);
    mockIngestImage.mockResolvedValue(makeResult("image") as ReturnType<typeof mockIngestImage> extends Promise<infer T> ? T : never);
    mockIngestVideo.mockResolvedValue(makeResult("video") as ReturnType<typeof mockIngestVideo> extends Promise<infer T> ? T : never);
    mockIngestUrl.mockResolvedValue(makeResult("url") as ReturnType<typeof mockIngestUrl> extends Promise<infer T> ? T : never);
  });

  it("routes audio attachment to ingestAudio", async () => {
    const attachment = makeAttachment("audio");
    const result = await ingestMedia(attachment, makeConfig());

    expect(mockIngestAudio).toHaveBeenCalledWith(attachment);
    expect(result.type).toBe("audio");
  });

  it("routes document attachment to ingestDocument", async () => {
    const attachment = makeAttachment("document");
    const result = await ingestMedia(attachment, makeConfig());

    expect(mockIngestDocument).toHaveBeenCalledWith(attachment);
    expect(result.type).toBe("document");
  });

  it("routes image attachment to ingestImage with vision config", async () => {
    const attachment = makeAttachment("image");
    const config = makeConfig();
    const result = await ingestMedia(attachment, config);

    expect(mockIngestImage).toHaveBeenCalledWith(attachment, {
      provider: "claude",
      apiKey: undefined,
    });
    expect(result.type).toBe("image");
  });

  it("routes video attachment to ingestVideo with video config", async () => {
    const attachment = makeAttachment("video");
    const config = makeConfig();
    const result = await ingestMedia(attachment, config);

    expect(mockIngestVideo).toHaveBeenCalledWith(attachment, {
      keyframeInterval: 5,
      visionConfig: { provider: "claude", apiKey: undefined },
    });
    expect(result.type).toBe("video");
  });

  it("routes url attachment to ingestUrl", async () => {
    const attachment = makeAttachment("url", { path: "https://example.com" });
    const result = await ingestMedia(attachment, makeConfig());

    expect(mockIngestUrl).toHaveBeenCalledWith("https://example.com");
    expect(result.type).toBe("url");
  });

  it("passes openai apiKey when visionProvider is openai", async () => {
    const attachment = makeAttachment("image");
    const config = makeConfig();
    config.media.ingest.visionProvider = "openai";
    config.providers.openai.apiKey = "sk-test";

    await ingestMedia(attachment, config);

    expect(mockIngestImage).toHaveBeenCalledWith(attachment, {
      provider: "openai",
      apiKey: "sk-test",
    });
  });
});

describe("buildMediaFallback", () => {
  it("handles image attachment", () => {
    const result = buildMediaFallback([makeAttachment("image")]);
    expect(result).toBe("[Image attached]");
  });

  it("handles audio with transcription", () => {
    const attachment = { ...makeAttachment("audio"), transcription: "hello world" };
    const result = buildMediaFallback([attachment]);
    expect(result).toContain("[Voice message transcription]: hello world");
  });

  it("handles audio without transcription", () => {
    const result = buildMediaFallback([makeAttachment("audio")]);
    expect(result).toBe("[Voice message attached]");
  });

  it("handles document with extractedText", () => {
    const attachment = { ...makeAttachment("document"), originalName: "file.pdf", extractedText: "doc content" };
    const result = buildMediaFallback([attachment]);
    expect(result).toContain("[Document: file.pdf]");
    expect(result).toContain("doc content");
  });

  it("handles document without extractedText", () => {
    const attachment = { ...makeAttachment("document"), originalName: "report.pdf" };
    const result = buildMediaFallback([attachment]);
    expect(result).toBe("[Document attached: report.pdf]");
  });

  it("handles video attachment", () => {
    const result = buildMediaFallback([makeAttachment("video")]);
    expect(result).toBe("[Video attached]");
  });

  it("handles url attachment with extractedText", () => {
    const attachment = { ...makeAttachment("url"), path: "https://example.com", extractedText: "article text" };
    const result = buildMediaFallback([attachment]);
    expect(result).toContain("[URL content]: article text");
  });

  it("handles url attachment without extractedText", () => {
    const attachment = { ...makeAttachment("url"), path: "https://example.com" };
    const result = buildMediaFallback([attachment]);
    expect(result).toContain("[URL content]");
  });

  it("combines multiple attachments", () => {
    const attachments = [
      makeAttachment("image"),
      makeAttachment("video"),
    ];
    const result = buildMediaFallback(attachments);
    expect(result).toContain("[Image attached]");
    expect(result).toContain("[Video attached]");
  });
});
