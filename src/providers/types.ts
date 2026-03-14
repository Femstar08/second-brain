import type { MediaAttachment } from "../media/types.js";

export interface ConversationContext {
  sessionId?: string;
  memoryContext?: string;
  skillContext?: string;
  chatId: string;
  media?: MediaAttachment[];
}

export interface InlineButton {
  text: string;
  callbackData: string;
}

export interface RouteInfo {
  provider: string;
  model?: string;
  tier: string;
  failedOver: boolean;
  attempts: string[];
}

export interface ProviderResult {
  text: string;
  sessionId?: string;
  buttons?: InlineButton[][];
  routeInfo?: RouteInfo;
}

export interface Provider {
  id: string;
  send(prompt: string, context: ConversationContext): Promise<ProviderResult>;
  getModel?(): string;
  setModel?(model: string): void;
}
