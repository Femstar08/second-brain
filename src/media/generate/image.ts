import { saveMediaFile } from "../store/local.js";
import type { GenerateRequest, GeneratedMedia } from "../types.js";

export interface ImageGenConfig {
  provider: "dall-e" | "flux" | "nanobanana";
  apiKey?: string;
}

/**
 * Generate an image from a GenerateRequest.
 * Throws on failure (generators throw per spec).
 */
export async function generateImage(
  request: GenerateRequest,
  config: ImageGenConfig,
): Promise<GeneratedMedia> {
  switch (config.provider) {
    case "dall-e":
      return generateDallE(request, config);
    case "flux":
      return generateFlux(request, config);
    case "nanobanana":
      return generateNanoBanana(request, config);
  }
}

async function generateDallE(
  request: GenerateRequest,
  config: ImageGenConfig,
): Promise<GeneratedMedia> {
  const response = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "dall-e-3",
      prompt: request.prompt,
      response_format: "b64_json",
      n: 1,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`DALL-E API error ${response.status}: ${body}`);
  }

  const data = (await response.json()) as { data: Array<{ b64_json: string }> };
  const b64 = data.data[0].b64_json;
  const buffer = Buffer.from(b64, "base64");
  const path = saveMediaFile(buffer, ".png");

  return {
    type: "image",
    path,
    mimeType: "image/png",
    size: buffer.length,
    provider: "dall-e",
    prompt: request.prompt,
  };
}

async function generateFlux(
  request: GenerateRequest,
  config: ImageGenConfig,
): Promise<GeneratedMedia> {
  // Placeholder: POST to Flux API
  const response = await fetch("https://api.flux.ai/v1/generate", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      prompt: request.prompt,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Flux API error ${response.status}: ${body}`);
  }

  const data = (await response.json()) as { image_b64: string };
  const buffer = Buffer.from(data.image_b64, "base64");
  const path = saveMediaFile(buffer, ".png");

  return {
    type: "image",
    path,
    mimeType: "image/png",
    size: buffer.length,
    provider: "flux",
    prompt: request.prompt,
  };
}

async function generateNanoBanana(
  request: GenerateRequest,
  config: ImageGenConfig,
): Promise<GeneratedMedia> {
  // Placeholder: POST to NanoBanana API
  const response = await fetch("https://api.nanobanana.ai/v1/generate", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      prompt: request.prompt,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`NanoBanana API error ${response.status}: ${body}`);
  }

  const data = (await response.json()) as { image_b64: string };
  const buffer = Buffer.from(data.image_b64, "base64");
  const path = saveMediaFile(buffer, ".png");

  return {
    type: "image",
    path,
    mimeType: "image/png",
    size: buffer.length,
    provider: "nanobanana",
    prompt: request.prompt,
  };
}
