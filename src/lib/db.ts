import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.DB_LOG_QUERIES === "true" ? ["query", "warn", "error"] : ["error"],
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db
