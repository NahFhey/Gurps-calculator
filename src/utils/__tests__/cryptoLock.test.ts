import { describe, expect, it } from 'vitest';
import { encryptJSON, decryptJSON, validateGMLock, type GMLock } from '../cryptoLock';

const payload = {
  campaign: 'The Clockwork Citadel',
  party: [
    { name: 'Mira', points: 150, advantages: ['Combat Reflexes', 'Luck'] },
    { name: 'Tor', points: 125, advantages: ['Night Vision'] },
  ],
  notes: { session: 4, complete: false },
};

function expectInvalid(
  result: ReturnType<typeof validateGMLock>,
  expectedError: RegExp
): void {
  expect(result.valid).toBe(false);
  if (result.valid) {
    throw new Error('Expected gmLock validation to fail');
  }
  expect(result.error).toMatch(expectedError);
}

describe('encryptJSON', () => {
  it('encrypts a payload with the expected metadata and decrypts it', async () => {
    const lock = await encryptJSON(payload, 'correct horse battery staple');

    expect(lock).toMatchObject({
      kdf: 'PBKDF2',
      hash: 'SHA-256',
      cipher: 'AES-GCM',
    });
    expect(lock.iterations).toBeTypeOf('number');
    expect(lock.iterations).toBeGreaterThanOrEqual(1);
    expect(lock.salt).toMatch(/^[A-Za-z0-9+/]+={0,2}$/);
    expect(lock.iv).toMatch(/^[A-Za-z0-9+/]+={0,2}$/);
    expect(lock.ciphertext).toMatch(/^[A-Za-z0-9+/]+={0,2}$/);

    await expect(decryptJSON(lock, 'correct horse battery staple')).resolves.toEqual(payload);
  });

  it('uses fresh salt and IV values for every encryption', async () => {
    const password = 'same-password';
    const first = await encryptJSON(payload, password, { iterations: 1000 });
    const second = await encryptJSON(payload, password, { iterations: 1000 });

    expect(first.salt).not.toBe(second.salt);
    expect(first.iv).not.toBe(second.iv);
    expect(first.ciphertext).not.toBe(second.ciphertext);
    await expect(decryptJSON(first, password)).resolves.toEqual(payload);
    await expect(decryptJSON(second, password)).resolves.toEqual(payload);
  });

  it('honors a custom PBKDF2 iteration count', async () => {
    const lock = await encryptJSON(payload, 'fast-test-password', { iterations: 1000 });

    expect(lock.iterations).toBe(1000);
    await expect(decryptJSON(lock, 'fast-test-password')).resolves.toEqual(payload);
  });
});

describe('decryptJSON', () => {
  it('rejects a wrong password with a useful error', async () => {
    const lock = await encryptJSON(payload, 'right-password', { iterations: 1000 });

    await expect(decryptJSON(lock, 'wrong-password')).rejects.toThrow(
      'Decryption failed - wrong password or corrupted data'
    );
  });

  it('rejects authenticated ciphertext that has been corrupted', async () => {
    const lock = await encryptJSON(payload, 'password', { iterations: 1000 });
    const replacement = lock.ciphertext.startsWith('A') ? 'B' : 'A';
    const corruptedLock: GMLock = {
      ...lock,
      ciphertext: `${replacement}${lock.ciphertext.slice(1)}`,
    };

    await expect(decryptJSON(corruptedLock, 'password')).rejects.toThrow(
      'Decryption failed - wrong password or corrupted data'
    );
  });

  it('rejects an unsupported lock format', async () => {
    const malformed = {
      kdf: 'scrypt',
      cipher: 'AES-GCM',
    } as unknown as GMLock;

    await expect(decryptJSON(malformed, 'password')).rejects.toThrow(
      'Invalid or unsupported gmLock format'
    );
  });
});

describe('validateGMLock', () => {
  it('accepts a lock produced by encryptJSON', async () => {
    const lock = await encryptJSON(payload, 'password', { iterations: 1000 });

    expect(validateGMLock(lock)).toEqual({ valid: true });
  });

  it.each([null, undefined, 'not-a-lock'])('rejects non-object input: %s', (value) => {
    expectInvalid(validateGMLock(value), /missing|not an object/i);
  });

  it('names a missing required field', async () => {
    const lock = await encryptJSON(payload, 'password', { iterations: 1000 });
    const missingSalt: Partial<GMLock> = { ...lock };
    delete missingSalt.salt;

    expectInvalid(validateGMLock(missingSalt), /salt/i);
  });

  it('rejects an unsupported KDF', async () => {
    const lock = await encryptJSON(payload, 'password', { iterations: 1000 });

    expectInvalid(validateGMLock({ ...lock, kdf: 'scrypt' }), /kdf/i);
  });

  it('rejects an unsupported cipher', async () => {
    const lock = await encryptJSON(payload, 'password', { iterations: 1000 });

    expectInvalid(validateGMLock({ ...lock, cipher: 'AES-CBC' }), /cipher/i);
  });

  it('rejects a non-numeric iteration count', async () => {
    const lock = await encryptJSON(payload, 'password', { iterations: 1000 });

    expectInvalid(validateGMLock({ ...lock, iterations: 'many' }), /iterations/i);
  });

  it('rejects an iteration count below one', async () => {
    const lock = await encryptJSON(payload, 'password', { iterations: 1000 });

    expectInvalid(validateGMLock({ ...lock, iterations: 0 }), /iterations/i);
  });
});
