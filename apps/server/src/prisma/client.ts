import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import { PrismaClient } from '../generated/prisma/client.js';

/**
 * Single PrismaClient for the whole app, wired through the pg driver
 * adapter (Prisma 7). A module-level singleton avoids leaking connections
 * during dev hot-reloads; the pg Pool keeps idle connections reusable.
 */
const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,
});

export const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
