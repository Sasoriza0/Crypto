# ShiftCrack — Software Design Document (SDD)

Status: **Approved**

## 1. Overview

Browser-based educational cryptography game: the server generates ciphertexts (Caesar, Transposition, Frequency Analysis) and the player cracks them as a cryptoanalyst. Hybrid user model: anonymous play immediately + optional account. Game state is stored in PostgreSQL. Scoring: time + attempts, no leaderboard.

Tech stack: Next.js (App Router) + Tailwind CSS + Zustand | Node.js + Express + TypeScript | PostgreSQL + Prisma | npm workspaces | GitHub Actions.

## 2. Monorepo structure (npm workspaces)

```
shiftcrack/
├── package.json                  # workspaces: ["apps/*", "packages/*"]
├── .env.example                  # FAKE values only
├── .gitignore
├── .github/workflows/ci.yml
├── apps/
│   ├── web/                      # Next.js (App Router) + Tailwind + Zustand
│   │   ├── app/
│   │   │   ├── layout.tsx        # Providers (theme, i18n, auth)
│   │   │   ├── page.tsx          # Module selection
│   │   │   └── modules/[slug]/page.tsx
│   │   ├── components/
│   │   │   ├── cipher/           # CaesarPanel, TranspositionPanel
│   │   │   ├── frequency/        # FrequencyTable, SubstitutionMap
│   │   │   ├── hints/, ui/
│   │   ├── store/                # Zustand slices
│   │   ├── lib/                  # api client, i18n
│   │   └── messages/             # uk.json, en.json
│   └── server/                   # Express + TypeScript
│       ├── src/
│       │   ├── index.ts, app.ts
│       │   ├── routes/           # auth, game, health
│       │   ├── controllers/
│       │   ├── services/
│       │   │   ├── ciphers/      # caesar.ts, transposition.ts
│       │   │   ├── frequency.service.ts, phrase.service.ts, scoring.service.ts
│       │   ├── middleware/       # rateLimit, validate (zod), session, securityHeaders
│       │   └── prisma/           # schema.prisma, seed.ts
└── packages/
    └── shared/                   # shared types, zod schemas, API contracts, difficulty constants
```

## 3. Prisma schema

```prisma
enum Difficulty  { EASY MEDIUM HARD }
enum CipherModule { CAESAR TRANSPOSITION FREQUENCY }
enum SessionStatus { ACTIVE SOLVED FAILED EXPIRED }

model User {
  id           String   @id @default(cuid())
  email        String?  @unique        // null for anonymous users
  passwordHash String?                 // bcrypt, accounts only
  provider     String   @default("anonymous")  // "anonymous" | "local"
  createdAt    DateTime @default(now())
  gameSessions GameSession[]
}

model GameSession {
  id            String        @id @default(cuid())
  userId        String
  user          User          @relation(fields: [userId], references: [id])
  module        CipherModule
  difficulty    Difficulty
  language      String        // "uk" | "en" — phrase language (= UI language)
  ciphertext    String
  plaintextHash String        // SHA-256 of normalized plaintext. Plaintext is NEVER stored
  cipherParams  Json          // shift / permutation key — server-side only
  status        SessionStatus @default(ACTIVE)
  attempts      Int           @default(0)
  hintsUsed     Int           @default(0)
  score         Int?
  lockedUntil   DateTime?     // cooldown after failed attempts (anti-bruteforce)
  startedAt     DateTime      @default(now())
  solvedAt      DateTime?
  expiresAt     DateTime      // session lifetime TTL
}
```

Security decision: answer verification compares SHA-256(normalized answer) against `plaintextHash`. Even if the DB leaks, plaintexts stay unrecoverable.

## 4. API (base `/api/v1`, all inputs validated with zod)

| Method | Path | Description |
|---|---|---|
| POST | `/auth/anonymous` | Creates anonymous User + session cookie |
| POST | `/auth/register` / `/auth/login` | Optional account (email + bcrypt) |
| GET | `/auth/me` | Current session/user |
| POST | `/auth/logout` | Destroy session |
| GET | `/game/modules` | Module metadata + guides (i18n, static) |
| POST | `/game/sessions` | `{ module, difficulty, language }` → creates GameSession, returns `{ id, ciphertext, meta }` — **without** plaintext/key |
| POST | `/game/sessions/:id/attempts` | `{ answer }` → `{ correct: false }` or `{ correct: true, plaintext, score }` (plaintext only after success) |
| POST | `/game/sessions/:id/hints` | Next hint tier (score penalty), increments `hintsUsed` |
| GET | `/game/sessions/:id` | Status for game resume |
| POST | `/game/sessions/:id/abandon` | Abandon session |
| GET | `/health` | Liveness probe |

Difficulty (3 levels): Caesar — shift 1–3 / 4–15 / 1–25; Transposition — key length 4–5 / 6–7 / 8–9; Frequency — short / medium / long texts; hint count inversely proportional to level.

## 5. Security (OWASP Top 10)

- **Rate limiting**: global 100 req/15min/IP (express-rate-limit); `attempts` endpoint — 5/min/IP + per-session lockout: 3 failed attempts → 60s, then exponential (`lockedUntil`).
- **Sessions**: httpOnly + Secure + SameSite=Lax cookie, 256-bit CSPRNG session id; id rotation on login.
- **Headers**: helmet with tuned CSP, X-Content-Type-Options, HSTS in production.
- **Validation**: zod on every input; answers normalized (lowercase, letters only) before hashing.
- **Plaintext isolation**: plaintext is never persisted and never sent before a correct answer.

## 6. Zustand strategy

- `useThemeStore` (persist): light/dark.
- `useI18nStore` (persist): uk/en.
- `useAuthStore`: user + hydration via `GET /auth/me` on startup.
- `useGameStore` (not persisted): GameSession (id, ciphertext, attempts, hints, status), timer; actions: `startGame`, `submitAttempt`, `requestHint`, `reset`.
- Frequency module: substitution mapping (cipher→plain) lives in a separate slice so frequency-table updates don't re-render the whole screen (selective subscriptions).

## 7. CI/CD (GitHub Actions)

- **Trigger**: push/PR to `main`.
- **Jobs**: `lint+typecheck` (eslint, tsc) → `test` (vitest: cipher services, scoring, validation) → `build` (next build + tsc server) → `npm audit`.
- **Deploy prep (optional, on main)**: web → Vercel (VERCEL_TOKEN in GitHub Secrets); server → AWS EC2 via SSH deploy (stub, disabled by flag). Real secrets only in GitHub Secrets, never in code/`.env.example`.

## 8. Development progress & roadmap

Last updated: 2026-09-23.

### 8.1 Locked-in facts

- **Prisma schema is fully specified** (`apps/server/prisma/schema.prisma`): domain entities `User` and `GameSession` + enums are final per §3; no redesign of existing models is expected. The generated Prisma 7 client lives in `apps/server/src/generated/prisma` (committed to git).
- **Database is live**: migrations `20260923103830_init` and `20260923114136_add_session` applied; schema and DB are in sync. `add_session` adds the server-side `Session` table (SDD §8.3 step 4.2, Option A approved).
- **Server bootstrap is complete** (`apps/server/src/app.ts` factory + `src/index.ts` boot): Express 5 with helmet (tuned CSP in production, relaxed in dev), CORS locked to `CLIENT_ORIGIN` with credentials, global `express-rate-limit` (env-tunable, default 100 req/15min/IP), JSON body cap (32kb), `GET /health` liveness probe, JSON 404 handler, centralized error handler without stack-trace leaks, `x-powered-by` disabled, `TRUST_PROXY` support. Typecheck passes; `/health` verified returning `200 {"status":"ok",...}` with `X-Content-Type-Options: nosniff`.
- **Step 4.1 delivered** (API architecture): `src/prisma/client.ts` (PrismaPg adapter, pool singleton); services `ciphers/{caesar,transposition,substitution}.ts`, `phrase.service.ts` (uk/en corpora × difficulty, plaintext never persisted), `frequency.service.ts`, `scoring.service.ts`, `hints.service.ts`, `game.service.ts` (create/attempt/hint/abandon/expiry sweep, sha256 + timing-safe compare, 3-failure lockout: 60s → doubling), `session.service.ts` (store primitives); middleware `validate` (zod), `session` (requireAuth guard — already protects game routes), `rateLimiters` (attempts 5/min/IP, env-tunable via `RATE_LIMIT_ATTEMPTS_MAX`); controller + `routes/game.ts` mounted under `/api/v1/game` per §4; shared enums reworked to const-objects + literal unions (wire format unchanged) for interop with Prisma-generated types; `scripts/smoke.ts` end-to-end flow. Verified: tsc clean, 22 vitest tests green, smoke flow green (401/400/201 → hint → solve with plaintext+score only on success → 409 on solved → 423 lockout → abandon).

### 8.2 Phase tracker

| Phase | Scope | Status |
|---|---|---|
| 1 | Monorepo bootstrap (npm workspaces), `.env.example`, scripts | ✅ Done |
| 2 | `@shiftcrack/shared` contracts (enums + zod), Prisma schema + generated client | ✅ Done |
| 3 | Server bootstrap (Express + OWASP baseline) & first migration `init` | ✅ Done |
| 4 | API architecture, auth + guards, frontend bootstrap (see §8.3) | 🔄 In progress — 4.1 ✅, 4.2/4.3 next |
| 5 | Game logic polish, full web UI (panels, stores, i18n), CI hardening | Planned |

### 8.3 Phase 4 plan — API architecture, auth, frontend bootstrap

#### Step 4.1 — API architecture (routes / controllers / services)

1. **Prisma wiring** — `src/prisma/client.ts`: `PrismaClient` with `PrismaPg` adapter over a `pg` Pool, `DATABASE_URL` from env; module-level singleton to avoid connection leaks under dev hot-reload.
2. **Services** (`src/services/`, pure logic, no HTTP concerns):
   - `ciphers/caesar.ts`, `ciphers/transposition.ts` — encode/decode, difficulty parameter ranges per §4;
   - `phrase.service.ts` — phrase corpora for `uk`/`en` × difficulty; picks a phrase, produces ciphertext + `cipherParams`, computes `plaintextHash` = SHA-256 of normalized plaintext (plaintext never persisted);
   - `scoring.service.ts` — score from elapsed time, attempts, `hintsUsed` per module/difficulty;
   - `game.service.ts` — session lifecycle: `create`, `submitAttempt` (normalize → hash → timing-safe compare; `attempts++`; lockout cooldown on repeated failures), `requestHint` (next tier, score penalty), `get`, `abandon`, expiration sweep on `(status, expiresAt)` index. Plaintext is returned **only** after a correct answer.
3. **Controllers** (`src/controllers/`) — thin adapters: validate input with the zod schemas from `@shiftcrack/shared`, call services, map domain errors to HTTP statuses.
4. **Routes** (`src/routes/auth.ts`, `src/routes/game.ts`) mounted in `app.ts` under `/api/v1` exactly per §4.
5. **Middleware** (`src/middleware/`): `validate(schema, source)` (zod, 400 with issue list — no internals leaked), `asyncHandler`, per-endpoint rate limiters (`attempts` 5/min/IP per §5).
6. **Error model**: single JSON shape `{ error: { code, message } }`; domain errors → statuses (404/409/429/400), unknown errors → 500 without details.
7. **Definition of done**: vitest unit tests for ciphers (round-trip), normalization+hash determinism, scoring bounds, lockout math; `tsc` clean; manual curl flow — create session → wrong attempt → correct attempt → plaintext+score only on success; `/health` stays green.

#### Step 4.2 — Authentication & endpoint protection

1. **Session storage decision** (confirm before implementation):
   - Option A (recommended): add a `Session` model (`id`, `userId`, `expiresAt`) via migration `add_session` — server-side revocation on logout, id rotation on login, matches §5 wording.
   - Option B: stateless HMAC-signed cookie (`SESSION_SECRET`) — no schema change, but no revocation until expiry; MVP tradeoff.
2. **Auth endpoints** per §4: `POST /auth/anonymous` (User with `provider=anonymous` + session cookie), `POST /auth/register` (zod email + password ≥ 8, unique email → 409, `bcryptjs` cost 12), `POST /auth/login` (timing-safe compare, session id rotation), `GET /auth/me`, `POST /auth/logout`.
3. **Session cookie**: `httpOnly`, `Secure` in production, `SameSite=Lax`, `maxAge` from `SESSION_TTL_HOURS`; 256-bit CSPRNG session id.
4. **Guards**: `session` middleware resolves the cookie into `{ userId }` (DB lookup or HMAC verify) → 401 JSON otherwise; `requireAuth` on all `/game/*` endpoints; stricter rate limit on auth endpoints (e.g. 10/min/IP).
5. **Definition of done**: anonymous play works with zero friction; register → login → me round-trip; missing/expired cookie → 401; logout revokes (Option A); no PII in logs.

#### Step 4.3 — Frontend bootstrap & shared types

1. **Scaffold** `apps/web`: Next.js (App Router) + TypeScript + Tailwind, port 3000.
2. **Shared types wiring**: workspace dependency on `@shiftcrack/shared`; `transpilePackages: ['@shiftcrack/shared']` in `next.config`; root scripts build shared before web (or `tsc --watch` in dev).
3. **API client** (`apps/web/lib/api.ts`): typed fetch wrapper over `NEXT_PUBLIC_API_URL`, reuses shared zod schemas for requests/responses; 401 → auth store reset.
4. **Shell**: `layout.tsx` providers (theme, i18n), module selection page, stub `modules/[slug]/page.tsx`.
5. **Zustand stores** per §6: `useThemeStore`/`useI18nStore` (persist), `useAuthStore` (hydrate via `GET /auth/me`), `useGameStore` skeleton (`startGame`, `submitAttempt`, `requestHint`, `reset`), separate frequency slice.
6. **i18n**: `messages/uk.json`, `messages/en.json` minimal chrome/UI keys.
7. **Definition of done**: web boots and talks to the API from the browser (CORS via `CLIENT_ORIGIN` already enforced); types flow from shared into components with zero duplication; uk/en + light/dark persist across reload.

**Phase 4 cross-cutting DoD**: root `npm run typecheck` / `test` / `build` green; end-to-end smoke via curl (anonymous → create session → solve); CI workflow extended with server vitest job.
