import { describe, it, expect } from "vitest";
import { createRouter } from "./router.js";
import type { Provider, ProviderResult } from "./types.js";

const mockProvider: Provider = {
  id: "mock",
  async send(prompt): Promise<ProviderResult> {
    return { text: `echo: ${prompt}` };
  },
};

describe("provider router", () => {
  it("routes to the configured provider", async () => {
    const router = createRouter({ mock: mockProvider }, "mock");
    const result = await router.send("hello", { chatId: "test" });
    expect(result.text).toBe("echo: hello");
  });

  it("throws on unknown provider", async () => {
    const router = createRouter({ mock: mockProvider }, "unknown");
    await expect(router.send("hello", { chatId: "test" })).rejects.toThrow(
      "Unknown provider: unknown",
    );
  });

  it("allows switching providers", async () => {
    const other: Provider = {
      id: "other",
      async send() {
        return { text: "other" };
      },
    };
    const router = createRouter({ mock: mockProvider, other }, "mock");
    router.setProvider("other");
    const result = await router.send("hi", { chatId: "test" });
    expect(result.text).toBe("other");
  });

  it("reports the current provider id", () => {
    const router = createRouter({ mock: mockProvider }, "mock");
    expect(router.currentProvider()).toBe("mock");
    router.setProvider("other");
    expect(router.currentProvider()).toBe("other");
  });
});
