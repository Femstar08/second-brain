import type { Provider, ProviderResult, ConversationContext } from "./types.js";

export interface Router {
  send(prompt: string, context: ConversationContext): Promise<ProviderResult>;
  setProvider(id: string): void;
  currentProvider(): string;
}

export function createRouter(providers: Record<string, Provider>, defaultId: string): Router {
  let activeId = defaultId;

  return {
    async send(prompt, context) {
      const provider = providers[activeId];
      if (!provider) {
        throw new Error(`Unknown provider: ${activeId}`);
      }
      return provider.send(prompt, context);
    },
    setProvider(id: string) {
      activeId = id;
    },
    currentProvider() {
      return activeId;
    },
  };
}
