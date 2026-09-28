import { db, getMeta, setMeta } from '../../data/db';
import { updatePreferences } from '../../data/repo';
import { base64ToBytes, bytesToBase64, PBKDF2_ITERATIONS, safeEqual, webCrypto } from '../../platform/crypto';

interface PasscodeRecord {
  saltBase64: string;
  hash: string;
  iterations: number;
  recoverySaltBase64: string;
  recoveryHash: string;
}

const KEY = 'passcode';
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O or 1/I confusion

export function generateRecoveryCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  const chars = [...bytes].map((b) => ALPHABET[b % ALPHABET.length]).join('');
  return `${chars.slice(0, 4)}-${chars.slice(4, 8)}-${chars.slice(8, 12)}`;
}

const normalizeRecovery = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]/g, '');

export async function setPasscode(pin: string, recoveryCode: string): Promise<void> {
  const salt = webCrypto.randomSalt();
  const rsalt = webCrypto.randomSalt();
  const record: PasscodeRecord = {
    saltBase64: bytesToBase64(salt),
    hash: await webCrypto.hashSecret(pin, salt, PBKDF2_ITERATIONS),
    iterations: PBKDF2_ITERATIONS,
    recoverySaltBase64: bytesToBase64(rsalt),
    recoveryHash: await webCrypto.hashSecret(normalizeRecovery(recoveryCode), rsalt, PBKDF2_ITERATIONS),
  };
  await setMeta(KEY, record);
  await updatePreferences({ passcodeEnabled: true });
}

export async function changePin(pin: string): Promise<void> {
  const rec = await getMeta<PasscodeRecord>(KEY);
  if (!rec) return;
  const salt = webCrypto.randomSalt();
  await setMeta(KEY, { ...rec, saltBase64: bytesToBase64(salt), hash: await webCrypto.hashSecret(pin, salt, rec.iterations) });
}

export async function verifyPin(pin: string): Promise<boolean> {
  const rec = await getMeta<PasscodeRecord>(KEY);
  if (!rec) return true;
  const h = await webCrypto.hashSecret(pin, base64ToBytes(rec.saltBase64), rec.iterations);
  return safeEqual(h, rec.hash);
}

export async function verifyRecovery(code: string): Promise<boolean> {
  const rec = await getMeta<PasscodeRecord>(KEY);
  if (!rec) return true;
  const h = await webCrypto.hashSecret(normalizeRecovery(code), base64ToBytes(rec.recoverySaltBase64), rec.iterations);
  return safeEqual(h, rec.recoveryHash);
}

export async function clearPasscode(): Promise<void> {
  await db.meta.delete(KEY);
  await updatePreferences({ passcodeEnabled: false });
}
