import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

export interface Skill {
  name: string;
  description: string;
  triggers: string[];
  body: string;
  path: string;
}

/**
 * Scan a directory for subdirectories containing SKILL.md files.
 * Each SKILL.md has YAML-like frontmatter (name, description, triggers)
 * followed by a markdown body with skill instructions.
 */
export function loadSkills(skillsDir: string): Skill[] {
  if (!existsSync(skillsDir)) return [];

  let entries: string[];
  try {
    entries = readdirSync(skillsDir, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name);
  } catch {
    return [];
  }

  const skills: Skill[] = [];

  for (const dir of entries) {
    const skillPath = join(skillsDir, dir, "SKILL.md");
    if (!existsSync(skillPath)) continue;

    const content = readFileSync(skillPath, "utf-8");
    const parsed = parseFrontmatter(content);
    if (!parsed) continue;

    skills.push({
      name: parsed.frontmatter.name ?? dir,
      description: parsed.frontmatter.description ?? "",
      triggers: parseTriggers(parsed.frontmatter.triggers),
      body: parsed.body.trim(),
      path: skillPath,
    });
  }

  return skills;
}

/** Parse simple YAML-style frontmatter delimited by --- */
function parseFrontmatter(
  content: string,
): { frontmatter: Record<string, string>; body: string } | null {
  const match = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) return null;

  const frontmatter: Record<string, string> = {};
  for (const line of match[1].split("\n")) {
    const colonIdx = line.indexOf(":");
    if (colonIdx === -1) continue;
    const key = line.slice(0, colonIdx).trim();
    const value = line.slice(colonIdx + 1).trim();
    frontmatter[key] = value;
  }

  return { frontmatter, body: match[2] };
}

/** Parse a YAML-like trigger list: ["/cmd", "keyword"] or a bare string */
function parseTriggers(raw?: string): string[] {
  if (!raw) return [];
  const match = raw.match(/\[(.*)\]/);
  if (!match) return [raw];
  return match[1].split(",").map((s) => s.trim().replace(/^["']|["']$/g, ""));
}
