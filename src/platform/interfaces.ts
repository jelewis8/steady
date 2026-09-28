/**
 * Platform abstractions — app-blueprint.md §2.8 "Abstractions That Make Phase 2 Cheap".
 * Business logic depends on these interfaces only; Phase 2 swaps the implementations.
 */
import type { CollectionKey, ExportEnvelope } from '../core/exportSchema';

export type QueryFilter = {
  /** indexed field name */
  field: string;
  /** inclusive range or exact value */
  equals?: string | number;
  between?: [string | number, string | number];
};

export interface StorageAdapter {
  getAll<T>(collection: CollectionKey): Promise<T[]>;
  getById<T>(collection: CollectionKey, id: string): Promise<T | null>;
  put<T>(collection: CollectionKey, item: T): Promise<void>;
  delete(collection: CollectionKey, id: string): Promise<void>;
  query<T>(collection: CollectionKey, filter: QueryFilter): Promise<T[]>;
  exportAll(): Promise<ExportEnvelope>;
  importAll(data: ExportEnvelope, mode: 'merge' | 'replace'): Promise<void>;
  eraseAll(): Promise<void>;
}

export interface ScheduledNotification {
  id: string;
  title: string;
  body: string;
  at: Date;
  /** notification tag used to collapse duplicates */
  tag: string;
  critical: boolean;
  url?: string;
  actions?: { action: string; title: string }[];
  data?: Record<string, string>;
}

export interface NotificationScheduler {
  schedule(notification: ScheduledNotification): Promise<string>;
  cancel(id: string): Promise<void>;
  cancelAll(): Promise<void>;
  requestPermission(): Promise<boolean>;
  permission(): 'granted' | 'denied' | 'default' | 'unsupported';
  /** Show immediately. */
  show(notification: Omit<ScheduledNotification, 'at' | 'id'>): Promise<void>;
}

export interface AudioBlob {
  blob: Blob;
  mimeType: string;
  durationMs: number;
}

export interface AudioRecorder {
  isSupported(): boolean;
  start(): Promise<void>;
  stop(): Promise<AudioBlob>;
  cancel(): void;
  isRecording(): boolean;
}

export interface EncryptedPayload {
  ivBase64: string;
  ciphertextBase64: string;
}

export interface EncryptionProvider {
  randomSalt(): Uint8Array;
  deriveKey(passphrase: string, salt: Uint8Array, iterations?: number): Promise<CryptoKey>;
  encrypt(data: string, key: CryptoKey): Promise<EncryptedPayload>;
  decrypt(payload: EncryptedPayload, key: CryptoKey): Promise<string>;
  sha256Hex(data: string): Promise<string>;
  /** Slow hash for passcode verification (PBKDF2). */
  hashSecret(secret: string, salt: Uint8Array, iterations?: number): Promise<string>;
}

export interface ExportFile {
  name: string;
  mimeType: string;
  content: string | Blob;
}

export interface ShareProvider {
  canShareFiles(): boolean;
  shareFile(file: ExportFile, title?: string): Promise<'shared' | 'downloaded' | 'cancelled'>;
  shareText(text: string, title?: string): Promise<'shared' | 'copied' | 'cancelled'>;
  download(file: ExportFile): void;
}

export interface AuthGate {
  isAvailable(): Promise<boolean>;
  authenticate(reason: string): Promise<boolean>;
}
