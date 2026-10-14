import { describe, expect, it } from 'vitest';
import { sha256Hex } from '../src/lib/text.js';
import {
  CHIMERA_FORGED_JSON,
  CHIMERA_ORIGINAL_JSON,
  CHIMERA_PROXY_KEY,
  chimeraFullyDone,
  chimeraHmacSignature,
  chimeraPhaseOf,
  generateChimeraChallenge,
  parseChimeraParams,
  processChimeraAttempt,
} from '../src/services/ciphers/chimera.js';

describe('chimera challenge generation', () => {
  it('produces a sealed challenge whose hash covers the target JSON', () => {
    const challenge = generateChimeraChallenge();
    const params = parseChimeraParams(challenge.cipherParams);

    expect(challenge.plaintextHash).toBe(sha256Hex(params.targetJson));
    expect(challenge.context).toBeNull();
    expect(params.proxyKey).toBe(CHIMERA_PROXY_KEY);
    expect(params.hqPacket.pub_key).toMatch(/^0x[0-9A-F]{8}$/);
    expect(params.agentPacket.pub_key).toMatch(/^0x[0-9A-F]{8}$/);
    // The two public keys must differ — the player forges both of them.
    expect(params.agentPacket.pub_key).not.toBe(params.hqPacket.pub_key);
    // The intercepted routes of the key-exchange channel.
    expect(params.hqPacket).toEqual({ src: 'hq', dst: 'agent', pub_key: params.hqPacket.pub_key });
    expect(params.agentPacket).toEqual({
      src: 'agent',
      dst: 'hq',
      pub_key: params.agentPacket.pub_key,
    });
    // The real public keys must not equal the player's proxy key.
    expect(params.hqPacket.pub_key).not.toBe(params.proxyKey);
    expect(params.agentPacket.pub_key).not.toBe(params.proxyKey);
  });

  it('splits the ECB ciphertext into 16-byte blocks', () => {
    const challenge = generateChimeraChallenge();
    const params = parseChimeraParams(challenge.cipherParams);

    expect(challenge.ciphertext).toBe(params.aesBlocks.join(''));
    expect(params.aesBlocks.length).toBe(5);
    for (const block of params.aesBlocks) {
      expect(block).toMatch(/^[0-9a-f]{32}$/);
    }
    expect(params.originalJson).toBe(CHIMERA_ORIGINAL_JSON);
    expect(params.forgedJson).toBe(CHIMERA_FORGED_JSON);
    expect(params.targetJson).toBe(`${CHIMERA_FORGED_JSON.slice(0, -1)},{"jwt":"${params.jwtSecret}"}]`);
  });

  it('starts in phase 1 with the channel not yet seized', () => {
    const params = parseChimeraParams(generateChimeraChallenge().cipherParams);
    expect(chimeraPhaseOf(params)).toBe(1);
    expect(chimeraFullyDone(params)).toBe(false);
  });
});

describe('chimera phase 1 — inject_packets', () => {
  const fresh = () => parseChimeraParams(generateChimeraChallenge().cipherParams);

  /** Forge both packets: keep the route, swap in the proxy key. */
  const forgedPackets = (params: ReturnType<typeof fresh>, pubKey: (packet: string) => string) => ({
    hqPacket: {
      src: params.hqPacket.src,
      dst: params.hqPacket.dst,
      pub_key: pubKey(params.hqPacket.pub_key),
    },
    agentPacket: {
      src: params.agentPacket.src,
      dst: params.agentPacket.dst,
      pub_key: pubKey(params.agentPacket.pub_key),
    },
  });

  it('rejects packets that keep the original public keys', () => {
    const params = fresh();
    const result = processChimeraAttempt(params, {
      action: 'inject_packets',
      ...forgedPackets(params, (key) => key),
    });
    expect(result.correct).toBe(false);
    expect(chimeraPhaseOf(result.updatedParams)).toBe(1);
  });

  it('rejects packets whose route (src/dst) was altered', () => {
    const params = fresh();
    const result = processChimeraAttempt(params, {
      action: 'inject_packets',
      hqPacket: { src: 'hq', dst: 'hq', pub_key: params.proxyKey },
      agentPacket: { src: 'agent', dst: 'hq', pub_key: params.proxyKey },
    });
    expect(result.correct).toBe(false);
    expect(chimeraPhaseOf(result.updatedParams)).toBe(1);
  });

  it('rejects an injection that only forges one packet', () => {
    const params = fresh();
    const result = processChimeraAttempt(params, {
      action: 'inject_packets',
      hqPacket: { src: params.hqPacket.src, dst: params.hqPacket.dst, pub_key: params.proxyKey },
      agentPacket: {
        src: params.agentPacket.src,
        dst: params.agentPacket.dst,
        pub_key: params.agentPacket.pub_key,
      },
    });
    expect(result.correct).toBe(false);
    expect(result.updatedParams.mitmDone).toBe(false);
  });

  it('rejects a packet keyed with an arbitrary foreign key', () => {
    const params = fresh();
    const result = processChimeraAttempt(params, {
      action: 'inject_packets',
      ...forgedPackets(params, () => '0xCOFFEE'),
    });
    expect(result.correct).toBe(false);
    expect(chimeraPhaseOf(result.updatedParams)).toBe(1);
  });

  it('completes phase 1 and reveals the signing secret as the reward', () => {
    const params = fresh();
    const result = processChimeraAttempt(params, {
      action: 'inject_packets',
      ...forgedPackets(params, () => params.proxyKey),
    });
    expect(result.correct).toBe(true);
    expect(result.payload.secret).toBe(params.jwtSecret);
    expect(result.updatedParams.mitmDone).toBe(true);
    expect(chimeraPhaseOf(result.updatedParams)).toBe(2);
  });
});

describe('chimera phase 2 — swap_blocks', () => {
  const donePhase1 = () => {
    const params = parseChimeraParams(generateChimeraChallenge().cipherParams);
    return processChimeraAttempt(params, {
      action: 'inject_packets',
      hqPacket: { src: params.hqPacket.src, dst: params.hqPacket.dst, pub_key: params.proxyKey },
      agentPacket: { src: params.agentPacket.src, dst: params.agentPacket.dst, pub_key: params.proxyKey },
    }).updatedParams;
  };

  it('rejects swaps that do not produce the forged JSON', () => {
    const params = donePhase1();
    const result = processChimeraAttempt(params, {
      action: 'swap_blocks',
      from: 0,
      to: 1,
    });
    expect(result.correct).toBe(false);
    expect(result.updatedParams.phase2Done).toBe(false);
  });

  it('accepts the role-block substitution and reveals the forged JSON', () => {
    const params = donePhase1();
    const result = processChimeraAttempt(params, {
      action: 'swap_blocks',
      from: params.swapFrom,
      to: params.swapTo,
    });
    expect(result.correct).toBe(true);
    expect(result.payload.forgedJson).toBe(CHIMERA_FORGED_JSON);
    expect(result.updatedParams.phase2Done).toBe(true);
    expect(chimeraPhaseOf(result.updatedParams)).toBe(3);
  });
});

describe('chimera phase 3 — test_jwt', () => {
  const donePhase2 = () => {
    let params = parseChimeraParams(generateChimeraChallenge().cipherParams);
    params = processChimeraAttempt(params, {
      action: 'inject_packets',
      hqPacket: { src: params.hqPacket.src, dst: params.hqPacket.dst, pub_key: params.proxyKey },
      agentPacket: { src: params.agentPacket.src, dst: params.agentPacket.dst, pub_key: params.proxyKey },
    }).updatedParams;
    return processChimeraAttempt(params, {
      action: 'swap_blocks',
      from: params.swapFrom,
      to: params.swapTo,
    }).updatedParams;
  };

  /** Build a JWT exactly like the client generator does. */
  const buildToken = (header: string, payload: string, secret: string) => {
    const encode = (value: string) => Buffer.from(value, 'utf8').toString('base64url');
    const unsigned = `${encode(header)}.${encode(payload)}`;
    return `${unsigned}.${chimeraHmacSignature(secret, unsigned)}`;
  };

  it('rejects a token with a wrong signature', () => {
    const params = donePhase2();
    const good = buildToken('{"alg":"HS256","typ":"JWT"}', params.targetJson, params.jwtSecret);
    const wrongSig = `${good.slice(0, -2)}ff`;

    const result = processChimeraAttempt(params, { action: 'test_jwt', token: wrongSig });
    expect(result.correct).toBe(false);
    expect(result.updatedParams.phase3Done).toBe(false);
  });

  it('rejects a validly signed token whose payload is not the target JSON', () => {
    const params = donePhase2();
    const token = buildToken('{"alg":"HS256","typ":"JWT"}', params.forgedJson, params.jwtSecret);

    const result = processChimeraAttempt(params, { action: 'test_jwt', token });
    expect(result.correct).toBe(false);
    expect(result.updatedParams.phase3Done).toBe(false);
  });

  it('rejects a token signed with the wrong secret', () => {
    const params = donePhase2();
    const token = buildToken('{"alg":"HS256","typ":"JWT"}', params.targetJson, 'wrongsecret');

    const result = processChimeraAttempt(params, { action: 'test_jwt', token });
    expect(result.correct).toBe(false);
  });

  it('accepts the correctly signed token carrying the target JSON payload', () => {
    const params = donePhase2();
    const token = buildToken('{"alg":"HS256","typ":"JWT"}', params.targetJson, params.jwtSecret);

    const result = processChimeraAttempt(params, { action: 'test_jwt', token });
    expect(result.correct).toBe(true);
    expect(result.payload.secret).toBeUndefined();
    expect(result.updatedParams.phase3Done).toBe(true);
    expect(chimeraFullyDone(result.updatedParams)).toBe(true);
  });

  it('rejects malformed tokens', () => {
    const params = donePhase2();
    const result = processChimeraAttempt(params, { action: 'test_jwt', token: 'not-a-jwt' });
    expect(result.correct).toBe(false);
  });
});
