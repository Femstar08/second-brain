import { logger } from "../logger.js";
import { classifyMessage, type Tier } from "./classifier.js";
import type { Provider, ProviderResult, ConversationContext, RouteInfo } from "./types.js";

export interface TierConfig {
  provider: string;
  model: string;
}

export interface RoutingConfig {
  failover: string[];
  showRouteInfo: boolean;
  smartRouting: boolean;
  tiers: Record<Tier, TierConfig>;
}

export interface Router {
  send(prompt: string, context: ConversationContext): Promise<ProviderResult>;
  setProvider(id: string): void;
  currentProvider(): string;
  currentModel(): string | undefined;
  setModel(model: string): boolean;
}

const DEFAULT_ROUTING: RoutingConfig = {
  failover: [],
  showRouteInfo: false,
  smartRouting: false,
  tiers: {
    quick: { provider: "", model: "" },
    standard: { provider: "", model: "" },
    heavy: { provider: "", model: "" },
    vision: { provider: "", model: "" },
  },
};

export function createRouter(
  providers: Record<string, Provider>,
  defaultId: string,
  routingConfig?: RoutingConfig,
): Router {
  let activeId = defaultId;
  let manualOverride = false;
  const routing = routingConfig ?? DEFAULT_ROUTING;

  return {
    async send(prompt, context) {
      // Classify the message
      const hasImages = (context.media?.some((m) => m.type === "image")) ?? false;
      const tier = routing.smartRouting && !manualOverride
        ? classifyMessage(prompt, hasImages)
        : "standard";

      // Resolve target provider+model from tier config
      const tierCfg = routing.tiers[tier];
      const targetProviderId = (tierCfg?.provider || activeId);
      const targetModel = tierCfg?.model || undefined;

      // Build ordered list of providers to try: target first, then failover chain
      const tryOrder = [targetProviderId, ...routing.failover.filter((id) => id !== targetProviderId)];
      // Filter to only available providers
      const available = tryOrder.filter((id) => providers[id]);

      if (available.length === 0) {
        throw new Error(`No available providers. Tried: ${tryOrder.join(", ")}`);
      }

      const attempts: string[] = [];
      let lastError: Error | null = null;

      for (const providerId of available) {
        const provider = providers[providerId]!;
        attempts.push(providerId);

        // Temporarily set model if tier specifies one and this is the target provider
        const originalModel = provider.getModel?.();
        const useModel = providerId === targetProviderId && targetModel && provider.setModel;
        if (useModel) {
          provider.setModel!(targetModel);
        }

        try {
          const result = await provider.send(prompt, context);

          const routeInfo: RouteInfo = {
            provider: providerId,
            model: provider.getModel?.(),
            tier,
            failedOver: attempts.length > 1,
            attempts,
          };

          return { ...result, routeInfo };
        } catch (err) {
          // Restore original model on failure
          if (useModel && originalModel !== undefined) {
            provider.setModel!(originalModel);
          }

          lastError = err instanceof Error ? err : new Error(String(err));
          logger.warn(
            { provider: providerId, error: lastError.message, attempt: attempts.length },
            "Provider failed, trying next in failover chain",
          );
        }
      }

      // All providers failed
      throw lastError ?? new Error("All providers failed");
    },

    setProvider(id: string) {
      activeId = id;
      manualOverride = true;
    },

    currentProvider() {
      return activeId;
    },

    currentModel() {
      return providers[activeId]?.getModel?.();
    },

    setModel(model: string) {
      const p = providers[activeId];
      if (!p?.setModel) return false;
      p.setModel(model);
      manualOverride = true;
      return true;
    },
  };
}
