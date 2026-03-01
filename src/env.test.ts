import { writeFileSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { readEnvFile } from "./env.js";

const tmpDir = join(import.meta.dirname, "..", ".test-tmp");

describe("readEnvFile", () => {
  beforeEach(() => {
    mkdirSync(tmpDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("parses KEY=VALUE pairs", () => {
    const envPath = join(tmpDir, ".env");
    writeFileSync(envPath, "FOO=bar\nBAZ=qux\n");
    const result = readEnvFile(envPath);
    expect(result).toEqual({ FOO: "bar", BAZ: "qux" });
  });

  it("handles quoted values", () => {
    const envPath = join(tmpDir, ".env");
    writeFileSync(envPath, "KEY=\"value with spaces\"\nKEY2='single quoted'\n");
    const result = readEnvFile(envPath);
    expect(result.KEY).toBe("value with spaces");
    expect(result.KEY2).toBe("single quoted");
  });

  it("skips comments and empty lines", () => {
    const envPath = join(tmpDir, ".env");
    writeFileSync(envPath, "# comment\n\nFOO=bar\n");
    const result = readEnvFile(envPath);
    expect(result).toEqual({ FOO: "bar" });
  });

  it("returns empty object for missing file", () => {
    const result = readEnvFile(join(tmpDir, "nope"));
    expect(result).toEqual({});
  });

  it("filters to requested keys", () => {
    const envPath = join(tmpDir, ".env");
    writeFileSync(envPath, "A=1\nB=2\nC=3\n");
    const result = readEnvFile(envPath, ["A", "C"]);
    expect(result).toEqual({ A: "1", C: "3" });
  });
});
