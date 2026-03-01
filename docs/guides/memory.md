# Memory System

Clio has a three-tier memory system controlled by the memory mode setting.

## Modes

- **Full** — Saves conversations to a searchable database and daily log files. Past conversations are searched for relevant context before each response.
- **Simple** — Writes daily logs only. No search across past conversations.
- **None** — No memory persistence. Each conversation starts fresh.

## Always-On Context

These files are loaded before every response regardless of mode:

- `soul.md` — Clio's personality and values
- `user.md` — What Clio knows about you (auto-updated)
- `memory.md` — Important decisions and facts
- `agent.md` — Behavioral rules
- Today's and yesterday's daily logs

## Memory Decay (Full Mode)

Memories have a salience score that decays by 2% daily. Memories below 0.1 salience are automatically removed. Accessing a memory boosts its salience.
