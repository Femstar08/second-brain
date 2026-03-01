export interface ConversationContext {
  sessionId?: string;
  memoryContext?: string;
  skillContext?: string;
  chatId: string;
}

export interface ProviderResult {
  text: string;
  sessionId?: string;
}

export interface Provider {
  id: string;
  send(prompt: string, context: ConversationContext): Promise<ProviderResult>;
}
