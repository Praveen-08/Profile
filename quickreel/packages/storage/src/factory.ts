import { isAbsolute, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createLocalDiskAdapter } from "./local-disk.js";
import { createR2Adapter } from "./r2.js";
import type { StorageAdapter } from "./adapter.js";

/**
 * packages/storage/src/factory.ts -> monorepo root is three levels up.
 * Anchoring here (rather than `process.cwd()`) matters because
 * `pnpm --filter <pkg> run <script>` and Turborepo tasks run with CWD set
 * to the *package* directory — a relative LOCAL_STORAGE_DIR resolved
 * against `process.cwd()` would silently point apps/api, apps/worker, and
 * any one-off script at three different directories on disk.
 */
const MONOREPO_ROOT = fileURLToPath(new URL("../../..", import.meta.url));

function resolveStorageDir(dir: string): string {
  return isAbsolute(dir) ? dir : resolve(MONOREPO_ROOT, dir);
}

export interface StorageEnv {
  STORAGE_DRIVER?: string;
  LOCAL_STORAGE_DIR?: string;
  LOCAL_STORAGE_PUBLIC_BASE_URL?: string;
  API_INTERNAL_URL?: string;
  R2_ACCOUNT_ID?: string;
  R2_ACCESS_KEY_ID?: string;
  R2_SECRET_ACCESS_KEY?: string;
  R2_BUCKET?: string;
  R2_PUBLIC_BASE_URL?: string;
}

/** Reads STORAGE_DRIVER (defaulting to "local") and builds the matching adapter from env. */
export function createStorageAdapterFromEnv(env: StorageEnv = process.env as StorageEnv): StorageAdapter {
  const driver = env.STORAGE_DRIVER ?? "local";

  if (driver === "r2") {
    const required = ["R2_ACCOUNT_ID", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_BUCKET", "R2_PUBLIC_BASE_URL"] as const;
    for (const key of required) {
      if (!env[key]) throw new Error(`STORAGE_DRIVER=r2 requires ${key} to be set`);
    }
    return createR2Adapter({
      accountId: env.R2_ACCOUNT_ID!,
      accessKeyId: env.R2_ACCESS_KEY_ID!,
      secretAccessKey: env.R2_SECRET_ACCESS_KEY!,
      bucket: env.R2_BUCKET!,
      publicBaseUrl: env.R2_PUBLIC_BASE_URL!,
    });
  }

  return createLocalDiskAdapter({
    rootDir: resolveStorageDir(env.LOCAL_STORAGE_DIR ?? "./.data/storage"),
    publicBaseUrl: env.LOCAL_STORAGE_PUBLIC_BASE_URL ?? "http://localhost:4000/local-storage",
    apiInternalUrl: env.API_INTERNAL_URL ?? "http://localhost:4000",
  });
}
