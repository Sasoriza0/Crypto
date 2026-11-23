import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { defineConfig } from 'prisma/config';

/**
 * Prisma 7 no longer auto-loads .env files nor accepts `url` inside
 * schema.prisma. Mirrors src/lib/env.ts (kept self-contained because the
 * Prisma CLI bundles this config with its own loader): root .env first,
 * apps/server/.env on top, real process env always wins. Paths come from
 * this file's location, never from cwd. Migrate reads the connection
 * string from `datasource.url` below; at runtime the PrismaClient itself
 * is wired with the pg driver adapter instead (see src/prisma/client.ts).
 */
const serverDir = path.dirname(fileURLToPath(import.meta.url));
const repoRootDir = path.resolve(serverDir, '../..');

const parsed: Record<string, string> = {};
dotenv.config({ path: path.join(repoRootDir, '.env'), processEnv: parsed });
dotenv.config({ path: path.join(serverDir, '.env'), processEnv: parsed, override: true });

for (const [key, value] of Object.entries(parsed)) {
  if (process.env[key] === undefined) process.env[key] = value;
}

export default defineConfig({
  schema: 'prisma/schema.prisma',
  datasource: {
    url: process.env.DATABASE_URL,
  },
});
