import type { Skill } from "./loader.js";

/**
 * Match user message against skill triggers.
 * Command triggers (starting with "/") use prefix matching.
 * Keyword triggers use case-insensitive substring matching.
 */
export function matchSkills(skills: Skill[], message: string): Skill[] {
  const lower = message.toLowerCase();
  return skills.filter((skill) =>
    skill.triggers.some((trigger) => {
      if (trigger.startsWith("/")) {
        return lower.startsWith(trigger);
      }
      return lower.includes(trigger.toLowerCase());
    }),
  );
}

/** Build a context string from matched skills for injection into provider prompts. */
export function buildSkillContext(skills: Skill[]): string {
  if (skills.length === 0) return "";
  const sections = skills.map((s) => `## Skill: ${s.name}\n${s.body}`);
  return `[Active skills]\n\n${sections.join("\n\n")}`;
}
