import { z } from "zod";

export const ConfigSchema = z.object({
    provider: z.string().default("claude"),
    onboarded: z.boolean().default(false),
    providers: z.object({
        anthropic: z.object({
            apiKey: z.string().optional(),
            model: z.string().default("claude-sonnet-4-6"),
        }).default({ model: "claude-sonnet-4-6" }),
        claude: z.record(z.string(), z.unknown()).default({}),
        codex: z.record(z.string(), z.unknown()).default({}),
        openai: z.object({
            apiKey: z.string().optional(),
            model: z.string().default("gpt-4o"),
        }).default({ model: "gpt-4o" }),
        openrouter: z.object({
            apiKey: z.string().optional(),
            model: z.string().default("anthropic/claude-sonnet-4-6"),
        }).default({ model: "anthropic/claude-sonnet-4-6" }),
        ollama: z.object({
            model: z.string().default("llama3.1"),
            baseUrl: z.string().default("http://127.0.0.1:11434"),
        }).default({ model: "llama3.1", baseUrl: "http://127.0.0.1:11434" }),
    }).default({
        anthropic: { model: "claude-sonnet-4-6" },
        claude: {},
        codex: {},
        openai: { model: "gpt-4o" },
        openrouter: { model: "anthropic/claude-sonnet-4-6" },
        ollama: { model: "llama3.1", baseUrl: "http://localhost:11434" }
    }),
    channels: z.object({
        active: z.string().optional(),
        web: z.object({
            port: z.number().int().positive().default(3000),
            host: z.string().default("localhost"),
        }).default({ port: 3000, host: "localhost" }),
        telegram: z.object({
            botToken: z.string().optional(),
            allowedChatIds: z.array(z.string()).optional(),
        }).default({}),
        slack: z.object({
            botToken: z.string().optional(),
            appToken: z.string().optional(),
            allowedUserIds: z.array(z.string()).optional(),
        }).default({}),
        discord: z.object({
            botToken: z.string().optional(),
            allowedUserIds: z.array(z.string()).optional(),
        }).default({}),
    }).default({
        web: { port: 3000, host: "localhost" },
        telegram: {},
        slack: {},
        discord: {}
    }),
    heartbeat: z.object({
        enabled: z.boolean().default(true),
        intervalMinutes: z.number().int().positive().default(30),
        activeHours: z.object({
            start: z.string().default("08:00"),
            end: z.string().default("22:00"),
        }).default({ start: "08:00", end: "22:00" }),
    }).default({ enabled: true, intervalMinutes: 30, activeHours: { start: "08:00", end: "22:00" } }),
    memory: z.object({
        mode: z.enum(["full", "simple", "none"]).default("full"),
        embeddings: z.object({
            enabled: z.boolean().default(false),
            provider: z.string().default("openai"),
        }).default({ enabled: false, provider: "openai" }),
    }).default({ mode: "full", embeddings: { enabled: false, provider: "openai" } }),
    media: z.object({
        ingest: z.object({
            visionProvider: z.enum(["claude", "openai"]).default("claude"),
            transcriptionProvider: z.enum(["whisper-local", "whisper-api", "deepgram"]).default("whisper-local"),
            videoKeyframeInterval: z.number().default(5),
        }).default({ visionProvider: "claude", transcriptionProvider: "whisper-local", videoKeyframeInterval: 5 }),
        generate: z.object({
            imageProvider: z.enum(["dall-e", "flux", "nanobanana"]).default("dall-e"),
            ttsProvider: z.enum(["gtts", "openai", "elevenlabs", "off"]).default("gtts"),
            ttsVoice: z.string().default("onyx"),
        }).default({ imageProvider: "dall-e", ttsProvider: "gtts", ttsVoice: "onyx" }),
        store: z.object({
            archiveDays: z.number().default(7),
            localRetentionDays: z.number().default(30),
            archiveDeleteLocal: z.boolean().default(false),
            driveFolderName: z.string().default("second-brain-media"),
            driveAccount: z.enum(["personal", "business"]).default("personal"),
        }).default({
            archiveDays: 7, localRetentionDays: 30, archiveDeleteLocal: false,
            driveFolderName: "second-brain-media", driveAccount: "personal",
        }),
    }).default({
        ingest: { visionProvider: "claude", transcriptionProvider: "whisper-local", videoKeyframeInterval: 5 },
        generate: { imageProvider: "dall-e", ttsProvider: "gtts", ttsVoice: "onyx" },
        store: { archiveDays: 7, localRetentionDays: 30, archiveDeleteLocal: false, driveFolderName: "second-brain-media", driveAccount: "personal" },
    }),
    routing: z.object({
        failover: z.array(z.string()).default(["anthropic", "openrouter", "openai", "ollama"]),
        showRouteInfo: z.boolean().default(true),
        smartRouting: z.boolean().default(true),
        tiers: z.object({
            quick: z.object({
                provider: z.string().default("openrouter"),
                model: z.string().default("google/gemini-flash-2.0"),
            }).default({ provider: "openrouter", model: "google/gemini-flash-2.0" }),
            standard: z.object({
                provider: z.string().default(""),
                model: z.string().default(""),
            }).default({ provider: "", model: "" }),
            heavy: z.object({
                provider: z.string().default("anthropic"),
                model: z.string().default("claude-sonnet-4-6"),
            }).default({ provider: "anthropic", model: "claude-sonnet-4-6" }),
            vision: z.object({
                provider: z.string().default("anthropic"),
                model: z.string().default("claude-sonnet-4-6"),
            }).default({ provider: "anthropic", model: "claude-sonnet-4-6" }),
        }).default({
            quick: { provider: "openrouter", model: "google/gemini-flash-2.0" },
            standard: { provider: "", model: "" },
            heavy: { provider: "anthropic", model: "claude-sonnet-4-6" },
            vision: { provider: "anthropic", model: "claude-sonnet-4-6" },
        }),
    }).default({
        failover: ["anthropic", "openrouter", "openai", "ollama"],
        showRouteInfo: true,
        smartRouting: true,
        tiers: {
            quick: { provider: "openrouter", model: "google/gemini-flash-2.0" },
            standard: { provider: "", model: "" },
            heavy: { provider: "anthropic", model: "claude-sonnet-4-6" },
            vision: { provider: "anthropic", model: "claude-sonnet-4-6" },
        },
    }),
    agents: z.object({
        enabled: z.boolean().default(false),
        registryPath: z.string().default("agents/registry.json"),
    }).default({ enabled: false, registryPath: "agents/registry.json" }),
});

export type SecondBrainConfig = z.infer<typeof ConfigSchema>;
