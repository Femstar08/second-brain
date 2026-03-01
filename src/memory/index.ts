import { readFileSync, appendFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const ALWAYS_FILES = ["soul.md", "user.md", "memory.md", "agent.md"];

/**
 * Load all always-on context files plus today's and yesterday's daily logs.
 * These are read before every agent reply to provide persistent context.
 */
export function loadAlwaysContext(memoryDir: string): string {
  const sections: string[] = [];

  for (const file of ALWAYS_FILES) {
    const filePath = join(memoryDir, file);
    try {
      const content = readFileSync(filePath, "utf-8").trim();
      if (content) {
        sections.push(content);
      }
    } catch {
      // file doesn't exist yet -- skip
    }
  }

  // Load today's daily log
  const today = new Date().toISOString().slice(0, 10);
  const todayPath = join(memoryDir, "daily", `${today}.md`);
  try {
    const content = readFileSync(todayPath, "utf-8").trim();
    if (content) {
      sections.push(`## Daily Log (${today})\n${content}`);
    }
  } catch {
    // no log yet today
  }

  // Load yesterday's daily log for continuity
  const yesterday = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
  const yesterdayPath = join(memoryDir, "daily", `${yesterday}.md`);
  try {
    const content = readFileSync(yesterdayPath, "utf-8").trim();
    if (content) {
      sections.push(`## Daily Log (${yesterday})\n${content}`);
    }
  } catch {
    // no log yesterday
  }

  return sections.join("\n\n---\n\n");
}

/**
 * Append a timestamped entry to today's daily log file.
 * Creates the daily directory and log file if they don't exist.
 */
export function appendDailyLog(memoryDir: string, role: string, content: string): void {
  const dailyDir = join(memoryDir, "daily");
  mkdirSync(dailyDir, { recursive: true });

  const today = new Date().toISOString().slice(0, 10);
  const logPath = join(dailyDir, `${today}.md`);
  const timestamp = new Date().toISOString().slice(11, 19);
  const entry = `\n[${timestamp}] **${role}**: ${content}\n`;

  if (!existsSync(logPath)) {
    appendFileSync(logPath, `# ${today}\n`);
  }
  appendFileSync(logPath, entry);
}
