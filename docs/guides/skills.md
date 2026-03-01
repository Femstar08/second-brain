# Skills

Skills are custom instructions that activate when triggered by your messages.

## Creating a Skill

Create a `SKILL.md` file in the `skills/` directory:

```yaml
---
name: code-review
description: Reviews code changes
triggers:
  - command: /review
  - keyword: review my code
---
When asked to review code, focus on:
  - Correctness
  - Edge cases
  - Performance
```

## Trigger Types

- **command** — Activates when message starts with the command (e.g., `/review`)
- **keyword** — Activates when message contains the keyword

Skills are discovered at startup. Restart to load new skills.
