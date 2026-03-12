import { Readability } from "@mozilla/readability";
import { JSDOM } from "jsdom";
import { logger } from "../../logger.js";
import type { ProcessedMedia } from "../types.js";

export async function ingestUrl(url: string): Promise<ProcessedMedia> {
  const metadata = { mimeType: "text/html" };

  try {
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const html = await response.text();
    const dom = new JSDOM(html, { url });
    const reader = new Readability(dom.window.document);
    const article = reader.parse();

    if (article) {
      const title = article.title ?? "";
      const textContent = article.textContent ?? "";
      const summary = textContent.slice(0, 500).trim();
      const description = title ? `${title}\n${summary}` : summary;

      return {
        type: "url",
        description,
        extractedText: textContent,
        sourcePath: url,
        metadata,
      };
    }

    // Readability couldn't extract an article — fall back to page title + raw text
    const title = dom.window.document.title ?? "";
    const bodyText = dom.window.document.body?.textContent ?? "";
    const summary = bodyText.slice(0, 500).trim();
    const description = title ? `${title}\n${summary}` : summary;

    return {
      type: "url",
      description,
      extractedText: bodyText,
      sourcePath: url,
      metadata,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error({ err, url }, "URL ingest failed");

    return {
      type: "url",
      description: "[URL content unavailable]",
      sourcePath: url,
      metadata,
      error: message,
    };
  }
}
