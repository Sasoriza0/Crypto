import 'dotenv/config';
import { defineConfig } from 'prisma/config';

/**
 * Prisma 7 no longer auto-loads .env files nor accepts `url` inside
 * schema.prisma. The CLI resolves this config relative to the workspace root
 * (apps/server), so dotenv picks up apps/server/.env, and Migrate reads the
 * connection string from `datasource.url` below. At runtime the PrismaClient
 * itself is wired with the pg driver adapter instead (see src later).
 */
export default defineConfig({
  schema: 'prisma/schema.prisma',
  datasource: {
    url: process.env.DATABASE_URL,
  },
});
