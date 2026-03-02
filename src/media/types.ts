export type MediaType = "image" | "audio" | "document";

export interface MediaAttachment {
  type: MediaType;
  path: string;
  mimeType: string;
  originalName?: string;
  transcription?: string;
  extractedText?: string;
}
