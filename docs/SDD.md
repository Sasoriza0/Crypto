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
