//connect to DB
import { PrismaClient } from "@prisma/client";


const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};


const logLevels =
  process.env.NODE_ENV === "development"
    ? (["query", "warn", "error"] as const)
    : (["error"] as const);

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: [...logLevels],

    
    datasourceUrl: process.env.DATABASE_URL,
  });


if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}


process.on("beforeExit", async () => {
  await prisma.$disconnect();
});