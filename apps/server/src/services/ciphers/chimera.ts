import { createCipheriv, createDecipheriv, createHmac, randomBytes } from 'node:crypto';
import type { ChimeraAttemptInput, ChimeraPacket, ChimeraPhase } from '@shiftcrack/shared';
import { randomIntInRange, sha256Hex } from '../../lib/text.js';
import type { GeneratedChallenge } from '../phrase.service.js';

/**
 * Mission 05 — "Протокол Химера" (CHIMERA). A three-phase composite
 * challenge, unlike the classic cipher modules:
 *
 *  1. MitM / proxy injection: the player sniffs the key-exchange channel
 *     between the HQ and the AGENT, intercepts the two handshake packets
 *     carrying their public keys, and forges both of them — swapping the
 *     real `pub_key` for the player's own `proxyKey` while keeping `src`
 *     and `dst` intact. The channel is now routed through the player, and
 *     the decrypted packet hands over the JWT signing secret.
 *  2. AES-ECB: the intercepted record is a block-aligned JSON encrypted in
 *     ECB mode. Because identical plaintext blocks yield identical
 *     ciphertext blocks, the player substitutes the block carrying
 *     `"role":"user"` with the block carrying `"role":"admin"` to forge
 *     the clearance record.
 *  3. JWT lab: the player signs the forged record themselves — the JWT
 *     generator on the client builds `header.payload.signature` with the
 *     secret from phase 1; the server verifies the HMAC-SHA256 signature
 *     and checks that the payload equals the target JSON.
 *
 * The final `plaintextHash` covers the exact target JSON string assembled
 * from all three phases — the classic answer-report flow stays intact
 * (see game.service.submitAttempt).
 *
 * Security note: `cipherParams` here hold the AES key and JWT secret. They
 * are server-side only; the secret is projected to the client only once
 * phase 1 completes (the reward of the injection), same as the Caesar
 * shift / Vigenère key never leaves the session row. The intercepted
 * packets and the proxy key are the phase-1 challenge material and are
 * exposed as part of the public projection.
 */

// ---------------------------------------------------------------------------
// Challenge constants
// ---------------------------------------------------------------------------

const AES_BLOCK_SIZE = 16;

/**
 * The intercepted record, block-aligned to 16-byte ECB blocks. The two
 * `"role"` blocks share the identical `...,` trailer, so substituting the
 * AGENT role block with the HQ role block yields a syntactically valid
 * forged record — the classic ECB cut-and-paste premise.
 *
 *   B0  [{"id":"0137",   (14 + 2 padding spaces)
 *   B1  "role":"user"},   (15 + 1)
 *   B2  {"id":"0000",     (13 + 3)
 *   B3  "role":"admin"},  (16 exactly)
 *   B4  {"op":"hold"}]    (14 + 2)
 */
const BLOCK_RECORD_AGENT = '[{"id":"0137",' + '  ';
const BLOCK_ROLE_USER = '"role":"user"},' + ' ';
const BLOCK_RECORD_HQ = '{"id":"0000",' + '   ';
const BLOCK_ROLE_ADMIN = '"role":"admin"},';
const BLOCK_OP_CLOSE = '{"op":"hold"}]' + '  ';

/** Canonical (whitespace-stripped) JSON strings. */
export const CHIMERA_ORIGINAL_JSON =
  '[{"id":"0137","role":"user"},{"id":"0000","role":"admin"},{"op":"hold"}]';
export const CHIMERA_FORGED_JSON =
  '[{"id":"0137","role":"admin"},{"id":"0000","role":"admin"},{"op":"hold"}]';

/** Winning block substitution: replace block 1 (role=user) with block 3 (role=admin). */
const SWAP_FROM = 1;
const SWAP_TO = 3;

const JWT_SECRET_ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789';
const JWT_SECRET_LENGTH = 10;

/** The player's proxy key — the identity key injected into both packets. */
export const CHIMERA_PROXY_KEY = '0xDEADBEEF';

/** Route of the key-exchange channel (src/dst the injection must preserve). */
const HQ_SRC = 'hq';
const HQ_DST = 'agent';
const AGENT_SRC = 'agent';
const AGENT_DST = 'hq';

/** Random 32-bit public keys ("0x" + 8 hex chars) for HQ and the AGENT. */
const PUBKEY_HEX_LENGTH = 8;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ChimeraParams {
  /** The intercepted packets carrying the real public keys. */
  hqPacket: ChimeraPacket;
  agentPacket: ChimeraPacket;
  /** The player's proxy key to inject into both packets. */
  proxyKey: string;
  /** AES-128 key (hex) — server-side only. */
  aesKey: string;
  /** Hex of every 16-byte ECB block of the intercepted record. */
  aesBlocks: string[];
  originalJson: string;
  forgedJson: string;
  /** Final answer: the JSON assembled from all three phases. */
  targetJson: string;
  swapFrom: number;
  swapTo: number;
  /** JWT signing secret — revealed to the player once phase 1 completes. */
  jwtSecret: string;
  mitmDone: boolean;
  phase2Done: boolean;
  phase3Done: boolean;
}

export interface ChimeraActionResult {
  correct: boolean;
  updatedParams: ChimeraParams;
  payload: {
    forgedJson?: string;
    secret?: string;
  };
}

// ---------------------------------------------------------------------------
// Low-level helpers
// ---------------------------------------------------------------------------

function aesEcb(blocks: string[], keyHex: string, mode: 'encrypt' | 'decrypt'): string[] {
  const key = Buffer.from(keyHex, 'hex');
  if (key.length !== 16) throw new Error('CHIMERA AES key must be 16 bytes');
  return blocks.map((hex) => {
    const block = Buffer.from(hex, 'hex');
    if (block.length !== AES_BLOCK_SIZE) throw new Error('CHIMERA AES block must be 16 bytes');
    const cipher =
      mode === 'encrypt'
        ? createCipheriv('aes-128-ecb', key, null)
        : createDecipheriv('aes-128-ecb', key, null);
    cipher.setAutoPadding(false);
    return Buffer.concat([cipher.update(block), cipher.final()]).toString('hex');
  });
}

/**
 * Full HMAC-SHA256 hex signature of `<header>.<payload>` — the server-side
 * reference the player's locally generated JWT must reproduce.
 */
export function chimeraHmacSignature(secret: string, unsigned: string): string {
  return createHmac('sha256', secret).update(unsigned).digest('hex');
}

/** Base64url → UTF-8 (tolerant of missing padding, as JWTs usually omit it). */
function decodeBase64url(value: string): string {
  return Buffer.from(value.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
}

/**
 * Decrypt a block sequence and strip every padding space: block alignment
 * is achieved with ASCII spaces, which are JSON whitespace — removing them
 * recovers the canonical compact JSON.
 */
function decryptBlockJson(params: ChimeraParams, blocks: string[]): string {
  return aesEcb(blocks, params.aesKey, 'decrypt')
    .map((hex) => Buffer.from(hex, 'hex').toString('utf8'))
    .join('')
    .replace(/ /g, '');
}

function isPacket(value: unknown): value is ChimeraPacket {
  if (typeof value !== 'object' || value === null) return false;
  const packet = value as Record<string, unknown>;
  return (
    typeof packet.src === 'string' &&
    typeof packet.dst === 'string' &&
    typeof packet.pub_key === 'string'
  );
}

/** Random "0x" + 8-char uppercase hex public key. */
function randomPubKey(): string {
  return `0x${randomBytes(PUBKEY_HEX_LENGTH / 2).toString('hex').toUpperCase()}`;
}

// ---------------------------------------------------------------------------
// Params parsing / progress helpers
// ---------------------------------------------------------------------------

/**
 * Defensive parse of the JSON column. The shape is written only by
 * generateChimeraChallenge below; anything unexpected means a corrupt
 * session row and fails loudly rather than silently mis-grading.
 */
export function parseChimeraParams(raw: unknown): ChimeraParams {
  const params = raw as Partial<ChimeraParams> | null | undefined;
  if (
    !params ||
    !isPacket(params.hqPacket) ||
    !isPacket(params.agentPacket) ||
    typeof params.proxyKey !== 'string' ||
    typeof params.aesKey !== 'string' ||
    !Array.isArray(params.aesBlocks) ||
    params.aesBlocks.length === 0 ||
    !params.aesBlocks.every((block) => typeof block === 'string') ||
    typeof params.originalJson !== 'string' ||
    typeof params.forgedJson !== 'string' ||
    typeof params.targetJson !== 'string' ||
    typeof params.swapFrom !== 'number' ||
    typeof params.swapTo !== 'number' ||
    typeof params.jwtSecret !== 'string'
  ) {
    throw new Error('Corrupt CHIMERA session parameters');
  }
  return {
    hqPacket: params.hqPacket,
    agentPacket: params.agentPacket,
    proxyKey: params.proxyKey,
    aesKey: params.aesKey,
    aesBlocks: params.aesBlocks,
    originalJson: params.originalJson,
    forgedJson: params.forgedJson,
    targetJson: params.targetJson,
    swapFrom: params.swapFrom,
    swapTo: params.swapTo,
    jwtSecret: params.jwtSecret,
    mitmDone: params.mitmDone === true,
    phase2Done: params.phase2Done === true,
    phase3Done: params.phase3Done === true,
  };
}

/** The mission phase the session is currently in. */
export function chimeraPhaseOf(params: ChimeraParams): ChimeraPhase {
  if (!params.mitmDone) return 1;
  if (!params.phase2Done) return 2;
  return 3;
}

/** Phase 1 completion gate (the proxy injection seized the channel). */
export function chimeraPhase1Done(params: ChimeraParams): boolean {
  return params.mitmDone;
}

/** All three phases complete — the final report may be submitted. */
export function chimeraFullyDone(params: ChimeraParams): boolean {
  return chimeraPhase1Done(params) && params.phase2Done && params.phase3Done;
}

// ---------------------------------------------------------------------------
// Challenge generation
// ---------------------------------------------------------------------------

/**
 * Rolls the full CHIMERA challenge: the two intercepted key-exchange
 * packets, the ECB record with its winning block substitution, the JWT
 * material and the final target JSON. The returned plaintext (the target
 * JSON) is only hashed and never persisted — same plaintext isolation as
 * the classic modules.
 */
export function generateChimeraChallenge(): GeneratedChallenge {
  const hqPubKey = randomPubKey();
  let agentPubKey = randomPubKey();
  while (agentPubKey === hqPubKey) agentPubKey = randomPubKey();

  const hqPacket: ChimeraPacket = { src: HQ_SRC, dst: HQ_DST, pub_key: hqPubKey };
  const agentPacket: ChimeraPacket = { src: AGENT_SRC, dst: AGENT_DST, pub_key: agentPubKey };

  const aesKey = randomBytes(AES_BLOCK_SIZE).toString('hex');
  const plaintextBlocks = [BLOCK_RECORD_AGENT, BLOCK_ROLE_USER, BLOCK_RECORD_HQ, BLOCK_ROLE_ADMIN, BLOCK_OP_CLOSE];
  const aesBlocks = aesEcb(
    plaintextBlocks.map((block) => Buffer.from(block, 'utf8').toString('hex')),
    aesKey,
    'encrypt',
  );

  let jwtSecret = '';
  for (let i = 0; i < JWT_SECRET_LENGTH; i++) {
    jwtSecret += JWT_SECRET_ALPHABET[randomIntInRange(0, JWT_SECRET_ALPHABET.length - 1)];
  }
  const targetJson = `${CHIMERA_FORGED_JSON.slice(0, -1)},{"jwt":"${jwtSecret}"}]`;

  const params: ChimeraParams = {
    hqPacket,
    agentPacket,
    proxyKey: CHIMERA_PROXY_KEY,
    aesKey,
    aesBlocks,
    originalJson: CHIMERA_ORIGINAL_JSON,
    forgedJson: CHIMERA_FORGED_JSON,
    targetJson,
    swapFrom: SWAP_FROM,
    swapTo: SWAP_TO,
    jwtSecret,
    mitmDone: false,
    phase2Done: false,
    phase3Done: false,
  };

  return {
    plaintext: targetJson,
    plaintextHash: sha256Hex(targetJson),
    ciphertext: aesBlocks.join(''),
    cipherParams: params as unknown as Record<string, unknown>,
    context: null,
  };
}

// ---------------------------------------------------------------------------
// Attempt processing
// ---------------------------------------------------------------------------

/**
 * Pure per-action processing: verifies the attempt against the sealed
 * params and returns the updated params (phase progress) plus any
 * per-action payload. The caller (game.service) persists the params and
 * applies attempt bookkeeping; phase gates are also enforced by the caller.
 */
export function processChimeraAttempt(
  params: ChimeraParams,
  input: ChimeraAttemptInput,
): ChimeraActionResult {
  switch (input.action) {
    case 'inject_packets': {
      // Both forged packets must keep their original route (src/dst) and
      // carry the player's proxy key instead of the real public key.
      const hqValid =
        input.hqPacket.src === params.hqPacket.src &&
        input.hqPacket.dst === params.hqPacket.dst &&
        input.hqPacket.pub_key === params.proxyKey;
      const agentValid =
        input.agentPacket.src === params.agentPacket.src &&
        input.agentPacket.dst === params.agentPacket.dst &&
        input.agentPacket.pub_key === params.proxyKey;
      if (!hqValid || !agentValid) {
        return { correct: false, updatedParams: params, payload: {} };
      }
      const updatedParams: ChimeraParams = { ...params, mitmDone: true };
      // Phase 1 reward: the channel is routed through the proxy, and the
      // decrypted packet hands the player the JWT signing secret for the
      // phase-3 generator.
      return { correct: true, updatedParams, payload: { secret: params.jwtSecret } };
    }

    case 'swap_blocks': {
      const { from, to } = input;
      const blocks = params.aesBlocks;
      const inRange =
        from >= 0 && to >= 0 && from < blocks.length && to < blocks.length && from !== to;
      if (!inRange) return { correct: false, updatedParams: params, payload: {} };
      const modified = blocks.map((hex, index) => (index === from ? blocks[to]! : hex));
      if (decryptBlockJson(params, modified) !== params.forgedJson) {
        return { correct: false, updatedParams: params, payload: {} };
      }
      const updatedParams: ChimeraParams = { ...params, phase2Done: true };
      return { correct: true, updatedParams, payload: { forgedJson: params.forgedJson } };
    }

    case 'test_jwt': {
      // The client signs `header.payload` locally; the server verifies the
      // HMAC-SHA256 signature against the session secret and requires the
      // decoded payload to be exactly the target JSON.
      const parts = input.token.split('.');
      if (parts.length !== 3) {
        return { correct: false, updatedParams: params, payload: {} };
      }
      const unsigned = `${parts[0]}.${parts[1]}`;
      const signature = parts[2]!;
      const expected = chimeraHmacSignature(params.jwtSecret, unsigned);
      if (signature.length !== expected.length || signature.toLowerCase() !== expected.toLowerCase()) {
        return { correct: false, updatedParams: params, payload: {} };
      }
      if (decodeBase64url(parts[1]!) !== params.targetJson) {
        return { correct: false, updatedParams: params, payload: {} };
      }
      const updatedParams: ChimeraParams = { ...params, phase3Done: true };
      return { correct: true, updatedParams, payload: {} };
    }
  }
}
