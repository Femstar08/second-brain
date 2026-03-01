import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { loadSkills, type Skill } from "./loader.js";
import { matchSkills, buildSkillContext } from "./registry.js";

const tmpDir = join(import.meta.dirname, "..", "..", ".test-tmp-skills");

describe("skill loader", () => {
  beforeEach(() => {
    mkdirSync(join(tmpDir, "web-search"), { recursive: true });
    writeFileSync(
      join(tmpDir, "web-search", "SKILL.md"),
      `---
name: web-search
description: Search the web
triggers: ["/search", "look up"]
---

When asked to search, use DuckDuckGo.
`,
    );
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("discovers and parses SKILL.md files", () => {
    const skills = loadSkills(tmpDir);
    expect(skills).toHaveLength(1);
    expect(skills[0].name).toBe("web-search");
    expect(skills[0].description).toBe("Search the web");
    expect(skills[0].triggers).toContain("/search");
    expect(skills[0].triggers).toContain("look up");
    expect(skills[0].body).toContain("DuckDuckGo");
  });

  it("returns empty array for missing directory", () => {
    const skills = loadSkills(join(tmpDir, "nope"));
    expect(skills).toEqual([]);
  });

  it("uses directory name as fallback when name is missing", () => {
    mkdirSync(join(tmpDir, "no-name"), { recursive: true });
    writeFileSync(
      join(tmpDir, "no-name", "SKILL.md"),
      `---
description: A skill without a name
triggers: ["/noname"]
---

Body text here.
`,
    );
    const skills = loadSkills(tmpDir);
    const noName = skills.find((s) => s.name === "no-name");
    expect(noName).toBeDefined();
    expect(noName!.description).toBe("A skill without a name");
  });

  it("skips directories without SKILL.md", () => {
    mkdirSync(join(tmpDir, "empty-dir"), { recursive: true });
    writeFileSync(join(tmpDir, "empty-dir", "README.md"), "not a skill");
    const skills = loadSkills(tmpDir);
    expect(skills).toHaveLength(1);
    expect(skills[0].name).toBe("web-search");
  });

  it("skips files without valid frontmatter", () => {
    mkdirSync(join(tmpDir, "bad-frontmatter"), { recursive: true });
    writeFileSync(
      join(tmpDir, "bad-frontmatter", "SKILL.md"),
      "No frontmatter here, just plain text.",
    );
    const skills = loadSkills(tmpDir);
    // Only web-search should load; bad-frontmatter is skipped
    expect(skills).toHaveLength(1);
  });
});

describe("skill registry", () => {
  const skills: Skill[] = [
    {
      name: "web-search",
      description: "Search the web",
      triggers: ["/search", "look up"],
      body: "Use DuckDuckGo.",
      path: "/fake/web-search/SKILL.md",
    },
    {
      name: "summarize",
      description: "Summarize text",
      triggers: ["/summarize", "tldr"],
      body: "Provide a concise summary.",
      path: "/fake/summarize/SKILL.md",
    },
  ];

  it("matches command-style triggers (prefix match)", () => {
    const matched = matchSkills(skills, "/search for cats");
    expect(matched).toHaveLength(1);
    expect(matched[0].name).toBe("web-search");
  });

  it("matches keyword triggers (substring match)", () => {
    const matched = matchSkills(skills, "can you look up the weather?");
    expect(matched).toHaveLength(1);
    expect(matched[0].name).toBe("web-search");
  });

  it("matches case-insensitively", () => {
    const matched = matchSkills(skills, "TLDR of this article");
    expect(matched).toHaveLength(1);
    expect(matched[0].name).toBe("summarize");
  });

  it("returns empty array when no triggers match", () => {
    const matched = matchSkills(skills, "hello world");
    expect(matched).toEqual([]);
  });

  it("can match multiple skills", () => {
    const matched = matchSkills(skills, "/search and also tldr");
    expect(matched).toHaveLength(2);
  });

  it("builds context string from matched skills", () => {
    const context = buildSkillContext(skills);
    expect(context).toContain("[Active skills]");
    expect(context).toContain("## Skill: web-search");
    expect(context).toContain("Use DuckDuckGo.");
    expect(context).toContain("## Skill: summarize");
  });

  it("returns empty string for no skills", () => {
    expect(buildSkillContext([])).toBe("");
  });
});
