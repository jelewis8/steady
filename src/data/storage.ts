import type { Table } from 'dexie';
import {
  buildEnvelope,
  COLLECTION_KEYS,
  emptyExportData,
  mergeSupportIntoProfile,
  type CollectionKey,
  type ExportData,
  type ExportEnvelope,
  type ExportedVoiceNote,
} from '../core/exportSchema';
import type { VoiceNote } from '../core/types';
import type { QueryFilter, StorageAdapter } from '../platform/interfaces';
import { webCrypto, base64ToBytes, bytesToBase64 } from '../platform/crypto';
import { db, type SteadyDB } from './db';

function tableFor(database: SteadyDB, key: CollectionKey): Table<unknown, string> {
  return database[key] as unknown as Table<unknown, string>;
}

async function blobToBase64(blob: Blob): Promise<string> {
  const buf = new Uint8Array(await blob.arrayBuffer());
  return bytesToBase64(buf);
}

export async function checksumOf(data: ExportData): Promise<string> {
  return webCrypto.sha256Hex(JSON.stringify(data));
}

/** Dexie/IndexedDB implementation of StorageAdapter. */
export function createDexieStorage(database: SteadyDB = db): StorageAdapter {
  const allTables = () => [
    database.profile,
    database.rescueProtocol,
    ...COLLECTION_KEYS.map((k) => tableFor(database, k)),
  ];

  return {
    async getAll<T>(c: CollectionKey) {
      return (await tableFor(database, c).toArray()) as T[];
    },
    async getById<T>(c: CollectionKey, id: string) {
      return ((await tableFor(database, c).get(id)) as T) ?? null;
    },
    async put<T>(c: CollectionKey, item: T) {
      await tableFor(database, c).put(item);
    },
    async delete(c: CollectionKey, id: string) {
      await tableFor(database, c).delete(id);
    },
    async query<T>(c: CollectionKey, f: QueryFilter) {
      const t = tableFor(database, c);
      if (f.between) return (await t.where(f.field).between(f.between[0], f.between[1], true, true).toArray()) as T[];
      if (f.equals !== undefined) return (await t.where(f.field).equals(f.equals).toArray()) as T[];
      return (await t.toArray()) as T[];
    },

    async exportAll(): Promise<ExportEnvelope> {
      const data = emptyExportData();
      await database.transaction('r', allTables(), async () => {
        data.userProfile = (await database.profile.toCollection().first()) ?? null;
        data.rescueProtocol = (await database.rescueProtocol.toCollection().first()) ?? null;
        for (const k of COLLECTION_KEYS) {
          if (k === 'voiceNotes') continue;
          (data as unknown as Record<string, unknown[]>)[k] = await tableFor(database, k).toArray();
        }
      });
      const notes = await database.voiceNotes.toArray();
      data.voiceNotes = await Promise.all(
        notes.map(
          async (n): Promise<ExportedVoiceNote> => ({
            id: n.id,
            seizureEventId: n.seizureEventId,
            mimeType: n.mimeType,
            durationMs: n.durationMs,
            createdAt: n.createdAt,
            dataBase64: await blobToBase64(n.blob),
          }),
        ),
      );
      const env = buildEnvelope(data, new Date().toISOString());
      env.checksum = await checksumOf(data);
      return env;
    },

    async importAll(env: ExportEnvelope, mode: 'merge' | 'replace') {
      const d = env.data;
      const voice: VoiceNote[] = d.voiceNotes.map((v) => ({
        id: v.id,
        seizureEventId: v.seizureEventId,
        mimeType: v.mimeType,
        durationMs: v.durationMs,
        createdAt: v.createdAt,
        blob: new Blob([base64ToBytes(v.dataBase64)], { type: v.mimeType }),
      }));
      await database.transaction('rw', allTables(), async () => {
        if (mode === 'replace') {
          for (const t of allTables()) await t.clear();
        }
        if (d.userProfile) {
          const existingProfile = await database.profile.toCollection().first();
          if (mode === 'replace' || !existingProfile) {
            await database.profile.put(d.userProfile);
          } else {
            await database.profile.put(mergeSupportIntoProfile(existingProfile, d.userProfile));
          }
        }
        if (d.rescueProtocol) {
          const existing = await database.rescueProtocol.toCollection().first();
          if (mode === 'replace' || !existing) await database.rescueProtocol.put(d.rescueProtocol);
        }
        for (const k of COLLECTION_KEYS) {
          const rows = k === 'voiceNotes' ? voice : (d[k] as unknown[]);
          if (rows.length === 0) continue;
          if (k === 'sleepEntries' || k === 'dailyCheckIns' || k === 'bathroomLogs') {
            // unique by date: the imported row wins
            const t = tableFor(database, k);
            for (const row of rows as { date: string }[]) {
              const clash = await t.where('date').equals(row.date).first();
              if (clash) await t.delete((clash as { id: string }).id);
            }
          }
          if (k === 'triggerTags' && mode === 'merge') {
            // avoid duplicate built-ins with different ids
            const existing = await database.triggerTags.toArray();
            const labels = new Map(existing.map((t) => [t.label.toLowerCase(), t.id]));
            const idRemap = new Map<string, string>();
            const fresh = (rows as { id: string; label: string }[]).filter((r) => {
              const hit = labels.get(r.label.toLowerCase());
              if (hit && hit !== r.id) {
                idRemap.set(r.id, hit);
                return false;
              }
              return true;
            });
            await database.triggerTags.bulkPut(fresh as never[]);
            if (idRemap.size) {
              d.seizureEvents = d.seizureEvents.map((s) => ({
                ...s,
                triggerTagIds: s.triggerTagIds.map((id) => idRemap.get(id) ?? id),
              }));
              await database.seizureEvents.bulkPut(d.seizureEvents);
            }
            continue;
          }
          await tableFor(database, k).bulkPut(rows);
        }
      });
    },

    async eraseAll() {
      await database.transaction('rw', [...allTables(), database.meta], async () => {
        for (const t of allTables()) await t.clear();
        await database.meta.clear();
      });
    },
  };
}

export const storage = createDexieStorage();
