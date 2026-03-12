import { describe, it, expect, vi, beforeEach } from "vitest";
import type { MediaAttachment } from "../types.js";

vi.mock("node:child_process", () => ({
  execSync: vi.fn(),
}));

vi.mock("node:fs", () => ({
  mkdtempSync: vi.fn(),
  readdirSync: vi.fn(),
  rmSync: vi.fn(),
  statSync: vi.fn(),
}));

vi.mock("node:os", () => ({
  tmpdir: vi.fn(() => "/tmp"),
}));

vi.mock("./audio.js", () => ({
  ingestAudio: vi.fn(),
}));

vi.mock("./image.js", () => ({
  ingestImage: vi.fn(),
}));

vi.mock("../../logger.js", () => ({
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
}));

import { execSync } from "node:child_process";
import { mkdtempSync, readdirSync, rmSync, statSync } from "node:fs";
import { ingestAudio } from "./audio.js";
import { ingestImage } from "./image.js";
import { ingestVideo } from "./video.js";

const mockExecSync = vi.mocked(execSync);
const mockMkdtempSync = vi.mocked(mkdtempSync);
const mockReaddirSync = vi.mocked(readdirSync);
const mockRmSync = vi.mocked(rmSync);
const mockStatSync = vi.mocked(statSync);
const mockIngestAudio = vi.mocked(ingestAudio);
const mockIngestImage = vi.mocked(ingestImage);

const makeAttachment = (overrides?: Partial<MediaAttachment>): MediaAttachment => ({
  type: "video",
  path: "/tmp/video.mp4",
  mimeType: "video/mp4",
  originalName: "video.mp4",
  ...overrides,
});

const defaultConfig = {
  keyframeInterval: 5,
  visionConfig: { provider: "claude" as const },
};

describe("ingestVideo", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockMkdtempSync.mockReturnValue("/tmp/video-ingest-abc123");
    mockStatSync.mockReturnValue({ size: 5_000_000 } as ReturnType<typeof statSync>);

    // ffprobe returns duration JSON
    mockExecSync.mockImplementation((cmd: unknown) => {
      const cmdStr = String(cmd);
      if (cmdStr.includes("ffprobe")) {
        return JSON.stringify({ format: { duration: "30.0" } });
      }
      // ffmpeg keyframe and audio extraction — no return value needed
      return "";
    });

    // Two keyframe files
    mockReaddirSync.mockReturnValue(["frame_001.jpg", "frame_002.jpg"] as unknown as ReturnType<typeof readdirSync>);

    mockIngestImage.mockResolvedValue({
      type: "image",
      description: "A video frame showing a scene.",
      sourcePath: "/tmp/video-ingest-abc123/frame_001.jpg",
      metadata: { mimeType: "image/jpeg" },
    });

    mockIngestAudio.mockResolvedValue({
      type: "audio",
      description: "Transcribed audio content from video.",
      sourcePath: "/tmp/video-ingest-abc123/audio.opus",
      metadata: { mimeType: "audio/opus" },
    });
  });

  it("returns ProcessedMedia with combined visual and audio description", async () => {
    const result = await ingestVideo(makeAttachment(), defaultConfig);

    expect(result.type).toBe("video");
    expect(result.sourcePath).toBe("/tmp/video.mp4");
    expect(result.error).toBeUndefined();
    expect(result.description).toContain("video frame");
    expect(result.description).toContain("Transcribed audio");
  });

  it("calls ffprobe to get duration", async () => {
    await ingestVideo(makeAttachment(), defaultConfig);

    const ffprobeCall = mockExecSync.mock.calls.find((c) => String(c[0]).includes("ffprobe"));
    expect(ffprobeCall).toBeDefined();
  });

  it("calls ffmpeg to extract keyframes with configured interval", async () => {
    await ingestVideo(makeAttachment(), { ...defaultConfig, keyframeInterval: 10 });

    const keyframeCall = mockExecSync.mock.calls.find(
      (c) => String(c[0]).includes("fps=1/10"),
    );
    expect(keyframeCall).toBeDefined();
  });

  it("calls ffmpeg to extract audio", async () => {
    await ingestVideo(makeAttachment(), defaultConfig);

    const audioCall = mockExecSync.mock.calls.find(
      (c) => String(c[0]).includes("libopus"),
    );
    expect(audioCall).toBeDefined();
  });

  it("processes at most 5 keyframes", async () => {
    mockReaddirSync.mockReturnValue(
      ["frame_001.jpg", "frame_002.jpg", "frame_003.jpg", "frame_004.jpg", "frame_005.jpg", "frame_006.jpg", "frame_007.jpg"] as unknown as ReturnType<typeof readdirSync>,
    );

    await ingestVideo(makeAttachment(), defaultConfig);

    expect(mockIngestImage).toHaveBeenCalledTimes(5);
  });

  it("cleans up temp directory in finally", async () => {
    await ingestVideo(makeAttachment(), defaultConfig);

    expect(mockRmSync).toHaveBeenCalledWith("/tmp/video-ingest-abc123", { recursive: true, force: true });
  });

  it("cleans up temp directory even when ffmpeg fails", async () => {
    mockExecSync.mockImplementation((cmd: unknown) => {
      const cmdStr = String(cmd);
      if (cmdStr.includes("ffprobe")) {
        return JSON.stringify({ format: { duration: "30.0" } });
      }
      throw new Error("ffmpeg not found");
    });

    const result = await ingestVideo(makeAttachment(), defaultConfig);

    expect(result.error).toBeDefined();
    expect(mockRmSync).toHaveBeenCalledWith("/tmp/video-ingest-abc123", { recursive: true, force: true });
  });

  it("returns error result when ffprobe fails", async () => {
    mockExecSync.mockImplementation(() => {
      throw new Error("ffprobe failed");
    });

    const result = await ingestVideo(makeAttachment(), defaultConfig);

    expect(result.type).toBe("video");
    expect(result.error).toBeDefined();
    expect(result.error).toContain("ffprobe failed");
    expect(result.sourcePath).toBe("/tmp/video.mp4");
  });

  it("never throws — always returns ProcessedMedia", async () => {
    mockExecSync.mockImplementation(() => {
      throw new Error("catastrophic failure");
    });

    await expect(ingestVideo(makeAttachment(), defaultConfig)).resolves.toBeDefined();
  });

  it("includes duration in metadata", async () => {
    const result = await ingestVideo(makeAttachment(), defaultConfig);

    expect(result.metadata.duration).toBe(30);
  });

  it("passes visionConfig to ingestImage", async () => {
    const config = {
      keyframeInterval: 5,
      visionConfig: { provider: "openai" as const, apiKey: "test-key" },
    };

    await ingestVideo(makeAttachment(), config);

    expect(mockIngestImage).toHaveBeenCalledWith(
      expect.objectContaining({ type: "image" }),
      config.visionConfig,
    );
  });
});
