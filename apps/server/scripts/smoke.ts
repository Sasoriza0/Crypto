/**
 * End-to-end smoke test for the game API (SDD §8.3 step 4.1 DoD).
 *
 * Expects the dev server to be running (`npm run dev` in apps/server).
 * Creates an anonymous user + session row directly via Prisma (the auth
 * endpoints arrive in step 4.2), then exercises the full game flow over
 * HTTP: create -> wrong attempts -> correct attempt -> hints -> abandon.
 *
 * Run: npm run smoke --workspace @shiftcrack/server
 */
import 'dotenv/config';
import { prisma } from '../src/prisma/client.js';
import { createSession, SESSION_COOKIE } from '../src/services/session.service.js';

const BASE = `http://localhost:${process.env.PORT ?? 4000}/api/v1/game`;
const JSON_HEADERS = { 'content-type': 'application/json' };

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`SMOKE FAILED: ${message}`);
}

async function main() {
  const user = await prisma.user.create({ data: { provider: 'anonymous' } });
  const session = await createSession(user.id);
  const headers = { ...JSON_HEADERS, cookie: `${SESSION_COOKIE}=${session.id}` };

  // 401 without a cookie
  const unauthorizedRes = await fetch(`${BASE}/sessions`, {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify({ module: 'CAESAR', difficulty: 'EASY', language: 'uk' }),
  });
  assert(unauthorizedRes.status === 401, `expected 401 without cookie, got ${unauthorizedRes.status}`);

  // 400 on invalid payload
  const badPayload = await fetch(`${BASE}/sessions`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ module: 'CAESAR', difficulty: 'EASY', language: 'fr' }),
  });
  assert(badPayload.status === 400, `expected 400 on bad language, got ${badPayload.status}`);

  // Create a session: ciphertext present, secrets absent
  const createdRes = await fetch(`${BASE}/sessions`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ module: 'CAESAR', difficulty: 'EASY', language: 'uk' }),
  });
  assert(createdRes.status === 201, `expected 201, got ${createdRes.status}`);
  const created = (await createdRes.json()) as Record<string, unknown>;
  const sessionId = created.id as string;
  assert(typeof created.ciphertext === 'string' && created.ciphertext.length > 0, 'ciphertext missing');
  assert(!('plaintextHash' in created) && !('cipherParams' in created), 'secrets leaked in create response');

  // Wrong-attempt + hint checks happen on a session we will solve via
  // brute-force. EASY Caesar = shift 1..3, so the solve takes at most 3
  // attempts — always below the lock threshold of 3 consecutive failures
  // (the 3rd attempt here succeeds, and lockout only applies on failure).

  // Request the first hint
  const hintRes = await fetch(`${BASE}/sessions/${sessionId}/hints`, { method: 'POST', headers });
  const hintBody = (await hintRes.json()) as Record<string, unknown>;
  assert(hintRes.status === 200 && typeof hintBody.hint === 'string' && hintBody.hintsUsed === 1, 'hint failed');

  // Correct answer: brute-force the Caesar shift locally via the API.
  const alphabet = 'абвгґдеєжзиіїйклмнопрстуфхцчшщьюя';
  const ciphertext = created.ciphertext as string;
  let solved: Record<string, unknown> | null = null;
  const attemptLog: string[] = [];
  for (const shift of [1, 2, 3]) {
    const plaintext = [...ciphertext]
      .map((ch) => {
        const idx = alphabet.indexOf(ch);
        if (idx === -1) return ch;
        return alphabet[(idx - shift + alphabet.length) % alphabet.length]!;
      })
      .join('');
    const res = await fetch(`${BASE}/sessions/${sessionId}/attempts`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ answer: plaintext }),
    });
    const body = (await res.json()) as Record<string, unknown>;
    attemptLog.push(`shift=${shift} status=${res.status} body=${JSON.stringify(body)}`);
    if (body.correct === true) {
      solved = body;
      break;
    }
  }
  assert(solved !== null, `correct answer was not accepted. attempts:\n${attemptLog.join('\n')}`);
  assert(typeof solved.score === 'number' && solved.score > 0, 'score missing on solve');
  assert(typeof solved.plaintext === 'string' && solved.plaintext.length > 0, 'plaintext missing on solve');

  // Session is now SOLVED; attempts are rejected
  const afterSolve = await fetch(`${BASE}/sessions/${sessionId}/attempts`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ answer: 'whatever' }),
  });
  assert(afterSolve.status === 409, `expected 409 on solved session, got ${afterSolve.status}`);

  // Lockout: fresh session, 3 wrong attempts -> 4th is locked (423)
  const lockRes = await fetch(`${BASE}/sessions`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ module: 'CAESAR', difficulty: 'EASY', language: 'uk' }),
  });
  const lockSession = (await lockRes.json()) as Record<string, unknown>;
  for (let i = 0; i < 3; i++) {
    await fetch(`${BASE}/sessions/${lockSession.id}/attempts`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ answer: 'zzz' }),
    });
  }
  const lockedRes = await fetch(`${BASE}/sessions/${lockSession.id}/attempts`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ answer: 'zzz' }),
  });
  assert(lockedRes.status === 423, `expected 423 lockout, got ${lockedRes.status}`);

  // Abandon the locked session
  const abandonRes = await fetch(`${BASE}/sessions/${lockSession.id}/abandon`, { method: 'POST', headers });
  const abandonBody = (await abandonRes.json()) as Record<string, unknown>;
  assert(abandonRes.status === 200 && abandonBody.status === 'FAILED', 'abandon failed');

  await prisma.session.delete({ where: { id: session.id } });
  await prisma.gameSession.deleteMany({ where: { userId: user.id } });
  await prisma.user.delete({ where: { id: user.id } });

  console.log('SMOKE OK: create -> wrong attempts -> hint -> solve -> solved-guard -> lockout -> abandon');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
