import { Redis, type RedisOptions } from "ioredis";

let sharedConnection: Redis | null = null;

/**
 * A single shared ioredis connection reused by every Queue/Worker/QueueEvents
 * instance in a process — BullMQ recommends this over one connection per
 * queue to avoid exhausting Redis's connection limit under load.
 *
 * Uses ioredis's named `Redis` export rather than the default export:
 * consuming packages import this file's raw TypeScript source directly
 * (workspace packages have no build step), so it gets type-checked under
 * each consumer's own tsconfig — and default-export CJS interop resolves
 * inconsistently across "Bundler" vs "NodeNext" moduleResolution. The
 * named export sidesteps that entirely.
 */
export function getRedisConnection(redisUrl: string = process.env.REDIS_URL ?? "redis://localhost:6379"): Redis {
  if (!sharedConnection) {
    const options: RedisOptions = { maxRetriesPerRequest: null };
    sharedConnection = new Redis(redisUrl, options);
  }
  return sharedConnection;
}
