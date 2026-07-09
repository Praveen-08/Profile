import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type { PresignedUpload, StorageAdapter } from "./adapter.js";

export interface R2AdapterConfig {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  /** Public bucket URL (custom domain or r2.dev subdomain) for getObjectUrl. */
  publicBaseUrl: string;
}

/**
 * Production storage adapter — Cloudflare R2 via its S3-compatible API.
 * Same StorageAdapter contract as LocalDiskAdapter; swapping
 * STORAGE_DRIVER=r2 in .env is the only change required anywhere else in
 * the system.
 */
export function createR2Adapter(config: R2AdapterConfig): StorageAdapter {
  const client = new S3Client({
    region: "auto",
    endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  });

  return {
    async putObject(key, data, contentType) {
      await client.send(
        new PutObjectCommand({ Bucket: config.bucket, Key: key, Body: data, ContentType: contentType }),
      );
    },

    async getObjectBuffer(key) {
      const result = await client.send(new GetObjectCommand({ Bucket: config.bucket, Key: key }));
      const bytes = await result.Body?.transformToByteArray();
      if (!bytes) throw new Error(`R2 object not found or empty: "${key}"`);
      return Buffer.from(bytes);
    },

    async deleteObject(key) {
      await client.send(new DeleteObjectCommand({ Bucket: config.bucket, Key: key }));
    },

    getObjectUrl(key) {
      return `${config.publicBaseUrl.replace(/\/$/, "")}/${key}`;
    },

    async getPresignedUploadUrl(key, contentType): Promise<PresignedUpload> {
      const command = new PutObjectCommand({ Bucket: config.bucket, Key: key, ContentType: contentType });
      const url = await getSignedUrl(client, command, { expiresIn: 900 });
      return { url, method: "PUT", headers: { "Content-Type": contentType } };
    },
  };
}
