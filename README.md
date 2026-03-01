# Clio

A personal AI assistant that remembers. Named after the Greek Muse of History.

Clio runs as a persistent service with multiple LLM providers, a memory system, and pluggable channels (CLI, web, Telegram).

## Features

- **Multi-provider** — Claude Code, Codex, OpenRouter, OpenAI, Ollama
- **Memory** — SQLite-backed with vector search; learns across sessions
- **Channels** — CLI, web UI (React + Hono WebSocket), Telegram
- **Skills** — Markdown-defined capabilities the agent can load and use
- **Heartbeat** — Cron-based scheduler for autonomous tasks
- **Web UI** — React + Tailwind dashboard with chat, settings, onboarding

## Quick Start

```bash
# Clone
git clone https://github.com/Femstar08/clio.git
cd clio

# Install
npm install
cd web && npm install && cd ..

# Configure
cp .env.example .env
# Edit .env with your provider keys / tokens

# Run (server + web UI)
npm run dev
```

Requires Node >= 22.

## Project Structure

```
src/
  core/         Agent loop
  channels/     CLI, web, Telegram adapters
  providers/    LLM provider implementations
  memory/       Vector search + persistence
  heartbeat/    Cron scheduler
  skills/       Skill loader + registry
web/            React frontend (Vite + Tailwind)
memory/         Agent memory files (soul, user profile, long-term)
docs/guides/    Usage documentation
```

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start server + web UI concurrently |
| `npm run dev:server` | Server only |
| `npm run dev:web` | Web UI only |
| `npm run build` | Build everything |
| `npm test` | Run tests |
| `npm run typecheck` | Type check |

## Configuration

Provider and channel config lives in `config.json` and `.env`. See [docs/guides/configuration.md](docs/guides/configuration.md) and [docs/guides/providers.md](docs/guides/providers.md) for details.

## License

MIT
