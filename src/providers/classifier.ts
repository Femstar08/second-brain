export type Tier = "quick" | "standard" | "heavy" | "vision";

const HEAVY_KEYWORDS = [
  "write", "build", "implement", "refactor", "debug", "analyze", "explain",
  "create", "design", "architect", "optimize", "review", "fix", "convert",
  "migrate", "generate", "summarize", "compare", "translate",
];

const QUICK_PATTERNS = [
  /^(hi|hey|hello|yo|sup|thanks|thank you|ok|okay|yes|no|yep|nope|sure|cool|bye|gm|gn)\b/i,
  /^(what time|what day|what date)\b/i,
  /^\w+\?$/,  // single-word questions like "really?"
];

/**
 * Classify a message into a routing tier.
 *
 * Evaluation order:
 * 1. vision — if images are attached
 * 2. heavy  — long messages, code blocks, or heavy keywords
 * 3. quick  — short greetings, yes/no, trivial questions
 * 4. standard — everything else
 */
export function classifyMessage(prompt: string, hasImages: boolean): Tier {
  if (hasImages) return "vision";

  const trimmed = prompt.trim();

  // Heavy: code blocks, long messages, or heavy keywords
  if (trimmed.includes("```")) return "heavy";
  if (trimmed.length > 500) return "heavy";
  const lower = trimmed.toLowerCase();
  if (HEAVY_KEYWORDS.some((kw) => lower.includes(kw))) return "heavy";

  // Quick: short greetings, yes/no, trivial
  if (trimmed.length < 50 && QUICK_PATTERNS.some((p) => p.test(trimmed))) return "quick";

  return "standard";
}
