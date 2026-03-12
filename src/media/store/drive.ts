import { logger } from "../../logger.js";
import type { Database } from "../../db.js";

export interface DriveArchivalConfig {
  archiveDays: number;
  deleteLocal: boolean;
  folderName: string;
  account: "personal" | "business";
}

/**
 * Archive old media files to Google Drive.
 * TODO: Implement with googleapis package.
 */
export async function runArchivalJob(db: Database, config: DriveArchivalConfig): Promise<void> {
  logger.info("Drive archival job: not yet implemented (stub)");
}
