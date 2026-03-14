import { describe, it, expect } from "vitest";
import { createRouter, type RoutingConfig } from "./router.js";
import type { Provider, ProviderResult } from "./types.js";

function mockProvider(id: string, response = `echo from ${id}`): Provider {
  return {
    id,
    getModel: () => "test-model",
    setModel: () => {},
    async send(prompt): Promise<ProviderResult> {
      return { text: `${response}: ${prompt}` };
    },
  };
}

function failingProvider(id: string, error = "down"): Provider {
  return {
    id,
    getModel: () => "test-model",
    setModel: () => {},
    async send(): Promise<ProviderResult> {
      throw new Error(`${id} ${error}`);
    },
  };
}

const baseRouting: RoutingConfig = {
  failover: ["primary", "secondary", "tertiary"],
  showRouteInfo: true,
  smartRouting: false,
  tiers: {
    quick: { provider: "", model: "" },
    standard: { provider: "", model: "" },
    heavy: { provider: "", model: "" },
    vision: { provider: "", model: "" },
  },
};

describe("provider router", () => {
  it("routes to the configured provider", async () => {
    const router = createRouter({ mock: mockProvider("mock") }, "mock");
    const result = await router.send("hello", { chatId: "test" });
    expect(result.text).toBe("echo from mock: hello");
  });

  it("throws when no providers are available", async () => {
    const router = createRouter({}, "unknown");
    await expect(router.send("hello", { chatId: "test" })).rejects.toThrow("No available providers");
  });

  it("allows switching providers", async () => {
    const other = mockProvider("other", "other response");
    const router = createRouter({ mock: mockProvider("mock"), other }, "mock");
    router.setProvider("other");
    const result = await router.send("hi", { chatId: "test" });
    expect(result.text).toBe("other response: hi");
  });

  it("reports the current provider id", () => {
    const router = createRouter({ mock: mockProvider("mock") }, "mock");
    expect(router.currentProvider()).toBe("mock");
    router.setProvider("other");
    expect(router.currentProvider()).toBe("other");
  });
});

describe("failover", () => {
  it("falls back to next provider on failure", async () => {
    const providers = {
      primary: failingProvider("primary"),
      secondary: mockProvider("secondary"),
    };
    const router = createRouter(providers, "primary", baseRouting);
    const result = await router.send("hello", { chatId: "test" });
    expect(result.text).toBe("echo from secondary: hello");
    expect(result.routeInfo?.failedOver).toBe(true);
    expect(result.routeInfo?.attempts).toEqual(["primary", "secondary"]);
  });

  it("skips unavailable providers in failover chain", async () => {
    const providers = {
      primary: failingProvider("primary"),
      // secondary not in providers record
      tertiary: mockProvider("tertiary"),
    };
    const router = createRouter(providers, "primary", baseRouting);
    const result = await router.send("hello", { chatId: "test" });
    expect(result.text).toBe("echo from tertiary: hello");
    expect(result.routeInfo?.attempts).toEqual(["primary", "tertiary"]);
  });

  it("throws when all providers fail", async () => {
    const providers = {
      primary: failingProvider("primary"),
      secondary: failingProvider("secondary"),
    };
    const router = createRouter(providers, "primary", baseRouting);
    await expect(router.send("hello", { chatId: "test" })).rejects.toThrow("secondary down");
  });

  it("returns routeInfo on success without failover", async () => {
    const providers = { primary: mockProvider("primary") };
    const router = createRouter(providers, "primary", baseRouting);
    const result = await router.send("hello", { chatId: "test" });
    expect(result.routeInfo).toEqual({
      provider: "primary",
      model: "test-model",
      tier: "standard",
      failedOver: false,
      attempts: ["primary"],
    });
  });
});

describe("smart routing", () => {
  const smartRouting: RoutingConfig = {
    failover: ["fast", "strong"],
    showRouteInfo: true,
    smartRouting: true,
    tiers: {
      quick: { provider: "fast", model: "fast-model" },
      standard: { provider: "", model: "" },
      heavy: { provider: "strong", model: "strong-model" },
      vision: { provider: "strong", model: "vision-model" },
    },
  };

  it("routes quick messages to the fast provider", async () => {
    const providers = {
      default: mockProvider("default"),
      fast: mockProvider("fast"),
      strong: mockProvider("strong"),
    };
    const router = createRouter(providers, "default", smartRouting);
    const result = await router.send("hi", { chatId: "test" });
    expect(result.routeInfo?.provider).toBe("fast");
    expect(result.routeInfo?.tier).toBe("quick");
  });

  it("routes heavy messages to the strong provider", async () => {
    const providers = {
      default: mockProvider("default"),
      fast: mockProvider("fast"),
      strong: mockProvider("strong"),
    };
    const router = createRouter(providers, "default", smartRouting);
    const result = await router.send("write a function that sorts arrays", { chatId: "test" });
    expect(result.routeInfo?.provider).toBe("strong");
    expect(result.routeInfo?.tier).toBe("heavy");
  });

  it("routes vision messages to the vision provider", async () => {
    const providers = {
      default: mockProvider("default"),
      fast: mockProvider("fast"),
      strong: mockProvider("strong"),
    };
    const router = createRouter(providers, "default", smartRouting);
    const result = await router.send("what is this?", {
      chatId: "test",
      media: [{ type: "image", path: "/tmp/test.jpg", mimeType: "image/jpeg" }],
    });
    expect(result.routeInfo?.provider).toBe("strong");
    expect(result.routeInfo?.tier).toBe("vision");
  });

  it("routes standard messages to the active provider", async () => {
    const providers = {
      default: mockProvider("default"),
      fast: mockProvider("fast"),
      strong: mockProvider("strong"),
    };
    const router = createRouter(providers, "default", smartRouting);
    const result = await router.send("what is the weather today?", { chatId: "test" });
    expect(result.routeInfo?.provider).toBe("default");
    expect(result.routeInfo?.tier).toBe("standard");
  });

  it("bypasses smart routing when manual override is active", async () => {
    const providers = {
      default: mockProvider("default"),
      fast: mockProvider("fast"),
      strong: mockProvider("strong"),
      manual: mockProvider("manual"),
    };
    const router = createRouter(providers, "default", smartRouting);
    router.setProvider("manual");
    // "hi" would normally route to fast, but manual override wins
    const result = await router.send("hi", { chatId: "test" });
    expect(result.routeInfo?.provider).toBe("manual");
    expect(result.routeInfo?.tier).toBe("standard");
  });

  it("combines smart routing with failover", async () => {
    const providers = {
      default: mockProvider("default"),
      fast: failingProvider("fast"),
      strong: mockProvider("strong"),
    };
    const router = createRouter(providers, "default", smartRouting);
    // "hi" routes to fast, which fails, then falls over to strong
    const result = await router.send("hi", { chatId: "test" });
    expect(result.routeInfo?.provider).toBe("strong");
    expect(result.routeInfo?.failedOver).toBe(true);
    expect(result.routeInfo?.tier).toBe("quick");
  });
});
