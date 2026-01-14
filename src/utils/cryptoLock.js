/**
 * @fileoverview Client-side encryption utilities for GM/Player data separation
 *
 * SECURITY DISCLAIMER: This is a "casual lock" to prevent accidental viewing
 * by players, NOT a strong security measure against technical users. The encryption
 * uses WebCrypto with PBKDF2 key derivation and AES-GCM, but client-side encryption
 * has inherent limitations. This prevents casual peeking, not determined adversaries.
 *
 * Use cases:
 * - Hide GM-only content (hazards, secret notes) from players
 * - Prevent accidental spoilers when sharing files
 * - Add lightweight access control to exported data
 *
 * NOT suitable for:
 * - Protecting sensitive real-world data
 * - Security against technical users with browser dev tools
 * - Compliance with data protection regulations
 *
 * @module utils/cryptoLock
 */

/**
 * Converts ArrayBuffer to base64 string
 * @private
 * @param {ArrayBuffer} buffer - The buffer to encode
 * @returns {string} Base64-encoded string
 */
function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Converts base64 string to ArrayBuffer
 * @private
 * @param {string} base64 - Base64-encoded string
 * @returns {ArrayBuffer} Decoded buffer
 */
function base64ToArrayBuffer(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

/**
 * Derives an encryption key from a password using PBKDF2
 * @private
 * @param {string} password - User password
 * @param {Uint8Array} salt - Random salt (16 bytes recommended)
 * @param {number} iterations - PBKDF2 iteration count (default: 210000)
 * @returns {Promise<CryptoKey>} Derived AES-GCM key
 */
async function deriveKey(password, salt, iterations = 210000) {
  // Import password as key material
  const encoder = new TextEncoder();
  const passwordKey = await window.crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveBits', 'deriveKey']
  );

  // Derive AES-GCM key using PBKDF2
  return await window.crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt,
      iterations: iterations,
      hash: 'SHA-256'
    },
    passwordKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Encrypts a JSON payload using AES-GCM with password-based key derivation.
 * Returns a gmLock object suitable for embedding in exported JSON.
 *
 * @param {Object} payload - The GM data to encrypt (will be JSON-stringified)
 * @param {string} password - Password for encryption
 * @param {Object} [options={}] - Encryption options
 * @param {number} [options.iterations=210000] - PBKDF2 iterations (higher = slower but stronger)
 * @returns {Promise<Object>} gmLock object with encrypted data
 * @throws {Error} If WebCrypto is unavailable or encryption fails
 *
 * @example
 * const gmData = { hiddenHazards: [...], secretNotes: '...' };
 * const lock = await encryptJSON(gmData, 'my-password');
 * // lock = { kdf: 'PBKDF2', salt: '...', iv: '...', ciphertext: '...' }
 */
export async function encryptJSON(payload, password, options = {}) {
  if (!window.crypto || !window.crypto.subtle) {
    throw new Error('WebCrypto API not available');
  }

  const iterations = options.iterations || 210000;

  // Generate random salt and IV
  const salt = window.crypto.getRandomValues(new Uint8Array(16));
  const iv = window.crypto.getRandomValues(new Uint8Array(12)); // 12 bytes for AES-GCM

  // Derive key from password
  const key = await deriveKey(password, salt, iterations);

  // Encrypt payload
  const encoder = new TextEncoder();
  const plaintext = encoder.encode(JSON.stringify(payload));
  const ciphertext = await window.crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv },
    key,
    plaintext
  );

  // Return gmLock structure
  return {
    kdf: 'PBKDF2',
    hash: 'SHA-256',
    iterations: iterations,
    salt: arrayBufferToBase64(salt),
    iv: arrayBufferToBase64(iv),
    cipher: 'AES-GCM',
    ciphertext: arrayBufferToBase64(ciphertext)
  };
}

/**
 * Decrypts a gmLock object using the provided password.
 * Returns the original GM data payload.
 *
 * @param {Object} gmLock - The gmLock object from encrypted JSON
 * @param {string} gmLock.kdf - Key derivation function (must be 'PBKDF2')
 * @param {string} gmLock.hash - Hash algorithm (must be 'SHA-256')
 * @param {number} gmLock.iterations - PBKDF2 iteration count
 * @param {string} gmLock.salt - Base64-encoded salt
 * @param {string} gmLock.iv - Base64-encoded initialization vector
 * @param {string} gmLock.cipher - Cipher algorithm (must be 'AES-GCM')
 * @param {string} gmLock.ciphertext - Base64-encoded encrypted data
 * @param {string} password - Password for decryption
 * @returns {Promise<Object>} Decrypted GM data payload
 * @throws {Error} If password is incorrect, data is corrupted, or WebCrypto unavailable
 *
 * @example
 * try {
 *   const gmData = await decryptJSON(lock, 'my-password');
 *   console.log('GM data:', gmData);
 * } catch (err) {
 *   console.error('Decryption failed:', err.message);
 * }
 */
export async function decryptJSON(gmLock, password) {
  if (!window.crypto || !window.crypto.subtle) {
    throw new Error('WebCrypto API not available');
  }

  // Validate gmLock structure
  if (!gmLock || gmLock.kdf !== 'PBKDF2' || gmLock.cipher !== 'AES-GCM') {
    throw new Error('Invalid or unsupported gmLock format');
  }

  try {
    // Decode salt and IV
    const salt = new Uint8Array(base64ToArrayBuffer(gmLock.salt));
    const iv = new Uint8Array(base64ToArrayBuffer(gmLock.iv));
    const ciphertext = base64ToArrayBuffer(gmLock.ciphertext);

    // Derive key from password
    const key = await deriveKey(password, salt, gmLock.iterations);

    // Decrypt
    const plaintext = await window.crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: iv },
      key,
      ciphertext
    );

    // Decode and parse JSON
    const decoder = new TextDecoder();
    const json = decoder.decode(plaintext);
    return JSON.parse(json);
  } catch (err) {
    // Distinguish between wrong password and other errors
    if (err.name === 'OperationError' || err.message.includes('decryption')) {
      throw new Error('Decryption failed - wrong password or corrupted data');
    }
    throw err;
  }
}

/**
 * Validates that a gmLock object has the correct structure.
 * Does NOT test decryption, only checks format.
 *
 * @param {Object} gmLock - The gmLock object to validate
 * @returns {Object} Validation result
 * @returns {boolean} returns.valid - Whether the gmLock structure is valid
 * @returns {string} [returns.error] - Error message if invalid
 *
 * @example
 * const result = validateGMLock(data.gmLock);
 * if (!result.valid) {
 *   console.error('Invalid gmLock:', result.error);
 * }
 */
export function validateGMLock(gmLock) {
  if (!gmLock || typeof gmLock !== 'object') {
    return { valid: false, error: 'gmLock is missing or not an object' };
  }

  const required = ['kdf', 'hash', 'iterations', 'salt', 'iv', 'cipher', 'ciphertext'];
  for (const field of required) {
    if (!(field in gmLock)) {
      return { valid: false, error: `gmLock missing required field: ${field}` };
    }
  }

  if (gmLock.kdf !== 'PBKDF2') {
    return { valid: false, error: `Unsupported KDF: ${gmLock.kdf}` };
  }

  if (gmLock.cipher !== 'AES-GCM') {
    return { valid: false, error: `Unsupported cipher: ${gmLock.cipher}` };
  }

  if (typeof gmLock.iterations !== 'number' || gmLock.iterations < 1) {
    return { valid: false, error: 'Invalid iterations value' };
  }

  return { valid: true };
}
