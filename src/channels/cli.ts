import * as readline from "node:readline";
import { logger } from "../logger.js";
import type { ChannelAdapter, MessageHandler } from "./adapter.js";

export function createCLIAdapter(onMessage: MessageHandler): ChannelAdapter {
  let rl: readline.Interface | null = null;

  return {
    id: "cli",
    async start() {
      rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
        prompt: "\nyou> ",
      });

      console.log("Second Brain CLI — type your message (Ctrl+C to exit)\n");
      rl.prompt();

      rl.on("line", async (line) => {
        const text = line.trim();
        if (!text) {
          rl?.prompt();
          return;
        }

        if (text === "/quit" || text === "/exit") {
          console.log("Goodbye.");
          process.exit(0);
        }

        try {
          const result = await onMessage({
            chatId: "cli",
            text,
            senderId: "local",
            platform: "cli",
          });
          console.log(`\nassistant> ${result.text}\n`);
        } catch (err) {
          logger.error({ err }, "CLI handler error");
          console.log("\n[Error processing message]\n");
        }

        rl?.prompt();
      });

      rl.on("close", () => {
        console.log("\nGoodbye.");
        process.exit(0);
      });
    },
    async stop() {
      rl?.close();
    },
    async send(_chatId: string, text: string) {
      console.log(`\nassistant> ${text}\n`);
    },
  };
}
