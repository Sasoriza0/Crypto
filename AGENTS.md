<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# ShiftCrack — Agent Guide

Monorepo (npm workspaces): `apps/web` (Next.js 16 App Router + Tailwind v4 + Zustand), `apps/server` (Express 5 + Prisma 7), `packages/shared` (zod contracts).

## Verification commands

- `npm run lint` / `npm run typecheck` / `npm run test` (root, all workspaces)
- `npm run build` (root: shared → server → web; Next build needs `@shiftcrack/shared` built first)
- Server smoke (needs running server + Postgres): `npm run smoke --workspace @shiftcrack/server`

## Conventions

- Never commit real secrets (`.env*` are gitignored; `.env.example` holds fakes only).
- Wire shapes: single source of truth in `packages/shared/src/index.ts` (zod); server validates inputs, client parses responses with the same schemas.
- Web: `next dev` on port 3000; API base via `NEXT_PUBLIC_API_URL`.
