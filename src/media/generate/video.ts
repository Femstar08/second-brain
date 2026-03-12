import type { GenerateRequest, GeneratedMedia } from "../types.js";

export async function generateVideo(_request: GenerateRequest): Promise<GeneratedMedia> {
  throw new Error(
    "Video generation is not yet implemented. Coming soon with Sora/Runway support.",
  );
}
