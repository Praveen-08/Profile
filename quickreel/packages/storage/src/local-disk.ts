import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { PresignedUpload, StorageAdapter } from "./adapter.js";

export interface LocalDiskAdapterConfig {
  /** Directory files are written under, e.g. ./.data/storage */
  rootDir: string;
  /** Base URL apps/api serves this directory from, e.g. http://localhost:4000/local-storage */
  publicBaseUrl: string;
  /** Base URL of apps/api itself, used to build the "presigned" (really: passthrough) upload endpoint. */
  apiInternalUrl: string;
}

function safeJoin(rootDir: string, key: string): string {
  const resolvedRoot = join(rootDir);
  const resolvedPath = join(rootDir, key);
  if (!resolvedPath.startsWith(resolvedRoot)) {
    throw new Error(`Storage key escapes root directory: "${key}"`);
  }
  return resolvedPath;
}

/**
 * Dev-default storage adapter — plain disk I/O under LOCAL_STORAGE_DIR.
 * Local disk has no native concept of a presigned URL, so
 * `getPresignedUploadUrl` instead points at a matching passthrough route
 * apps/api exposes (`PUT /local-storage/upload/:key`) that streams the
 * request body straight to disk — same call shape the browser uses for R2,
 * just backed by a different implementation.
 */
export function createLocalDiskAdapter(config: LocalDiskAdapterConfig): StorageAdapter {
  return {
    async putObject(key, data) {
      const filePath = safeJoin(config.rootDir, key);
      await mkdir(dirname(filePath), { recursive: true });
      await writeFile(filePath, data);
    },

    async getObjectBuffer(key) {
      return readFile(safeJoin(config.rootDir, key));
    },

    async deleteObject(key) {
      await rm(safeJoin(config.rootDir, key), { force: true });
    },

    getObjectUrl(key) {
      return `${config.publicBaseUrl.replace(/\/$/, "")}/${key}`;
    },

    async getPresignedUploadUrl(key): Promise<PresignedUpload> {
      const encodedPath = key.split("/").map(encodeURIComponent).join("/");
      return {
        url: `${config.apiInternalUrl.replace(/\/$/, "")}/local-storage/upload/${encodedPath}`,
        method: "PUT",
      };
    },
  };
}
