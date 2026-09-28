import type { EncryptedPayload, EncryptionProvider } from './interfaces';

export const PBKDF2_ITERATIONS = 310_000;

export function bytesToBase64(bytes: Uint8Array): string {
  let s = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) s += String.fromCharCode(...bytes.subarray(i, i + chunk));
  return btoa(s);
}

export function base64ToBytes(b64: string): Uint8Array<ArrayBuffer> {
  const s = atob(b64);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

const enc = new TextEncoder();
const dec = new TextDecoder();

async function baseKey(passphrase: string) {
  return crypto.subtle.importKey('raw', enc.encode(passphrase), 'PBKDF2', false, ['deriveKey', 'deriveBits']);
}

/** Web Crypto implementation: PBKDF2-SHA256 → AES-256-GCM. */
export const webCrypto: EncryptionProvider = {
  randomSalt() {
    return crypto.getRandomValues(new Uint8Array(16));
  },
  async deriveKey(passphrase, salt, iterations = PBKDF2_ITERATIONS) {
    return crypto.subtle.deriveKey(
      { name: 'PBKDF2', hash: 'SHA-256', salt: salt as Uint8Array<ArrayBuffer>, iterations },
      await baseKey(passphrase),
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt'],
    );
  },
  async encrypt(data, key): Promise<EncryptedPayload> {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(data));
    return { ivBase64: bytesToBase64(iv), ciphertextBase64: bytesToBase64(new Uint8Array(ct)) };
  },
  async decrypt(payload, key) {
    const pt = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: base64ToBytes(payload.ivBase64) },
      key,
      base64ToBytes(payload.ciphertextBase64),
    );
    return dec.decode(pt);
  },
  async sha256Hex(data) {
    const h = await crypto.subtle.digest('SHA-256', enc.encode(data));
    return [...new Uint8Array(h)].map((b) => b.toString(16).padStart(2, '0')).join('');
  },
  async hashSecret(secret, salt, iterations = PBKDF2_ITERATIONS) {
    const bits = await crypto.subtle.deriveBits(
      { name: 'PBKDF2', hash: 'SHA-256', salt: salt as Uint8Array<ArrayBuffer>, iterations },
      await baseKey(secret),
      256,
    );
    return bytesToBase64(new Uint8Array(bits));
  },
};

/** Constant-time string comparison for hashes. */
export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}
