import { describe, it, expect, vi, beforeEach } from "vitest";
import type { MediaAttachment } from "../types.js";

// Mock modules before importing the module under test
vi.mock("node:child_process", () => ({
  execSync: vi.fn(),
}));

vi.mock("node:fs", () => ({
  readFileSync: vi.fn(),
  statSync: vi.fn(),
}));

vi.mock("../../logger.js", () => ({
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
}));

import { execSync } from "node:child_process";
import { readFileSync, statSync } from "node:fs";
import { ingestAudio } from "./audio.js";

const mockExecSync = vi.mocked(execSync);
const mockReadFileSync = vi.mocked(readFileSync);
const mockStatSync = vi.mocked(statSync);

const makeAttachment = (overrides?: Partial<MediaAttachment>): MediaAttachment => ({
  type: "audio",
  path: "/tmp/test-audio.ogg",
  mimeType: "audio/ogg",
  originalName: "voice.ogg",
  ...overrides,
});

describe("ingestAudio", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStatSync.mockReturnValue({ size: 12345 } as ReturnType<typeof statSync>);
  });

  it("returns transcription from /tmp output file on success", async () => {
    mockExecSync.mockReturnValue("");
    mockReadFileSync.mockReturnValue("Hello, this is a test transcription." as unknown as Buffer);

    const result = await ingestAudio(makeAttachment());

    expect(result.type).toBe("audio");
    expect(result.description).toBe("Hello, this is a test transcription.");
    expect(result.sourcePath).toBe("/tmp/test-audio.ogg");
    expect(result.metadata.mimeType).toBe("audio/ogg");
    expect(result.metadata.originalName).toBe("voice.ogg");
    expect(result.error).toBeUndefined();
  });

  it("falls back to stdout when /tmp file is not found", async () => {
    mockExecSync.mockReturnValue("Transcribed from stdout");
    mockReadFileSync.mockImplementation(() => {
      throw new Error("file not found");
    });

    const result = await ingestAudio(makeAttachment());

    expect(result.description).toBe("Transcribed from stdout");
    expect(result.error).toBeUndefined();
  });

  it("returns error result when whisper fails", async () => {
    mockExecSync.mockImplementation(() => {
      throw new Error("whisper not found");
    });

    const result = await ingestAudio(makeAttachment());

    expect(result.description).toBe("[Audio transcription failed]");
    expect(result.error).toBeDefined();
    expect(result.error).toContain("whisper not found");
    expect(result.type).toBe("audio");
    expect(result.sourcePath).toBe("/tmp/test-audio.ogg");
  });

  it("never throws — returns error result on unexpected failure", async () => {
    mockExecSync.mockImplementation(() => {
      throw new Error("unexpected");
    });

    await expect(ingestAudio(makeAttachment())).resolves.toBeDefined();
  });

  it("includes size in metadata when statSync succeeds", async () => {
    mockExecSync.mockReturnValue("");
    mockReadFileSync.mockReturnValue("text" as unknown as Buffer);

    const result = await ingestAudio(makeAttachment());

    expect(result.metadata.size).toBe(12345);
  });
});
