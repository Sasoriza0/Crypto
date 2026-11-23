import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

/**
 * Deterministic env loading for the server workspace.
 *
 * `dotenv/config` resolves `.env` against process.cwd(). That breaks the
 * monorepo contract: `npm run dev:server` runs the workspace script with
 * cwd = apps/server, so only apps/server/.env was loaded and the root
 * .env (SMTP_*, MAIL_FROM, CLIENT_ORIGIN, ...) was silently skipped —
 * hence the "SMTP not configured" fallback despite a filled root .env.
 *
 * Paths here are derived from this module's location (src/lib and
 * dist/lib are both directly under apps/server), never from cwd, so the
 * same files load no matter where the process is started from.
 *
 * Precedence (highest wins):
 *   1. real process environment (deploy env, `--env-file`, CI secrets)
 *   2. apps/server/.env — server-specific overrides
 *   3. <repo root>/.env — shared monorepo config
 */

const serverDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const repoRootDir = path.resolve(serverDir, '../..');

const parsed: Record<string, string> = {};
dotenv.config({ path: path.join(repoRootDir, '.env'), processEnv: parsed });
dotenv.config({ path: path.join(serverDir, '.env'), processEnv: parsed, override: true });

for (const [key, value] of Object.entries(parsed)) {
  if (process.env[key] === undefined) process.env[key] = value;
}
