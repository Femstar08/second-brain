# Smart Routing & Failover Design

## Problem

Clio's router is a simple passthrough to one active provider. If that provider fails, the user gets an error message. There's no automatic failover and no intelligence about which model to use for a given task.

## Goals

1. **Failover**: On provider error, automatically try the next provider in a configurable chain
2. **Smart routing**: Classify inbound messages into tiers and route to the best provider/model for the job
3. **Transparency**: Optionally show the user which provider/model handled their message

## Non-goals

- LLM-as-classifier (future consideration)
- Tier-aware failover chains (roadmap item — each tier gets its own fallback order)
- Claude Agent SDK integration (future provider type)

## Design

### Architecture

All new logic lives in the router layer. Providers, agent core, and channels are unchanged.

```
Message → Agent → Router → [Classify → Pick provider/model → Send → Failover if needed] → Response
```

### New file: `src/providers/classifier.ts`

Rule-based message classifier. Returns one of four tiers:

| Tier | Signals | Default mapping |
|------|---------|-----------------|
| `quick` | Short messages (<50 chars), greetings, simple questions, yes/no answers | Fast cheap model (e.g. Gemini Flash 2.0 via OpenRouter) |
| `standard` | Default — anything that doesn't match another tier | Current default provider/model |
| `heavy` | Long messages (>500 chars), code blocks, "write", "build", "implement", "refactor", "debug", analysis requests | Strong model (e.g. Claude Sonnet) |
| `vision` | Media attachments with type "image" | Vision-capable provider |

Classification rules (evaluated in order):
1. If message has image attachments → `vision`
2. If message matches heavy keywords/heuristics → `heavy`
3. If message matches quick signals → `quick`
4. Otherwise → `standard`

Export: `classifyMessage(prompt: string, hasImages: boolean): Tier`

### Enhanced: `src/providers/router.ts`

The `createRouter` function gains:
- A `routingConfig` parameter with failover chain and tier mappings
- `send()` now: classifies → resolves tier to provider+model → sends → on error, walks failover chain
- If the user has manually set a provider via `/provider`, smart routing is bypassed (manual override wins)
- Returns `routeInfo` on the result

Failover behavior:
- On provider error (throw), try the next provider in the failover chain
- Skip providers that aren't in the `providers` record (not configured / no API key)
- If all providers fail, return the last error message to the user
- Log each failover attempt

Model override behavior:
- When routing to a tier, the router temporarily sets the target provider's model if specified
- After the call (success or failure), restore the original model
- This avoids side effects on the provider's persistent model state

### Enhanced: `src/providers/types.ts`

Add to `ProviderResult`:
```ts
routeInfo?: {
  provider: string;
  model?: string;
  tier: string;
  failedOver: boolean;
  attempts: string[];  // providers tried, in order
}
```

### Enhanced: `src/config/schema.ts`

New `routing` section:
```ts
routing: z.object({
  failover: z.array(z.string()).default(["anthropic", "openrouter", "openai", "ollama"]),
  showRouteInfo: z.boolean().default(true),
  smartRouting: z.boolean().default(true),
  tiers: z.object({
    quick: z.object({
      provider: z.string().default("openrouter"),
      model: z.string().default("google/gemini-flash-2.0"),
    }),
    standard: z.object({
      provider: z.string().default(""),  // empty = use active provider
      model: z.string().default(""),
    }),
    heavy: z.object({
      provider: z.string().default("anthropic"),
      model: z.string().default("claude-sonnet-4-6"),
    }),
    vision: z.object({
      provider: z.string().default("anthropic"),
      model: z.string().default("claude-sonnet-4-6"),
    }),
  }),
})
```

### Enhanced: `src/core/agent.ts`

Minimal change — after receiving the result, if `routeInfo` is present and `showRouteInfo` is enabled, append a footer:
```
[via openrouter/gemini-flash-2.0]
```
or on failover:
```
[via openrouter/gemini-flash-2.0, failed over from anthropic]
```

### Manual override interaction

- `/provider <name>` and `/model <name>` still work as before
- When a manual override is active, smart routing is bypassed — all messages go to the manually selected provider/model
- Failover still applies even with manual override (if the chosen provider fails, try the chain)

## Files changed

| File | Change |
|------|--------|
| `src/providers/classifier.ts` | **New** — tier classification logic |
| `src/providers/router.ts` | Enhanced — failover + tier routing |
| `src/providers/types.ts` | Add `routeInfo` to `ProviderResult` |
| `src/config/schema.ts` | Add `routing` config section |
| `src/core/agent.ts` | Append route info footer |
| `src/index.ts` | Pass routing config to `createRouter` |

## Testing

- Unit test `classifier.ts`: verify tier assignment for various inputs
- Unit test router: mock providers, verify failover chain, verify tier routing
- Integration: send messages through the full pipeline, confirm correct provider used

## Roadmap

- **Tier-aware failover chains**: Each tier has its own fallback order (heavy falls back to other strong models, not to fast ones)
- **Claude Agent SDK provider**: New provider type using the SDK
- **LLM-as-classifier**: Use a fast model to classify when rules are insufficient
- **Usage tracking**: Log which tiers/providers are used over time to tune the defaults
