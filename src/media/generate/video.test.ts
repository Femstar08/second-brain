import { describe, it, expect } from "vitest";
import { generateVideo } from "./video.js";

describe("generateVideo", () => {
  it("throws not-yet-implemented error", async () => {
    await expect(
      generateVideo({ type: "video", prompt: "a scene" }),
    ).rejects.toThrow("Video generation is not yet implemented");
  });

  it("error message mentions Sora/Runway", async () => {
    await expect(
      generateVideo({ type: "video", prompt: "test" }),
    ).rejects.toThrow("Sora/Runway");
  });
});
