import { Bot } from "grammy";
import { logger } from "../logger.js";
import type { ChannelAdapter, MessageHandler } from "./adapter.js";

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

  // Command handlers
  bot.command("start", async (ctx) => {
    if (!isAuthorized(ctx.chat.id)) {
      return;
    }
    await ctx.reply("Second Brain online. Send me a message.");
  });

  bot.command("chatid", async (ctx) => {
    await ctx.reply(`Your chat ID: <code>${ctx.chat.id}</code>`, {
      parse_mode: "HTML",
    });
  });

  bot.command("newchat", async (ctx) => {
    if (!isAuthorized(ctx.chat.id)) {
      return;
    }
    // Session clearing handled by agent via command detection
    await ctx.reply("Session cleared. Starting fresh.");
  });

  // Main message handler
  bot.on("message:text", async (ctx) => {
    if (!isAuthorized(ctx.chat.id)) {
      return;
    }

    const chatId = String(ctx.chat.id);
    const senderId = String(ctx.from?.id ?? ctx.chat.id);

    // Start typing indicator (Telegram expires after 5s, refresh every 4s)
    const typingInterval = setInterval(() => {
      ctx.api.sendChatAction(ctx.chat.id, "typing").catch(() => {});
    }, 4000);
    await ctx.api.sendChatAction(ctx.chat.id, "typing").catch(() => {});

    try {
      const result = await onMessage({
        chatId,
        text: ctx.message.text,
        senderId,
        platform: "telegram",
      });

      clearInterval(typingInterval);

      const chunks = splitMessage(result.text);
      for (const chunk of chunks) {
        try {
          await ctx.reply(formatForTelegram(chunk), { parse_mode: "HTML" });
        } catch {
          // Fallback to plain text if HTML parsing fails
          await ctx.reply(chunk);
        }
      }
    } catch (err) {
      clearInterval(typingInterval);
      logger.error({ err, chatId }, "Telegram message handler error");
      await ctx.reply("Something went wrong processing your message.");
    }
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
      const chunks = splitMessage(text);
      for (const chunk of chunks) {
        try {
          await bot.api.sendMessage(Number(chatId), formatForTelegram(chunk), {
            parse_mode: "HTML",
          });
        } catch {
          await bot.api.sendMessage(Number(chatId), chunk);
        }
      }
    },
  };
}
