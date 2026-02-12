import "dotenv/config";
import { defineConfig } from "prisma/config";

// Use DATABASE_URL from env; fallback for prisma generate when no DB is set up yet
const databaseUrl =
  process.env.DATABASE_URL ?? "postgresql://user:password@localhost:5432/brewery_membership";

export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url: databaseUrl
  },
  migrations: {
    path: "prisma/migrations"
  }
});
