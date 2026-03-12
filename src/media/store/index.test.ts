import { mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { initDatabase, type Database } from "../../db.js";
import {
  saveMediaRecord,
  getMediaRecord,
  queryMedia,
  searchMedia,
  updateMediaRecord,
} from "./index.js";

const tmpDir = join(import.meta.dirname, "..", "..", "..", ".test-tmp-media-store");

describe("media store operations", () => {
  let db: Database;

  beforeEach(() => {
    mkdirSync(tmpDir, { recursive: true });
    db = initDatabase(join(tmpDir, "test.db"));
  });

  afterEach(() => {
    db.close();
    rmSync(tmpDir, { recursive: true, force: true });
  });

  describe("saveMediaRecord / getMediaRecord", () => {
    it("saves and retrieves a record", () => {
      const id = saveMediaRecord(db, {
        type: "image",
        source: "inbound",
        path: "/tmp/a.jpg",
        mimeType: "image/jpeg",
        size: 12345,
        description: "a sunset photo",
        chatId: "chat-1",
        tags: ["sunset", "photo"],
      });

      expect(typeof id).toBe("number");
      expect(id).toBeGreaterThan(0);

      const record = getMediaRecord(db, id);
      expect(record).not.toBeNull();
      expect(record!.type).toBe("image");
      expect(record!.source).toBe("inbound");
      expect(record!.path).toBe("/tmp/a.jpg");
      expect(record!.mimeType).toBe("image/jpeg");
      expect(record!.size).toBe(12345);
      expect(record!.description).toBe("a sunset photo");
      expect(record!.chatId).toBe("chat-1");
      expect(record!.tags).toEqual(["sunset", "photo"]);
      expect(record!.createdAt).toBeTruthy();
    });

    it("returns null for missing id", () => {
      expect(getMediaRecord(db, 9999)).toBeNull();
    });

    it("handles null optional fields", () => {
      const id = saveMediaRecord(db, {
        type: "audio",
        source: "generated",
        path: "/tmp/b.mp3",
      });
      const record = getMediaRecord(db, id);
      expect(record!.mimeType).toBeNull();
      expect(record!.size).toBeNull();
      expect(record!.description).toBeNull();
      expect(record!.chatId).toBeNull();
      expect(record!.tags).toEqual([]);
    });
  });

  describe("queryMedia", () => {
    beforeEach(() => {
      saveMediaRecord(db, { type: "image", source: "inbound", path: "/1.jpg", chatId: "chat-1" });
      saveMediaRecord(db, { type: "image", source: "inbound", path: "/2.jpg", chatId: "chat-2" });
      saveMediaRecord(db, { type: "audio", source: "inbound", path: "/3.mp3", chatId: "chat-1" });
      saveMediaRecord(db, { type: "audio", source: "generated", path: "/4.mp3" });
    });

    it("returns all records with no filter", () => {
      expect(queryMedia(db).length).toBe(4);
    });

    it("filters by type", () => {
      const results = queryMedia(db, { type: "image" });
      expect(results.length).toBe(2);
      expect(results.every((r) => r.type === "image")).toBe(true);
    });

    it("filters by chatId", () => {
      const results = queryMedia(db, { chatId: "chat-1" });
      expect(results.length).toBe(2);
      expect(results.every((r) => r.chatId === "chat-1")).toBe(true);
    });

    it("filters by source", () => {
      const results = queryMedia(db, { source: "generated" });
      expect(results.length).toBe(1);
      expect(results[0].source).toBe("generated");
    });

    it("respects limit", () => {
      const results = queryMedia(db, { limit: 2 });
      expect(results.length).toBe(2);
    });
  });

  describe("searchMedia (FTS)", () => {
    beforeEach(() => {
      saveMediaRecord(db, {
        type: "image",
        source: "inbound",
        path: "/cat.jpg",
        description: "a fluffy cat sitting on a mat",
        tags: ["cat", "animal"],
      });
      saveMediaRecord(db, {
        type: "image",
        source: "inbound",
        path: "/dog.jpg",
        description: "a playful dog in the park",
        tags: ["dog", "animal"],
      });
      saveMediaRecord(db, {
        type: "audio",
        source: "generated",
        path: "/speech.mp3",
        description: "generated speech clip",
        tags: ["tts", "speech"],
      });
    });

    it("finds by description keyword", () => {
      const results = searchMedia(db, "fluffy");
      expect(results.length).toBe(1);
      expect(results[0].path).toBe("/cat.jpg");
    });

    it("finds by tag keyword", () => {
      const results = searchMedia(db, "tts");
      expect(results.length).toBe(1);
      expect(results[0].path).toBe("/speech.mp3");
    });

    it("returns multiple matches", () => {
      const results = searchMedia(db, "animal");
      expect(results.length).toBe(2);
    });

    it("returns empty for no match", () => {
      const results = searchMedia(db, "unicorn");
      expect(results.length).toBe(0);
    });
  });

  describe("updateMediaRecord", () => {
    it("updates fields and reflects in FTS", () => {
      const id = saveMediaRecord(db, {
        type: "image",
        source: "inbound",
        path: "/x.jpg",
        description: "original description",
        tags: ["old"],
      });

      updateMediaRecord(db, id, {
        description: "updated description",
        tags: ["new"],
        size: 999,
      });

      const record = getMediaRecord(db, id);
      expect(record!.description).toBe("updated description");
      expect(record!.tags).toEqual(["new"]);
      expect(record!.size).toBe(999);

      // Old FTS content gone, new content searchable
      expect(searchMedia(db, "original").length).toBe(0);
      expect(searchMedia(db, "updated").length).toBe(1);
    });

    it("no-ops when no fields provided", () => {
      const id = saveMediaRecord(db, {
        type: "image",
        source: "inbound",
        path: "/y.jpg",
        description: "unchanged",
      });
      updateMediaRecord(db, id, {});
      expect(getMediaRecord(db, id)!.description).toBe("unchanged");
    });
  });
});
