export interface SendOptions {
  replyToId?: string;
}

export interface ChannelAdapter {
  id: string;
  start(): Promise<void>;
  stop(): Promise<void>;
  send(chatId: string, text: string, options?: SendOptions): Promise<void>;
}

export type MessageHandler = (msg: {
  chatId: string;
  text: string;
  senderId: string;
  platform: string;
}) => Promise<{ text: string }>;
