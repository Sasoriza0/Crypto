/**
 * End-to-end smoke test for the game + auth API (SDD §8.3 steps 4.1/4.2).
 *
 * Expects the dev server to be running (`npm run dev` in apps/server).
 * Exercises the full flow over HTTP: auth (anonymous -> register -> login ->
 * me -> logout) and game (create -> wrong attempts -> correct attempt ->
 * hints -> EASY no-lockout -> MEDIUM lockout -> abandon), reusing the
 * session cookie end to end.
 *
 * Idempotent: every run registers a fresh unique account
 * (`smoke_<runId>@example.com`), so leftover rows from a previously crashed
 * run can never collide with the next one.
 *
 * Run: npm run smoke --workspace @shiftcrack/server
 */
import 'dotenv/config';
import { prisma } from '../src/prisma/client.js';
import { SESSION_COOKIE } from '../src/services/session.service.js';

const API = `http://localhost:${process.env.PORT ?? 4000}/api/v1`;
const JSON_HEADERS = { 'content-type': 'application/json' };
const GAME_BASE = `${API}/game`;
const AUTH_BASE = `${API}/auth`;

// Unique per-run identity. base36 keeps the nickname within the 3-15 char
// policy ("smoke_" + 8 chars = 14) while the suffix never repeats.
const RUN_ID = Date.now().toString(36).slice(-8);
const EMAIL = `smoke_${RUN_ID}@example.com`;
const NICKNAME = `smoke_${RUN_ID}`;

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`SMOKE FAILED: ${message}`);
}

async function request(
  path: string,
  init: RequestInit = {},
): Promise<{ status: number; body: Record<string, unknown>; headers: Headers }> {
  const res = await fetch(path, init);
  const text = await res.text();
  let body: Record<string, unknown> = {};
  if (text) {
    try {
      body = JSON.parse(text) as Record<string, unknown>;
    } catch {
      // Non-JSON bodies (e.g. a proxy's plain-text 429) must not crash the
      // runner — keep the raw text so assert messages stay readable.
      body = { __raw: text };
    }
  }
  return { status: res.status, body, headers: res.headers };
}

async function main() {
  // ---------------------------------------------------------------------
  // Auth flow
  // ---------------------------------------------------------------------

  // 401 on /me without a cookie
  const me401 = await request(`${AUTH_BASE}/me`);
  assert(me401.status === 401, `expected 401 on /me without cookie, got ${me401.status}`);

  // Anonymous sign-in: 201 + httpOnly cookie + no email
  const anon = await request(`${AUTH_BASE}/anonymous`, { method: 'POST', headers: JSON_HEADERS });
  assert(anon.status === 201, `expected 201 on /auth/anonymous, got ${anon.status}`);
  const anonSetCookie = anon.headers.get('set-cookie') ?? '';
  assert(anonSetCookie.includes(`${SESSION_COOKIE}=`), 'anonymous did not set a session cookie');
  assert(anonSetCookie.includes('HttpOnly'), 'session cookie is not httpOnly');
  const anonUser = (anon.body.user ?? {}) as Record<string, unknown>;
  assert(anonUser.provider === 'anonymous' && anonUser.email === null, 'anonymous user shape wrong');

  // Session cookie survives into /me
  const meRes = await request(`${AUTH_BASE}/me`, { headers: { cookie: anonSetCookie.split(';')[0] } });
  assert(meRes.status === 200 && (meRes.body.user as Record<string, unknown>).id === anonUser.id, '/me round-trip failed');

  // Heartbeat keep-alive (GET /session/ping): 401 without a cookie,
  // 200 + ok + fresh expiry with one
  const ping401 = await request(`${API}/session/ping`);
  assert(ping401.status === 401, `expected 401 on /session/ping without cookie, got ${ping401.status}`);
  const pingRes = await request(`${API}/session/ping`, { headers: { cookie: anonSetCookie.split(';')[0] } });
  assert(
    pingRes.status === 200 && pingRes.body.status === 'ok' && typeof pingRes.body.expiresAt === 'string',
    `ping failed: ${pingRes.status} ${JSON.stringify(pingRes.body)}`,
  );

  // Register: 400 on weak password, then 201 with email + nickname
  const weak = await request(`${AUTH_BASE}/register`, {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify({ email: EMAIL, nickname: NICKNAME, password: 'short' }),
  });
  assert(weak.status === 400, `expected 400 on weak password, got ${weak.status}`);

  // 400 when the password lacks a required character class (OWASP policy)
  const noSpecial = await request(`${AUTH_BASE}/register`, {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify({ email: EMAIL, nickname: NICKNAME, password: 'Cipher2026' }),
  });
  assert(noSpecial.status === 400, `expected 400 on password without special char, got ${noSpecial.status}`);

  // 400 on unsafe nickname characters
  const badNick = await request(`${AUTH_BASE}/register`, {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify({ email: EMAIL, nickname: 'bad nick!', password: 'Cipher!2026' }),
  });
  assert(badNick.status === 400, `expected 400 on unsafe nickname, got ${badNick.status}`);

  const reg = await request(`${AUTH_BASE}/register`, {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify({ email: ` SMOKE_${RUN_ID.toUpperCase()}@Example.COM `, nickname: NICKNAME, password: 'Cipher!2026' }),
  });
  assert(reg.status === 201, `expected 201 on register, got ${reg.status}: ${JSON.stringify(reg.body)}`);
  const regUser = (reg.body.user ?? {}) as Record<string, unknown>;
  assert(
    regUser.email === EMAIL && regUser.provider === 'local' && regUser.nickname === NICKNAME,
    'registered user shape wrong',
  );
  const regCookie = reg.headers.get('set-cookie')?.split(';')[0] ?? '';

  // Duplicate email -> 409
  const dup = await request(`${AUTH_BASE}/register`, {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify({ email: EMAIL, nickname: `other_${RUN_ID}`, password: 'Cipher!2026' }),
  });
  assert(dup.status === 409, `expected 409 on duplicate email, got ${dup.status}`);

  // Duplicate nickname -> 409
  const dupNick = await request(`${AUTH_BASE}/register`, {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify({ email: `other_${RUN_ID}@example.com`, nickname: NICKNAME, password: 'Cipher!2026' }),
  });
  assert(dupNick.status === 409, `expected 409 on duplicate nickname, got ${dupNick.status}`);

  // Forgot-password: identical 202 for known and unknown emails (no
  // enumeration oracle); the letter itself lands in the server console
  // because SMTP is not configured locally.
  const forgotKnown = await request(`${AUTH_BASE}/forgot-password`, {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify({ email: EMAIL }),
  });
  const forgotUnknown = await request(`${AUTH_BASE}/forgot-password`, {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify({ email: `ghost_${RUN_ID}@example.com` }),
  });
  assert(forgotKnown.status === 202, `expected 202 on forgot (known), got ${forgotKnown.status}`);
  assert(forgotUnknown.status === 202, `expected 202 on forgot (unknown), got ${forgotUnknown.status}`);
  assert(JSON.stringify(forgotKnown.body) === JSON.stringify(forgotUnknown.body), 'forgot responses differ (enumeration)');

  // Reset with a garbage token -> generic 400, never account details
  const badReset = await request(`${AUTH_BASE}/reset-password`, {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify({ token: 'A'.repeat(43), password: 'Cipher!2026' }),
  });
  assert(badReset.status === 400, `expected 400 on garbage reset token, got ${badReset.status}`);

  // Login: wrong password -> 401; correct -> 200 with a rotated session id
  const badLogin = await request(`${AUTH_BASE}/login`, {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify({ email: EMAIL, password: 'wrong-password' }),
  });
  assert(badLogin.status === 401, `expected 401 on bad login, got ${badLogin.status}`);

  const goodLogin = await request(`${AUTH_BASE}/login`, {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify({ email: EMAIL, password: 'Cipher!2026' }),
  });
  assert(goodLogin.status === 200, `expected 200 on login, got ${goodLogin.status}: ${JSON.stringify(goodLogin.body)}`);
  const loginCookie = goodLogin.headers.get('set-cookie')?.split(';')[0] ?? '';
  assert(loginCookie !== '' && loginCookie !== regCookie, 'login did not rotate the session id');

  // Rotated id kills the previous cookie
  const stale = await request(`${AUTH_BASE}/me`, { headers: { cookie: regCookie } });
  assert(stale.status === 401, `expected 401 for pre-rotation cookie, got ${stale.status}`);

  // Logout revokes the session (Option A server-side revocation)
  const logoutRes = await request(`${AUTH_BASE}/logout`, { method: 'POST', headers: { cookie: loginCookie } });
  assert(logoutRes.status === 204, `expected 204 on logout, got ${logoutRes.status}`);
  const afterLogout = await request(`${AUTH_BASE}/me`, { headers: { cookie: loginCookie } });
  assert(afterLogout.status === 401, `expected 401 after logout, got ${afterLogout.status}`);

  // ---------------------------------------------------------------------
  // Game flow on a fresh anonymous session
  // ---------------------------------------------------------------------

  const anon2 = await request(`${AUTH_BASE}/anonymous`, { method: 'POST', headers: JSON_HEADERS });
  assert(anon2.status === 201, `expected 201 on second anonymous, got ${anon2.status}`);
  const headers = { ...JSON_HEADERS, cookie: anon2.headers.get('set-cookie')?.split(';')[0] ?? '' };
  const cleanupUserId = (anon2.body.user as Record<string, unknown>).id as string;

  // 401 without a cookie
  const unauthorizedRes = await request(`${GAME_BASE}/sessions`, {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify({ module: 'CAESAR', difficulty: 'EASY', language: 'uk' }),
  });
  assert(unauthorizedRes.status === 401, `expected 401 without cookie, got ${unauthorizedRes.status}`);

  // 400 on invalid payload
  const badPayload = await request(`${GAME_BASE}/sessions`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ module: 'CAESAR', difficulty: 'EASY', language: 'fr' }),
  });
  assert(badPayload.status === 400, `expected 400 on bad language, got ${badPayload.status}`);

  // Module metadata (SDD §4: GET /game/modules)
  const modulesRes = await request(`${GAME_BASE}/modules`, { headers });
  assert(modulesRes.status === 200, `expected 200 on /game/modules, got ${modulesRes.status}`);
  const modules = (modulesRes.body.modules ?? []) as Record<string, unknown>[];
  assert(modules.length === 5, `expected 5 modules, got ${modules.length}`);
  assert(
    modules.every((m) => typeof m.id === 'string' && typeof m.slug === 'string' && Array.isArray(m.difficulties)),
    'module metadata shape wrong',
  );

  // Resume lookup (SDD §4: GET /game/sessions/:id)
  const missingRes = await request(`${GAME_BASE}/sessions/nonexistent`, { headers });
  assert(missingRes.status === 400, `expected 400 on malformed session id, got ${missingRes.status}`);

  // Create a session: ciphertext present, secrets absent
  const created = await request(`${GAME_BASE}/sessions`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ module: 'CAESAR', difficulty: 'EASY', language: 'uk' }),
  });
  assert(created.status === 201, `expected 201, got ${created.status}`);
  const sessionId = created.body.id as string;
  assert(
    typeof created.body.ciphertext === 'string' && created.body.ciphertext.length > 0,
    'ciphertext missing',
  );
  assert(!('plaintextHash' in created.body) && !('cipherParams' in created.body), 'secrets leaked in create response');

  // Wrong-attempt + hint checks happen on a session we will solve via
  // brute-force. EASY Caesar = shift 1..3, so the solve takes at most 3
  // attempts — and EASY sessions never lock out anyway.

  // Request the first hint
  const hint = await request(`${GAME_BASE}/sessions/${sessionId}/hints`, {
    method: 'POST',
    headers,
    body: JSON.stringify({}),
  });
  assert(
    hint.status === 200 && typeof hint.body.hint === 'string' && hint.body.hintsUsed === 1,
    'hint failed',
  );

  // Correct answer: brute-force the Caesar shift locally via the API.
  const alphabet = 'абвгґдеєжзиіїйклмнопрстуфхцчшщьюя';
  const ciphertext = created.body.ciphertext as string;
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
    const res = await request(`${GAME_BASE}/sessions/${sessionId}/attempts`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ answer: plaintext }),
    });
    attemptLog.push(`shift=${shift} status=${res.status} body=${JSON.stringify(res.body)}`);
    if (res.body.correct === true) {
      solved = res.body;
      break;
    }
  }
  assert(solved !== null, `correct answer was not accepted. attempts:\n${attemptLog.join('\n')}`);
  assert('score' in solved === false, 'score must be gone (leaderboards rank on solve time)');
  assert(typeof solved.plaintext === 'string' && solved.plaintext.length > 0, 'plaintext missing on solve');
  assert(typeof solved.attempts === 'number' && typeof solved.hintsUsed === 'number', 'solve counters missing');

  // Session is now SOLVED; attempts are rejected
  const afterSolve = await request(`${GAME_BASE}/sessions/${sessionId}/attempts`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ answer: 'whatever' }),
  });
  assert(afterSolve.status === 409, `expected 409 on solved session, got ${afterSolve.status}`);

  // EASY: no lockout at all — every wrong attempt passes with lockedUntil null
  const easyRes = await request(`${GAME_BASE}/sessions`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ module: 'CAESAR', difficulty: 'EASY', language: 'uk' }),
  });
  assert(easyRes.status === 201, `expected 201 on EASY session, got ${easyRes.status}`);
  let easyLastWrong: Record<string, unknown> | null = null;
  for (let i = 0; i < 4; i++) {
    const wrongRes = await request(`${GAME_BASE}/sessions/${easyRes.body.id}/attempts`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ answer: 'zzz' }),
    });
    assert(
      wrongRes.status === 200,
      `EASY attempt ${i + 1} should pass: got ${wrongRes.status} ${JSON.stringify(wrongRes.body)}`,
    );
    easyLastWrong = wrongRes.body;
  }
  assert(easyLastWrong?.lockedUntil === null, 'EASY sessions must never lock out');

  // MEDIUM: lockout after 10 consecutive failures — the 11th attempt is 423
  const medRes = await request(`${GAME_BASE}/sessions`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ module: 'CAESAR', difficulty: 'MEDIUM', language: 'uk' }),
  });
  assert(medRes.status === 201, `expected 201 on MEDIUM session, got ${medRes.status}`);
  for (let i = 0; i < 10; i++) {
    await request(`${GAME_BASE}/sessions/${medRes.body.id}/attempts`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ answer: 'zzz' }),
    });
  }
  const lockedRes = await request(`${GAME_BASE}/sessions/${medRes.body.id}/attempts`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ answer: 'zzz' }),
  });
  assert(lockedRes.status === 423, `expected 423 lockout after 10 failures, got ${lockedRes.status}`);

  // Abandon the locked session
  const abandonRes = await request(`${GAME_BASE}/sessions/${medRes.body.id}/abandon`, { method: 'POST', headers });
  assert(abandonRes.status === 200 && abandonRes.body.status === 'FAILED', 'abandon failed');

  // ---------------------------------------------------------------------
  // FREQUENCY hints: reveal a substitution, target wrong player guesses
  // ---------------------------------------------------------------------

  const freqRes = await request(`${GAME_BASE}/sessions`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ module: 'FREQUENCY', difficulty: 'EASY', language: 'uk' }),
  });
  assert(freqRes.status === 201, `expected 201 on FREQUENCY session, got ${freqRes.status}`);
  const freqSession = freqRes.body;
  const freqText = freqSession.ciphertext as string;
  const ukAlphabet = 'абвгґдеєжзиіїйклмнопрстуфхцчшщьюя';
  const firstLetter = [...freqText].find((ch) => ukAlphabet.includes(ch)) ?? 'а';
  const wrongPlain = ukAlphabet[0] === firstLetter ? ukAlphabet[1] : ukAlphabet[0];

  // Hint 1: with a deliberately wrong guess, the server must correct it
  const freqHint = await request(`${GAME_BASE}/sessions/${freqSession.id}/hints`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ substitution: { [firstLetter]: wrongPlain } }),
  });
  assert(
    freqHint.status === 200 && typeof freqHint.body.hint === 'string' && freqHint.body.hint.includes('відповідає'),
    `FREQUENCY hint failed: ${freqHint.status} ${JSON.stringify(freqHint.body)}`,
  );
  assert(
    freqHint.body.hint.includes(firstLetter),
    `FREQUENCY hint should reveal the wrong letter ${firstLetter}, got: ${freqHint.body.hint}`,
  );

  // Hint 2 without guesses: reveals the most frequent ciphertext letter
  const freqHint2 = await request(`${GAME_BASE}/sessions/${freqSession.id}/hints`, {
    method: 'POST',
    headers,
    body: JSON.stringify({}),
  });
  assert(freqHint2.status === 200 && typeof freqHint2.body.hint === 'string', 'FREQUENCY hint 2 failed');

  const freqAbandon = await request(`${GAME_BASE}/sessions/${freqSession.id}/abandon`, { method: 'POST', headers });
  assert(freqAbandon.status === 200, 'FREQUENCY abandon failed');

  // ---------------------------------------------------------------------
  // VIGENERE: word structure kept + Kasiski-style key-length hint
  // ---------------------------------------------------------------------

  const vigRes = await request(`${GAME_BASE}/sessions`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ module: 'VIGENERE', difficulty: 'HARD', language: 'uk' }),
  });
  assert(vigRes.status === 201, `expected 201 on VIGENERE session, got ${vigRes.status}`);
  const vigSession = vigRes.body;
  const vigText = vigSession.ciphertext as string;
  assert(vigText.includes(' '), 'VIGENERE ciphertext must keep spaces between words');
  for (const ch of vigText) {
    assert(ukAlphabet.includes(ch) || ch === ' ', `VIGENERE ciphertext contains an unexpected char: ${ch}`);
  }
  assert(!('cipherParams' in vigSession), 'VIGENERE session leaked cipherParams');

  // HARD gives two hints for VIGENERE (the hardest mission): the key length
  // (the Kasiski goal) and the first key letter (the first key-fitting slider).
  const vigHint = await request(`${GAME_BASE}/sessions/${vigSession.id}/hints`, {
    method: 'POST',
    headers,
    body: JSON.stringify({}),
  });
  assert(
    vigHint.status === 200 && vigHint.body.hint.includes('Довжина ключа Віженера'),
    `VIGENERE hint 1 failed: ${vigHint.status} ${JSON.stringify(vigHint.body)}`,
  );
  assert(
    vigHint.body.maxHints === 2 || vigHint.body.hintsRemaining === 1,
    `VIGENERE hint budget should be 2, got: ${JSON.stringify(vigHint.body)}`,
  );

  const vigHint2 = await request(`${GAME_BASE}/sessions/${vigSession.id}/hints`, {
    method: 'POST',
    headers,
    body: JSON.stringify({}),
  });
  assert(
    vigHint2.status === 200 && vigHint2.body.hint.includes('Перша літера ключа'),
    `VIGENERE hint 2 failed: ${vigHint2.status} ${JSON.stringify(vigHint2.body)}`,
  );

  // The budget is spent: a third hint is rejected.
  const vigHint3 = await request(`${GAME_BASE}/sessions/${vigSession.id}/hints`, {
    method: 'POST',
    headers,
    body: JSON.stringify({}),
  });
  assert(vigHint3.status === 409, `expected 409 on exhausted VIGENERE hints, got ${vigHint3.status}`);

  const vigAbandon = await request(`${GAME_BASE}/sessions/${vigSession.id}/abandon`, { method: 'POST', headers });
  assert(vigAbandon.status === 200, 'VIGENERE abandon failed');

  // Cleanup: GameSession FK is ON DELETE RESTRICT, so remove game rows
  // first; the Session rows cascade with their users.
  await prisma.gameSession.deleteMany({ where: { userId: cleanupUserId } });
  await prisma.user.delete({ where: { id: cleanupUserId } });
  await prisma.user.delete({ where: { email: EMAIL } });

  console.log('SMOKE OK: auth (anonymous/register/login/me/logout) + session ping + game (modules -> create -> hints -> solve -> guards -> EASY no-lockout -> MEDIUM lockout -> abandon -> frequency hints -> vigenere spaces + 2-tier hints)');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
