import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createLocalDiskAdapter } from "./local-disk.js";
import type { StorageAdapter } from "./adapter.js";

describe("createLocalDiskAdapter", () => {
  let rootDir: string;
  let adapter: StorageAdapter;

  beforeEach(async () => {
    rootDir = await mkdtemp(join(tmpdir(), "quickreel-storage-test-"));
    adapter = createLocalDiskAdapter({
      rootDir,
      publicBaseUrl: "http://localhost:4000/local-storage",
      apiInternalUrl: "http://localhost:4000",
    });
  });

  afterEach(async () => {
    await rm(rootDir, { recursive: true, force: true });
  });

  it("round-trips a put/get/delete", async () => {
    await adapter.putObject("projects/1/photo.jpg", Buffer.from("hello"), "image/jpeg");
    const buf = await adapter.getObjectBuffer("projects/1/photo.jpg");
    expect(buf.toString()).toBe("hello");

    await adapter.deleteObject("projects/1/photo.jpg");
    await expect(adapter.getObjectBuffer("projects/1/photo.jpg")).rejects.toThrow();
  });

  it("builds a passthrough presigned upload URL preserving nested path segments", async () => {
    const presigned = await adapter.getPresignedUploadUrl("music-library/luxury-piano-01.wav", "audio/wav");
    expect(presigned.method).toBe("PUT");
    expect(presigned.url).toBe("http://localhost:4000/local-storage/upload/music-library/luxury-piano-01.wav");
  });

  it("rejects keys that attempt to escape the root directory", async () => {
    await expect(adapter.putObject("../../etc/passwd", Buffer.from("x"), "text/plain")).rejects.toThrow();
  });
});
