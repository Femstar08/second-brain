# Configuration Reference

Settings are stored in `config.json` in the project root. All fields have sensible defaults.

## Config Structure

```json
{
  "provider": "claude",
  "onboarded": true,
  "providers": {
    "claude": {},
    "codex": {},
    "openai": { "apiKey": "", "model": "gpt-4o" },
    "openrouter": { "apiKey": "", "model": "anthropic/claude-sonnet-4-6" },
    "ollama": { "model": "llama3.1", "baseUrl": "http://localhost:11434" }
  },
  "channels": {
    "active": "web",
    "web": { "port": 3000, "host": "localhost" },
    "telegram": { "botToken": "" }
  },
  "heartbeat": {
    "enabled": true,
    "intervalMinutes": 30,
    "activeHours": { "start": "08:00", "end": "22:00" }
  },
  "memory": {
    "mode": "full",
    "embeddings": { "enabled": false, "provider": "openai" }
  }
}
```

## Environment Variables

Sensitive values can be set in `.env` instead of `config.json`:

- `OPENROUTER_API_KEY`
- `OPENAI_API_KEY`
- `TELEGRAM_BOT_TOKEN`
- `TELEGRAM_ALLOWED_CHAT_IDS` (comma-separated)
