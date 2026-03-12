export type MediaType = "image" | "audio" | "video" | "document" | "url";

export interface MediaAttachment {
  type: MediaType;
  path: string;
  mimeType: string;
  originalName?: string;
  transcription?: string;
  extractedText?: string;
}

export interface ProcessedMedia {
  type: MediaType;
  description: string;
  extractedText?: string;
  sourcePath: string;
  metadata: {
    mimeType: string;
    size?: number;
    originalName?: string;
    duration?: number;
    dimensions?: { width: number; height: number };
  };
  error?: string;
}

export interface GenerateRequest {
  type: "speech" | "image" | "video";
  prompt: string;
  provider?: string;
  options?: Record<string, unknown>;
}

export interface GeneratedMedia {
  type: "speech" | "image" | "video";
  path: string;
  mimeType: string;
  size: number;
  provider: string;
  prompt: string;
}

export interface MediaRecord {
  id: number;
  type: MediaType;
  source: "inbound" | "generated";
  path: string;
  mimeType: string | null;
  size: number | null;
  description: string | null;
  chatId: string | null;
  driveFileId: string | null;
  tags: string[];
  createdAt: string;
  archivedAt: string | null;
}
