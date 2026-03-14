import { describe, it, expect } from "vitest";
import { classifyMessage } from "./classifier.js";

describe("classifyMessage", () => {
  it("returns vision when images are present", () => {
    expect(classifyMessage("what is this?", true)).toBe("vision");
  });

  it("returns heavy for code blocks", () => {
    expect(classifyMessage("fix this:\n```js\nconst x = 1;\n```", false)).toBe("heavy");
  });

  it("returns heavy for long messages", () => {
    const long = "a".repeat(501);
    expect(classifyMessage(long, false)).toBe("heavy");
  });

  it("returns heavy for heavy keywords", () => {
    expect(classifyMessage("write a function that adds two numbers", false)).toBe("heavy");
    expect(classifyMessage("refactor the auth module", false)).toBe("heavy");
    expect(classifyMessage("debug this error please", false)).toBe("heavy");
    expect(classifyMessage("explain how the router works", false)).toBe("heavy");
  });

  it("returns quick for greetings", () => {
    expect(classifyMessage("hi", false)).toBe("quick");
    expect(classifyMessage("hello", false)).toBe("quick");
    expect(classifyMessage("thanks", false)).toBe("quick");
    expect(classifyMessage("yes", false)).toBe("quick");
    expect(classifyMessage("no", false)).toBe("quick");
  });

  it("returns quick for single-word questions", () => {
    expect(classifyMessage("really?", false)).toBe("quick");
  });

  it("returns standard for normal messages", () => {
    expect(classifyMessage("what's the weather like today?", false)).toBe("standard");
    expect(classifyMessage("tell me about quantum physics", false)).toBe("standard");
  });

  it("vision takes priority over heavy keywords", () => {
    expect(classifyMessage("analyze this image", true)).toBe("vision");
  });

  it("heavy takes priority over quick for short messages with heavy keywords", () => {
    expect(classifyMessage("fix this bug", false)).toBe("heavy");
  });
});
