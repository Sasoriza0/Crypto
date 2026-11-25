import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { defineConfig } from 'prisma/config';

/**
 * Root Prisma config for ShiftCrack (monorepo).
 *
 * Allows running Prisma CLI commands (e.g. `npx prisma migrate deploy`) directly
 * from the repository root as well as in CI/CD environments.
 *
 * Environment variable precedence:
 *   1. process.env (real hosting environment e.g. EC2, Vercel, CI/CD secrets)
 *   2. apps/server/.env (server-specific local overrides)
 *   3. .env (root shared local configuration)
 */
const rootDir = path.dirname(fileURLToPath(import.meta.url));
const serverDir = path.join(rootDir, 'apps/server');

const parsed: Record<string, string> = {};
dotenv.config({ path: path.join(rootDir, '.env'), processEnv: parsed });
dotenv.config({ path: path.join(serverDir, '.env'), processEnv: parsed, override: true });

for (const [key, value] of Object.entries(parsed)) {
  if (process.env[key] === undefined) process.env[key] = value;
}

export default defineConfig({
  schema: 'apps/server/prisma/schema.prisma',
  datasource: {
    url: process.env.DATABASE_URL,
  },
});
