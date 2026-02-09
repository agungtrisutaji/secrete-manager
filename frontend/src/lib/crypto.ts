/**
 * Client-side cryptographic utilities for zero-knowledge encryption.
 * 
 * Uses WebCrypto API for:
 * - Key derivation (PBKDF2 with Argon2id recommended when available)
 * - Symmetric encryption (AES-256-GCM)
 * - Key wrapping/unwrapping
 * 
 * IMPORTANT: All secret data is encrypted client-side before transmission.
 * The server never receives plaintext secrets.
 */

// Constants
const PBKDF2_ITERATIONS = 600000; // OWASP recommendation for PBKDF2-SHA256
const SALT_LENGTH = 32;
const IV_LENGTH = 12; // 96 bits for AES-GCM
const KEY_LENGTH = 256; // AES-256

/**
 * Generate cryptographically secure random bytes.
 */
export function randomBytes(length: number): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(length));
}

/**
 * Generate a random salt for key derivation.
 */
export function generateSalt(): Uint8Array {
  return randomBytes(SALT_LENGTH);
}

/**
 * Generate a random IV for AES-GCM.
 */
export function generateIV(): Uint8Array {
  return randomBytes(IV_LENGTH);
}

/**
 * Derive a cryptographic key from a password using PBKDF2.
 * 
 * Note: Argon2id is preferred but not yet widely available in WebCrypto.
 * Consider using argon2-browser library for sensitive applications.
 */
export async function deriveKey(
  password: string,
  salt: Uint8Array,
  iterations: number = PBKDF2_ITERATIONS
): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password) as BufferSource,
    "PBKDF2",
    false,
    ["deriveBits", "deriveKey"]
  );

  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: salt as BufferSource,
      iterations,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: "AES-GCM", length: KEY_LENGTH },
    true, // extractable for export
    ["encrypt", "decrypt", "wrapKey", "unwrapKey"]
  );
}

/**
 * Generate a new random AES-256 key for vault or item encryption.
 */
export async function generateKey(): Promise<CryptoKey> {
  return crypto.subtle.generateKey(
    { name: "AES-GCM", length: KEY_LENGTH },
    true,
    ["encrypt", "decrypt"]
  );
}
