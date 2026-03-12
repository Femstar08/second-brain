import { describe, it, expect, vi, beforeEach } from "vitest";
import type { MediaAttachment } from "../types.js";

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
import { ingestDocument } from "./document.js";

const mockExecSync = vi.mocked(execSync);
const mockReadFileSync = vi.mocked(readFileSync);
const mockStatSync = vi.mocked(statSync);

const makePdfAttachment = (overrides?: Partial<MediaAttachment>): MediaAttachment => ({
  type: "document",
  path: "/tmp/test.pdf",
  mimeType: "application/pdf",
  originalName: "doc.pdf",
  ...overrides,
});

const makeTextAttachment = (overrides?: Partial<MediaAttachment>): MediaAttachment => ({
  type: "document",
  path: "/tmp/notes.txt",
  mimeType: "text/plain",
  originalName: "notes.txt",
  ...overrides,
});

describe("ingestDocument", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStatSync.mockReturnValue({ size: 5000 } as ReturnType<typeof statSync>);
  });

  describe("PDF files", () => {
    it("extracts text from PDF using pdftotext", async () => {
      mockExecSync.mockReturnValue("Extracted PDF content here." as unknown as ReturnType<typeof execSync>);

      const result = await ingestDocument(makePdfAttachment());

      expect(result.type).toBe("document");
      expect(result.description).toBe("Extracted PDF content here.");
      expect(result.extractedText).toBe("Extracted PDF content here.");
      expect(result.sourcePath).toBe("/tmp/test.pdf");
      expect(result.metadata.mimeType).toBe("application/pdf");
      expect(result.error).toBeUndefined();
    });

    it("returns error result when pdftotext fails", async () => {
      mockExecSync.mockImplementation(() => {
        throw new Error("pdftotext not found");
      });

      const result = await ingestDocument(makePdfAttachment());

      expect(result.description).toBe("[PDF text extraction failed]");
      expect(result.extractedText).toBeUndefined();
      expect(result.error).toContain("pdftotext not found");
    });
  });

  describe("text/* files", () => {
    it("reads text file content directly", async () => {
      mockReadFileSync.mockReturnValue("Plain text content." as unknown as Buffer);

      const result = await ingestDocument(makeTextAttachment());

      expect(result.description).toBe("Plain text content.");
      expect(result.extractedText).toBe("Plain text content.");
      expect(result.error).toBeUndefined();
    });

    it("returns error result when text file cannot be read", async () => {
      mockReadFileSync.mockImplementation(() => {
        throw new Error("ENOENT: no such file");
      });

      const result = await ingestDocument(makeTextAttachment());

      expect(result.description).toBe("[Could not read document]");
      expect(result.error).toBeDefined();
    });

    it("handles text/markdown mime type", async () => {
      mockReadFileSync.mockReturnValue("# Heading" as unknown as Buffer);

      const result = await ingestDocument(makeTextAttachment({ mimeType: "text/markdown" }));

      expect(result.description).toBe("# Heading");
    });
  });

  describe("unsupported formats", () => {
    it("returns unsupported format message for unknown mime types", async () => {
      const result = await ingestDocument(makePdfAttachment({ mimeType: "application/octet-stream" }));

      expect(result.description).toBe("[Unsupported document format]");
      expect(result.error).toBeUndefined();
    });
  });

  it("never throws — returns result on unexpected failure", async () => {
    mockStatSync.mockImplementation(() => {
      throw new Error("stat failed");
    });

    await expect(ingestDocument(makePdfAttachment())).resolves.toBeDefined();
  });
});
