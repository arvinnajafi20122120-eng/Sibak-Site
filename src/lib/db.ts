import { PrismaClient } from "@prisma/client";
import { PrismaLibSQL } from "@prisma/adapter-libsql";

/**
 * اتصال به دیتابیس سیبک.
 *
 * Dev / Local:
 *   SQLite محلی با DATABASE_URL=file:./dev.db
 *
 * Production:
 *   Turso / libSQL با DATABASE_URL=libsql://...
 *   و DATABASE_AUTH_TOKEN
 */

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient(): PrismaClient {
  const databaseUrl = process.env.DATABASE_URL ?? "";

  const isTurso =
    databaseUrl.startsWith("libsql://") ||
    databaseUrl.startsWith("libsql:");

  // Production + Turso
  if (
    isTurso &&
    process.env.NODE_ENV === "production" &&
    !process.env.DISABLE_TURSO_ADAPTER
  ) {
    const token = process.env.DATABASE_AUTH_TOKEN;

    if (!token) {
      throw new Error("DATABASE_AUTH_TOKEN is not set");
    }

    const adapter = new PrismaLibSQL({
      url: databaseUrl,
      authToken: token,
    });

    return new PrismaClient({
      adapter,
      log: ["error"],
    });
  }

  // Local development: SQLite
  return new PrismaClient({
    log: ["error"],
  });
}

export const db =
  globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = db;
}