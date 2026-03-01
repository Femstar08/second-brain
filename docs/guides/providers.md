# Providers

Clio supports multiple AI providers. Switch between them at any time with `/provider <name>`.

## Claude (default)

Uses the Claude Agent SDK. No API key needed if Claude Code CLI is installed on your system.

## Codex

Uses the OpenAI Codex SDK. Requires the Codex CLI installed.

## OpenAI

Standard OpenAI API. Requires an API key (set in Settings or `.env`). Default model: gpt-4o.

## OpenRouter

Access many models through a single API. Requires an API key from openrouter.ai.

## Ollama

Run local models. Requires Ollama installed and running at `http://localhost:11434` (configurable).
