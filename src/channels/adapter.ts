export interface SendOptions {
  replyToId?: string;
}

export interface ChannelAdapter {
  id: string;
  start(): Promise<void>;
  stop(): Promise<void>;
  send(chatId: string, text: string, options?: SendOptions): Promise<void>;
}

import type { MediaAttachment } from "../media/types.js";

export type MessageHandler = (msg: {
  chatId: string;
  text: string;
  senderId: string;
  platform: string;
  media?: MediaAttachment[];
}) => Promise<{ text: string; buttons?: Array<Array<{ text: string; callbackData: string }>> }>;
