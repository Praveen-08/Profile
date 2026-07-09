export interface PresignedUpload {
  url: string;
  method: "PUT";
  headers?: Record<string, string>;
}

/**
 * A single interface both LocalDiskAdapter (dev default) and
 * CloudflareR2Adapter (production, S3-compatible) implement identically —
 * apps/api, apps/worker, and apps/ai-service never branch on which one is
 * active.
 */
export interface StorageAdapter {
  putObject(key: string, data: Buffer, contentType: string): Promise<void>;
  getObjectBuffer(key: string): Promise<Buffer>;
  deleteObject(key: string): Promise<void>;
  /** A URL that can be fetched directly (by the browser, or by apps/ai-service to pull audio for analysis). */
  getObjectUrl(key: string): string;
  /** A short-lived URL the browser can PUT the raw file bytes to directly, bypassing the API server for the upload itself. */
  getPresignedUploadUrl(key: string, contentType: string): Promise<PresignedUpload>;
}
