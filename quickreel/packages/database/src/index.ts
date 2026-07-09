import { PrismaClient } from "../generated/client/index.js";

export * from "../generated/client/index.js";

declare global {
  // eslint-disable-next-line no-var
  var __quickreelPrisma: PrismaClient | undefined;
}

/**
 * Singleton Prisma client. In dev, Turborepo/tsx hot-reload can otherwise
 * spawn a new client (and connection pool) per reload — the global cache
 * avoids exhausting Postgres's connection limit.
 */
export const prisma: PrismaClient =
  globalThis.__quickreelPrisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV === "development") {
  globalThis.__quickreelPrisma = prisma;
}
