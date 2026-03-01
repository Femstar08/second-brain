import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useConfig } from "@/hooks/useConfig";
import { cn } from "@/lib/utils";

const STEPS = ["welcome", "provider", "memory", "ready"] as const;

export default function Onboarding() {
  const [step, setStep] = useState(0);
  const [provider, setProvider] = useState("claude");
  const [apiKey, setApiKey] = useState("");
  const [memoryMode, setMemoryMode] = useState<"full" | "simple" | "none">("full");
  const { config, updateConfig } = useConfig();
  const navigate = useNavigate();

  const handleComplete = async () => {
    if (!config) {
      return;
    }
    const updated = {
      ...config,
      provider,
      onboarded: true,
      memory: { ...config.memory, mode: memoryMode },
      providers: {
        ...config.providers,
        openai: {
          ...config.providers.openai,
          ...(provider === "openai" && apiKey ? { apiKey } : {}),
        },
        openrouter: {
          ...config.providers.openrouter,
          ...(provider === "openrouter" && apiKey ? { apiKey } : {}),
        },
      },
    };
    await updateConfig(updated);
    void navigate("/");
    window.location.reload();
  };

  const current = STEPS[step];

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <div className="flex gap-2 mb-4">
            {STEPS.map((_, i) => (
              <div
                key={i}
                className={cn(
                  "h-1 flex-1 rounded-full transition-colors",
                  i <= step ? "bg-primary" : "bg-muted",
                )}
              />
            ))}
          </div>

          {current === "welcome" && (
            <>
              <CardTitle>Meet Clio</CardTitle>
              <CardDescription>
                Your personal AI assistant with persistent memory. Clio connects to AI providers,
                remembers your conversations, and gets smarter over time.
              </CardDescription>
            </>
          )}
          {current === "provider" && (
            <>
              <CardTitle>Choose a Provider</CardTitle>
              <CardDescription>
                Which AI backend should Clio use? You can change this anytime.
              </CardDescription>
            </>
          )}
          {current === "memory" && (
            <>
              <CardTitle>Memory Mode</CardTitle>
              <CardDescription>How should Clio remember your conversations?</CardDescription>
            </>
          )}
          {current === "ready" && (
            <>
              <CardTitle>You're all set</CardTitle>
              <CardDescription>
                Clio is ready. Start a conversation and she'll remember what matters.
              </CardDescription>
            </>
          )}
        </CardHeader>

        <CardContent>
          {current === "provider" && (
            <div className="space-y-4">
              <div>
                <Label>Provider</Label>
                <select
                  value={provider}
                  onChange={(e) => setProvider(e.target.value)}
                  className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="claude">Claude (via Agent SDK)</option>
                  <option value="codex">Codex (via SDK)</option>
                  <option value="openai">OpenAI (API key required)</option>
                  <option value="openrouter">OpenRouter (API key required)</option>
                  <option value="ollama">Ollama (local)</option>
                </select>
              </div>
              {(provider === "openai" || provider === "openrouter") && (
                <div>
                  <Label>API Key</Label>
                  <Input
                    type="password"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder={provider === "openai" ? "sk-..." : "sk-or-..."}
                    className="mt-1"
                  />
                </div>
              )}
            </div>
          )}

          {current === "memory" && (
            <div className="space-y-3">
              {(["full", "simple", "none"] as const).map((mode) => (
                <button
                  key={mode}
                  onClick={() => setMemoryMode(mode)}
                  className={cn(
                    "w-full text-left p-3 rounded-md border transition-colors",
                    memoryMode === mode
                      ? "border-primary bg-primary/5"
                      : "border-border hover:bg-muted",
                  )}
                >
                  <p className="font-medium text-sm capitalize">{mode}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {mode === "full" &&
                      "Searchable database + daily logs. Clio learns and recalls."}
                    {mode === "simple" && "Daily logs only. No search across past conversations."}
                    {mode === "none" && "No persistence. Every conversation starts fresh."}
                  </p>
                </button>
              ))}
            </div>
          )}

          <div className="flex justify-between mt-6">
            {step > 0 ? (
              <Button variant="outline" onClick={() => setStep((s) => s - 1)}>
                Back
              </Button>
            ) : (
              <div />
            )}
            {step < STEPS.length - 1 ? (
              <Button onClick={() => setStep((s) => s + 1)}>Next</Button>
            ) : (
              <Button onClick={handleComplete}>Get Started</Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
