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
    encoder.encode(password),
    "PBKDF2",
    false,
    ["deriveBits", "deriveKey"]
  );

  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt,
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

/**
 * Encrypt data using AES-256-GCM.
 * 
 * @param key - The encryption key
 * @param plaintext - Data to encrypt (string or Uint8Array)
 * @param aad - Additional Authenticated Data (optional but recommended)
 * @returns Object containing iv, ciphertext, and tag (combined in ciphertext)
 */
export async function encrypt(
  key: CryptoKey,
  plaintext: string | Uint8Array,
  aad?: Uint8Array
): Promise<{ iv: Uint8Array; ciphertext: Uint8Array }> {
  const iv = generateIV();
  const encoder = new TextEncoder();
  const data = typeof plaintext === "string" ? encoder.encode(plaintext) : plaintext;

  const ciphertext = await crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv,
      additionalData: aad,
    },
    key,
    data
  );

  return {
    iv,
    ciphertext: new Uint8Array(ciphertext),
  };
}

/**
 * Decrypt data encrypted with AES-256-GCM.
 * 
 * @param key - The decryption key
 * @param iv - Initialization vector used for encryption
 * @param ciphertext - Encrypted data
 * @param aad - Additional Authenticated Data (must match encryption)
 * @returns Decrypted plaintext as Uint8Array
 */
export async function decrypt(
  key: CryptoKey,
  iv: Uint8Array,
  ciphertext: Uint8Array,
  aad?: Uint8Array
): Promise<Uint8Array> {
  const plaintext = await crypto.subtle.decrypt(
    {
      name: "AES-GCM",
      iv,
      additionalData: aad,
    },
    key,
    ciphertext
  );

  return new Uint8Array(plaintext);
}

/**
 * Decrypt and return as string (UTF-8).
 */
export async function decryptToString(
  key: CryptoKey,
  iv: Uint8Array,
  ciphertext: Uint8Array,
  aad?: Uint8Array
): Promise<string> {
  const plaintext = await decrypt(key, iv, ciphertext, aad);
  const decoder = new TextDecoder();
  return decoder.decode(plaintext);
}

/**
 * Wrap (encrypt) a key using another key.
 * Used for envelope encryption: MasterKey wraps VaultKey, VaultKey wraps ItemKey.
 */
export async function wrapKey(
  keyToWrap: CryptoKey,
  wrappingKey: CryptoKey
): Promise<{ iv: Uint8Array; wrappedKey: Uint8Array }> {
  const iv = generateIV();
  const wrappedKey = await crypto.subtle.wrapKey(
    "raw",
    keyToWrap,
    wrappingKey,
    { name: "AES-GCM", iv }
  );

  return {
    iv,
    wrappedKey: new Uint8Array(wrappedKey),
  };
}

/**
 * Unwrap (decrypt) a key using another key.
 */
export async function unwrapKey(
  wrappedKey: Uint8Array,
  iv: Uint8Array,
  unwrappingKey: CryptoKey,
  extractable: boolean = true
): Promise<CryptoKey> {
  return crypto.subtle.unwrapKey(
    "raw",
    wrappedKey,
    unwrappingKey,
    { name: "AES-GCM", iv },
    { name: "AES-GCM", length: KEY_LENGTH },
    extractable,
    ["encrypt", "decrypt"]
  );
}

/**
 * Export a CryptoKey to raw bytes.
 */
export async function exportKey(key: CryptoKey): Promise<Uint8Array> {
  const exported = await crypto.subtle.exportKey("raw", key);
  return new Uint8Array(exported);
}

/**
 * Import raw bytes as a CryptoKey.
 */
export async function importKey(
  keyBytes: Uint8Array,
  extractable: boolean = true
): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    keyBytes,
    { name: "AES-GCM" },
    extractable,
    ["encrypt", "decrypt"]
  );
}

// ============================================================
// Encoding utilities
// ============================================================

/**
 * Encode bytes to base64 string.
 */
export function toBase64(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes));
}

/**
 * Decode base64 string to bytes.
 */
export function fromBase64(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Encode bytes to URL-safe base64 string.
 */
export function toBase64Url(bytes: Uint8Array): string {
  return toBase64(bytes).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

/**
 * Decode URL-safe base64 string to bytes.
 */
export function fromBase64Url(base64url: string): Uint8Array {
  let base64 = base64url.replace(/-/g, "+").replace(/_/g, "/");
  while (base64.length % 4) {
    base64 += "=";
  }
  return fromBase64(base64);
}

/**
 * Concatenate multiple Uint8Arrays.
 */
export function concatBytes(...arrays: Uint8Array[]): Uint8Array {
  const totalLength = arrays.reduce((sum, arr) => sum + arr.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const arr of arrays) {
    result.set(arr, offset);
    offset += arr.length;
  }
  return result;
}

// ============================================================
// High-level encryption helpers
// ============================================================

/**
 * Complete encryption flow: encrypt data and return as base64-encoded package.
 */
export async function encryptToPackage(
  key: CryptoKey,
  plaintext: string,
  aad?: Uint8Array
): Promise<{ encrypted: string; iv: string; aad?: string }> {
  const { iv, ciphertext } = await encrypt(key, plaintext, aad);
  return {
    encrypted: toBase64(ciphertext),
    iv: toBase64(iv),
    aad: aad ? toBase64(aad) : undefined,
  };
}

/**
 * Complete decryption flow: decode base64 package and decrypt.
 */
export async function decryptFromPackage(
  key: CryptoKey,
  encrypted: string,
  iv: string,
  aadBase64?: string
): Promise<string> {
  const aad = aadBase64 ? fromBase64(aadBase64) : undefined;
  return decryptToString(key, fromBase64(iv), fromBase64(encrypted), aad);
}
