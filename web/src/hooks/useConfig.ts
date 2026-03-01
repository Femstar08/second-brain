import { useState, useEffect, useCallback } from "react";

export interface AppConfig {
  provider: string;
  onboarded: boolean;
  providers: {
    claude: Record<string, unknown>;
    codex: Record<string, unknown>;
    openai: { apiKey?: string; model?: string };
    openrouter: { apiKey?: string; model?: string };
    ollama: { model?: string; baseUrl?: string };
  };
  channels: {
    active: string;
    web: { port: number; host: string };
    telegram: { botToken?: string; allowedChatIds?: string[] };
    [key: string]: unknown;
  };
  heartbeat: {
    enabled: boolean;
    intervalMinutes: number;
    activeHours: { start: string; end: string };
  };
  memory: {
    mode: "full" | "simple" | "none";
    embeddings: { enabled: boolean; provider: string };
  };
}

export function useConfig() {
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchConfig = useCallback(async () => {
    try {
      const res = await fetch("/api/config");
      const data = await res.json();
      setConfig(data);
      setError(null);
    } catch {
      setError("Failed to load config");
    } finally {
      setLoading(false);
    }
  }, []);

  const updateConfig = useCallback(async (newConfig: AppConfig) => {
    try {
      await fetch("/api/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newConfig),
      });
      setConfig(newConfig);
      setError(null);
    } catch {
      setError("Failed to save config");
    }
  }, []);

  useEffect(() => {
    void fetchConfig();
  }, [fetchConfig]);

  return { config, loading, error, updateConfig, refetch: fetchConfig };
}
