import type { SecondBrainConfig } from "../../config.js";
import type { GenerateRequest, GeneratedMedia } from "../types.js";
import { generateSpeech } from "./tts.js";
import { generateImage } from "./image.js";
import { generateVideo } from "./video.js";

export { synthesizeSpeech } from "./tts.js";
export type { TTSConfig } from "./tts.js";

/**
 * Route a GenerateRequest to the appropriate generator.
 * Returns null only for speech when provider is "off" or prompt is empty.
 * Throws for image/video failures.
 */
export async function generateMedia(
  request: GenerateRequest,
  config: SecondBrainConfig,
): Promise<GeneratedMedia | null> {
  switch (request.type) {
    case "speech": {
      const ttsProvider = config.media.generate.ttsProvider;
      return generateSpeech(request, {
        provider: ttsProvider,
        openaiApiKey: config.providers.openai.apiKey,
        voice: config.media.generate.ttsVoice,
      });
    }

    case "image": {
      const imageProvider = config.media.generate.imageProvider;
      return generateImage(request, {
        provider: imageProvider,
        apiKey: getImageApiKey(imageProvider),
      });
    }

    case "video":
      return generateVideo(request);
  }
}

/**
 * Read image provider API key from environment.
 */
export function getImageApiKey(provider: string): string | undefined {
  switch (provider) {
    case "dall-e":
      return process.env.OPENAI_API_KEY;
    case "flux":
      return process.env.FLUX_API_KEY;
    case "nanobanana":
      return process.env.NANOBANANA_API_KEY;
    default:
      return undefined;
  }
}
