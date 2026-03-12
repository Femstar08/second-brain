import { Bot, type Context } from "grammy";
import { extname } from "node:path";
import { readFileSync } from "node:fs";
import { logger } from "../logger.js";
import { downloadAndSaveFile } from "../media/store/local.js";
import type { MediaAttachment, MediaType } from "../media/types.js";
import type { ChannelAdapter, MessageHandler } from "./adapter.js";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const pdfParse = require("pdf-parse");

export function createTelegramAdapter(
  botToken: string,
  allowedChatIds: string[],
  onMessage: MessageHandler,
): ChannelAdapter {
  const bot = new Bot(botToken);

  function isAuthorized(chatId: number): boolean {
    if (allowedChatIds.length === 0) {
      return true;
    } // first-run mode
    return allowedChatIds.includes(String(chatId));
  }

  function splitMessage(text: string, limit = 4096): string[] {
    if (text.length <= limit) {
      return [text];
    }
    const chunks: string[] = [];
    let remaining = text;
    while (remaining.length > 0) {
      if (remaining.length <= limit) {
        chunks.push(remaining);
        break;
      }
      let splitAt = remaining.lastIndexOf("\n", limit);
      if (splitAt === -1 || splitAt < limit / 2) {
        splitAt = limit;
      }
      chunks.push(remaining.slice(0, splitAt));
      remaining = remaining.slice(splitAt).trimStart();
    }
    return chunks;
  }

  function escapeHtml(text: string): string {
    return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  function formatForTelegram(text: string): string {
    // Protect code blocks
    const codeBlocks: string[] = [];
    let formatted = text.replace(/```[\s\S]*?```/g, (match) => {
      codeBlocks.push(match);
      return `__CODE_BLOCK_${codeBlocks.length - 1}__`;
    });

    // Inline code
    formatted = formatted.replace(/`([^`]+)`/g, "<code>$1</code>");
    // Bold
    formatted = formatted.replace(/\*\*(.+?)\*\*/g, "<b>$1</b>");
    // Italic
    formatted = formatted.replace(/\*(.+?)\*/g, "<i>$1</i>");
    // Strikethrough
    formatted = formatted.replace(/~~(.+?)~~/g, "<s>$1</s>");
    // Links
    formatted = formatted.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
    // Headings -> bold
    formatted = formatted.replace(/^#{1,6}\s+(.+)$/gm, "<b>$1</b>");

    // Restore code blocks
    formatted = formatted.replace(/__CODE_BLOCK_(\d+)__/g, (_, idx) => {
      const block = codeBlocks[Number(idx)];
      const match = block.match(/^```(\w*)\n?([\s\S]*?)```$/);
      if (match) {
        return `<pre><code>${escapeHtml(match[2])}</code></pre>`;
      }
      return `<pre><code>${escapeHtml(block.slice(3, -3))}</code></pre>`;
    });

    return formatted;
  }

  async function downloadTelegramFile(fileId: string): Promise<{ url: string; path: string }> {
    const file = await bot.api.getFile(fileId);
    const filePath = file.file_path!;
    const url = `https://api.telegram.org/file/bot${botToken}/${filePath}`;
    return { url, path: filePath };
  }

  /** Shared handler: start typing, call onMessage, send response chunks */
  async function handleAndRespond(
    ctx: Context,
    text: string,
    media?: MediaAttachment[],
  ): Promise<void> {
    const chatId = String(ctx.chat!.id);
    const senderId = String(ctx.from?.id ?? ctx.chat!.id);

    await ctx.api.sendChatAction(ctx.chat!.id, "typing").catch(() => { });
    const typingInterval = setInterval(() => {
      ctx.api.sendChatAction(ctx.chat!.id, "typing").catch(() => { });
    }, 3000);

    try {
      const result = await onMessage({
        chatId,
        text,
        senderId,
        platform: "telegram",
        media,
      });

      clearInterval(typingInterval);

      const chunks = splitMessage(result.text);
      for (const chunk of chunks) {
        if (!chunk.trim()) continue;
        try {
          await ctx.reply(formatForTelegram(chunk), { parse_mode: "HTML" });
        } catch (err1) {
          logger.warn({ err: err1 }, "Failed HTML reply, falling back to plain text");
          try {
            await ctx.reply(chunk);
          } catch (err2) {
            logger.error({ err: err2, chunk }, "Failed plain text reply fallback");
          }
        }
      }
    } catch (err) {
      clearInterval(typingInterval);
      logger.error({ err, chatId }, "Telegram message handler error");
      await ctx.reply("Something went wrong processing your message.");
    }
  }

  // Mime type lookup for common Telegram file types
  const EXT_MIME: Record<string, string> = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".gif": "image/gif",
    ".webp": "image/webp",
    ".ogg": "audio/ogg",
    ".oga": "audio/ogg",
    ".mp3": "audio/mpeg",
    ".mp4": "video/mp4",
    ".pdf": "application/pdf",
    ".txt": "text/plain",
    ".csv": "text/csv",
    ".json": "application/json",
  };

  function mimeFromPath(filePath: string, fallback: string): string {
    const ext = extname(filePath).toLowerCase();
    return EXT_MIME[ext] ?? fallback;
  }

  async function buildAttachment(
    fileId: string,
    type: MediaType,
    fallbackMime: string,
    originalName?: string,
  ): Promise<MediaAttachment> {
    const { url, path: remotePath } = await downloadTelegramFile(fileId);
    const ext = extname(remotePath) || ".bin";
    const localPath = await downloadAndSaveFile(url, ext);
    return {
      type,
      path: localPath,
      mimeType: mimeFromPath(remotePath, fallbackMime),
      originalName,
    };
  }

  // /start and /chatid are Telegram-only, don't forward to agent
  bot.command("start", async (ctx) => {
    if (!isAuthorized(ctx.chat.id)) {
      return;
    }
    await ctx.reply("Clio online. Send me a message.");
  });

  bot.command("chatid", async (ctx) => {
    await ctx.reply(`Your chat ID: <code>${ctx.chat.id}</code>`, {
      parse_mode: "HTML",
    });
  });

  // Text messages
  bot.on("message:text", async (ctx) => {
    if (!isAuthorized(ctx.chat.id)) {
      return;
    }
    await handleAndRespond(ctx, ctx.message.text);
  });

  // Photo messages
  bot.on("message:photo", async (ctx) => {
    if (!isAuthorized(ctx.chat.id)) {
      return;
    }
    const photos = ctx.message.photo;
    const largest = photos[photos.length - 1];
    const attachment = await buildAttachment(largest.file_id, "image", "image/jpeg");
    const caption = ctx.message.caption ?? "";
    await handleAndRespond(ctx, caption, [attachment]);
  });

  // Voice messages
  bot.on("message:voice", async (ctx) => {
    if (!isAuthorized(ctx.chat.id)) {
      return;
    }
    const attachment = await buildAttachment(
      ctx.message.voice.file_id,
      "audio",
      "audio/ogg",
    );
    const caption = ctx.message.caption ?? "";
    await handleAndRespond(ctx, caption, [attachment]);
  });

  // Document messages
  bot.on("message:document", async (ctx) => {
    if (!isAuthorized(ctx.chat.id)) {
      return;
    }
    const doc = ctx.message.document;
    const mime = doc.mime_type ?? "application/octet-stream";
    const type: MediaType = mime.startsWith("image/")
      ? "image"
      : mime.startsWith("audio/")
        ? "audio"
        : "document";
    const attachment = await buildAttachment(doc.file_id, type, mime, doc.file_name);
    let caption = ctx.message.caption ?? "";

    if (mime === "application/pdf") {
      try {
        const pdfBuffer = readFileSync(attachment.path);
        const pdfData = await pdfParse(pdfBuffer);
        const extracted = pdfData.text.trim();
        if (extracted) {
          const header = `[PDF Content Extracted: ${doc.file_name || "Document"}]`;
          caption = caption ? `${caption}\n\n${header}\n${extracted}` : `${header}\n${extracted}`;
        }
      } catch (err) {
        logger.error({ err, file: doc.file_name }, "Failed to parse PDF document");
      }
    }

    await handleAndRespond(ctx, caption, [attachment]);
  });

  // Video messages
  bot.on("message:video", async (ctx) => {
    if (!isAuthorized(ctx.chat.id)) {
      return;
    }
    const attachment = await buildAttachment(
      ctx.message.video.file_id,
      "video",
      "video/mp4",
      ctx.message.video.file_name,
    );
    const caption = ctx.message.caption ?? "";
    await handleAndRespond(ctx, caption, [attachment]);
  });

  return {
    id: "telegram",
    async start() {
      logger.info("Starting Telegram bot...");
      // bot.start() runs the long-polling loop; intentionally not awaited
      void bot.start({
        onStart: () => logger.info("Telegram bot started"),
      });
    },
    async stop() {
      await bot.stop();
    },
    async send(chatId: string, text: string) {
      if (!text || !text.trim()) return;
      const chunks = splitMessage(text);
      for (const chunk of chunks) {
        if (!chunk.trim()) continue;
        try {
          await bot.api.sendMessage(Number(chatId), formatForTelegram(chunk), {
            parse_mode: "HTML",
          });
        } catch (err1) {
          logger.warn({ err: err1 }, "Failed HTML send, falling back to plain text");
          try {
            await bot.api.sendMessage(Number(chatId), chunk);
          } catch (err2) {
            logger.error({ err: err2, chunk, chatId }, "Failed plain text send fallback");
          }
        }
      }
    },
  };
}
