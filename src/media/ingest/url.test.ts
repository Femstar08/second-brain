import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../logger.js", () => ({
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
}));

import { ingestUrl } from "./url.js";

const HTML_WITH_ARTICLE = `<!DOCTYPE html>
<html>
  <head><title>Test Article Title</title></head>
  <body>
    <article>
      <h1>Test Article Title</h1>
      <p>This is the main article content. It has enough words to be extracted properly by Readability.</p>
      <p>More content here to make the article substantial enough for parsing.</p>
    </article>
  </body>
</html>`;

const HTML_NO_ARTICLE = `<!DOCTYPE html>
<html>
  <head><title>Simple Page</title></head>
  <body>
    <p>Just a simple page with some text content here.</p>
  </body>
</html>`;

describe("ingestUrl", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  it("returns ProcessedMedia with extracted content on success", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => HTML_WITH_ARTICLE,
    });
    vi.stubGlobal("fetch", mockFetch);

    const result = await ingestUrl("https://example.com/article");

    expect(result.type).toBe("url");
    expect(result.sourcePath).toBe("https://example.com/article");
    expect(result.error).toBeUndefined();
    expect(result.metadata.mimeType).toBe("text/html");
    expect(mockFetch).toHaveBeenCalledWith("https://example.com/article");
  });

  it("includes title in description", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => HTML_WITH_ARTICLE,
    });
    vi.stubGlobal("fetch", mockFetch);

    const result = await ingestUrl("https://example.com/article");

    expect(result.description).toContain("Test Article Title");
  });

  it("returns error result when fetch fails with non-ok response", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      statusText: "Not Found",
    });
    vi.stubGlobal("fetch", mockFetch);

    const result = await ingestUrl("https://example.com/missing");

    expect(result.type).toBe("url");
    expect(result.error).toBeDefined();
    expect(result.sourcePath).toBe("https://example.com/missing");
  });

  it("returns error result when fetch throws", async () => {
    const mockFetch = vi.fn().mockRejectedValue(new Error("network error"));
    vi.stubGlobal("fetch", mockFetch);

    const result = await ingestUrl("https://example.com/broken");

    expect(result.type).toBe("url");
    expect(result.error).toBeDefined();
    expect(result.error).toContain("network error");
    expect(result.sourcePath).toBe("https://example.com/broken");
  });

  it("never throws — always returns ProcessedMedia", async () => {
    const mockFetch = vi.fn().mockRejectedValue(new Error("unexpected failure"));
    vi.stubGlobal("fetch", mockFetch);

    await expect(ingestUrl("https://example.com")).resolves.toBeDefined();
  });

  it("returns extractedText with full text content", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => HTML_WITH_ARTICLE,
    });
    vi.stubGlobal("fetch", mockFetch);

    const result = await ingestUrl("https://example.com/article");

    expect(result.extractedText).toBeDefined();
    expect(result.extractedText).toContain("article content");
  });

  it("handles pages where readability cannot extract article", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => HTML_NO_ARTICLE,
    });
    vi.stubGlobal("fetch", mockFetch);

    const result = await ingestUrl("https://example.com/simple");

    expect(result.type).toBe("url");
    // Should not throw, should return some result
    expect(result.sourcePath).toBe("https://example.com/simple");
  });
});
