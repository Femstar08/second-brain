import { z } from "zod";

export const ConfigSchema = z.object({
    provider: z.string().default("claude"),
    onboarded: z.boolean().default(false),
    providers: z.object({
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
            baseUrl: z.string().default("http://localhost:11434"),
        }).default({ model: "llama3.1", baseUrl: "http://localhost:11434" }),
    }).default({
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
});

export type SecondBrainConfig = z.infer<typeof ConfigSchema>;
