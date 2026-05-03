/**
 * @fileoverview Client-side encryption utilities for GM/Player data separation
 *
 * SECURITY DISCLAIMER: This is a "casual lock" to prevent accidental viewing
 * by players, NOT a strong security measure against technical users. The encryption
 * uses WebCrypto with PBKDF2 key derivation and AES-GCM, but client-side encryption
 * has inherent limitations. This prevents casual peeking, not determined adversaries.
 */

export interface GMLock {
  kdf: 'PBKDF2';
  hash: 'SHA-256';
  iterations: number;
  salt: string;
  iv: string;
  cipher: 'AES-GCM';
  ciphertext: string;
}

export interface EncryptOptions {
  iterations?: number;
}

export type ValidationResult = { valid: true } | { valid: false; error: string };

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

async function deriveKey(
  password: string,
  salt: Uint8Array,
  iterations: number = 210000
): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const passwordKey = await window.crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveBits', 'deriveKey']
  );

  return await window.crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt as BufferSource,
      iterations: iterations,
      hash: 'SHA-256',
    },
    passwordKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

export async function encryptJSON(
  payload: unknown,
  password: string,
  options: EncryptOptions = {}
): Promise<GMLock> {
  if (!window.crypto || !window.crypto.subtle) {
    throw new Error('WebCrypto API not available');
  }

  const iterations = options.iterations || 210000;

  const salt = window.crypto.getRandomValues(new Uint8Array(16));
  const iv = window.crypto.getRandomValues(new Uint8Array(12));

  const key = await deriveKey(password, salt, iterations);

  const encoder = new TextEncoder();
  const plaintext = encoder.encode(JSON.stringify(payload));
  const ciphertext = await window.crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv },
    key,
    plaintext
  );

  return {
    kdf: 'PBKDF2',
    hash: 'SHA-256',
    iterations: iterations,
    salt: arrayBufferToBase64(salt.buffer as ArrayBuffer),
    iv: arrayBufferToBase64(iv.buffer as ArrayBuffer),
    cipher: 'AES-GCM',
    ciphertext: arrayBufferToBase64(ciphertext),
  };
}

export async function decryptJSON(gmLock: GMLock, password: string): Promise<unknown> {
  if (!window.crypto || !window.crypto.subtle) {
    throw new Error('WebCrypto API not available');
  }

  if (!gmLock || gmLock.kdf !== 'PBKDF2' || gmLock.cipher !== 'AES-GCM') {
    throw new Error('Invalid or unsupported gmLock format');
  }

  try {
    const salt = new Uint8Array(base64ToArrayBuffer(gmLock.salt));
    const iv = new Uint8Array(base64ToArrayBuffer(gmLock.iv));
    const ciphertext = base64ToArrayBuffer(gmLock.ciphertext);

    const key = await deriveKey(password, salt, gmLock.iterations);

    const plaintext = await window.crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: iv },
      key,
      ciphertext
    );

    const decoder = new TextDecoder();
    const json = decoder.decode(plaintext);
    return JSON.parse(json);
  } catch (err) {
    const e = err as { name?: string; message?: string };
    if (e.name === 'OperationError' || (e.message && e.message.includes('decryption'))) {
      throw new Error('Decryption failed - wrong password or corrupted data');
    }
    throw err;
  }
}

export function validateGMLock(gmLock: unknown): ValidationResult {
  if (!gmLock || typeof gmLock !== 'object') {
    return { valid: false, error: 'gmLock is missing or not an object' };
  }

  const lock = gmLock as Record<string, unknown>;
  const required = ['kdf', 'hash', 'iterations', 'salt', 'iv', 'cipher', 'ciphertext'];
  for (const field of required) {
    if (!(field in lock)) {
      return { valid: false, error: `gmLock missing required field: ${field}` };
    }
  }

  if (lock.kdf !== 'PBKDF2') {
    return { valid: false, error: `Unsupported KDF: ${String(lock.kdf)}` };
  }

  if (lock.cipher !== 'AES-GCM') {
    return { valid: false, error: `Unsupported cipher: ${String(lock.cipher)}` };
  }

  if (typeof lock.iterations !== 'number' || lock.iterations < 1) {
    return { valid: false, error: 'Invalid iterations value' };
  }

  return { valid: true };
}
