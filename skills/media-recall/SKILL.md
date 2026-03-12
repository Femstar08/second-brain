---
name: media-recall
description: Search and retrieve previously shared or generated media
triggers: find photo, find image, find video, find document, find article, that photo, that image, that video, remember the, media from
---

When the user asks you to find or recall media they previously shared or that was generated, search the media_files database.

## How to search

Use the searchMedia and queryMedia functions available in your context. The media store supports:

- **FTS search**: Search descriptions and tags by keyword (e.g., "sunset", "meeting notes")
- **Filter by type**: image, audio, video, document, url
- **Filter by chat**: Media from a specific conversation
- **Filter by date**: Recent media or media from a specific time period

## Response format

When you find matching media:
1. Describe what you found (type, description, when it was shared)
2. If the file still exists locally, mention the path
3. If multiple matches, list the top results and ask which one they meant

If no matches found, say so plainly and suggest they may have shared it before the media pipeline was active.
