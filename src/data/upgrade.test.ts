// @vitest-environment node
/**
 * B-006 — upgrade safety net.
 *
 * Her data lives on her phone and survives every deploy. These tests prove that data written by an
 * EARLIER release still opens, reads and imports intact with the CURRENT code. Run before every deploy.
 *
 * When you ship a new Dexie version or SCHEMA_VERSION:
 *   1. Add the OLD stores to PREVIOUS_RELEASES below (copy the `stores({...})` of the release now live).
 *   2. Commit a fresh frozen backup of that release in src/test/fixtures/ and list it in FROZEN_BACKUPS.
 * Never edit or delete an entry: they are the history the upgrade has to survive.
 */
import Dexie from 'dexie';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { COLLECTION_KEYS, parseEnvelope, summarizeData, type ExportData, type ExportEnvelope } from '../core/exportSchema';
import { SCHEMA_VERSION } from '../core/defaults';
import { SteadyDB } from './db';
import { checksumOf, createDexieStorage } from './storage';

const PREVIOUS_RELEASES: { release: string; stores: Record<string, string> }[] = [
  {
    release: 'release-2026-09-27',
    stores: {
      profile: 'id',
      seizureEvents: 'id, timestamp',
      auraLogs: 'id, timestamp, seizureEventId',
      medications: 'id, isActive',
      medicationDoses: 'id, medicationId, scheduledTime, [medicationId+scheduledTime]',
      mealLogs: 'id, timestamp',
      hydrationLogs: 'id, timestamp',
      sleepEntries: 'id, &date',
      routineTemplates: 'id',
      routineChecklistItems: 'id, date, [date+templateItemId]',
      triggerTags: 'id, label',
      rescueProtocol: 'id',
      emergencyContacts: 'id, sortOrder',
      insightRules: 'id, correlationType',
      dailyCheckIns: 'id, &date',
      dayPlans: 'date',
      voiceNotes: 'id, seizureEventId',
      meta: 'key',
    },
  },
];

const FROZEN_BACKUPS: { release: string; file: string }[] = [{ release: 'release-2026-09-27', file: 'src/test/fixtures/backup-release-2026-09-27.json' }];

const created: string[] = [];
let n = 0;
const freshName = (label: string) => {
  const name = `upgrade-${label}-${Date.now()}-${n++}`;
  created.push(name);
  return name;
};
afterEach(async () => {
  for (const name of created.splice(0)) await Dexie.delete(name);
});

const byId = <T extends { id?: string; date?: string }>(rows: T[]) => rows.slice().sort((a, b) => String(a.id ?? a.date).localeCompare(String(b.id ?? b.date)));
const loadJson = (file: string) => JSON.parse(readFileSync(file, 'utf8')) as ExportEnvelope;

/** Collections whose stored rows should come back exactly as they went in. */
const ROW_KEYS = COLLECTION_KEYS.filter((k) => k !== 'voiceNotes');

describe.each(PREVIOUS_RELEASES)('database written by $release', ({ release, stores }) => {
  const fixture = FROZEN_BACKUPS.find((f) => f.release === release);
  if (!fixture) throw new Error(`No frozen backup registered for ${release}`);

  async function writeOldDatabase(name: string, data: ExportData) {
    const old = new Dexie(name);
    old.version(1).stores(stores);
    await old.open();
    await old.table('profile').put(data.userProfile);
    if (data.rescueProtocol) await old.table('rescueProtocol').put(data.rescueProtocol);
    for (const k of ROW_KEYS) await old.table(k).bulkPut(data[k] as unknown[]);
    await old.table('meta').put({ key: 'lastExportAt', value: '2026-09-29T10:00:00.000Z' });
    old.close();
  }

  it('opens with the current code and every record is intact', async () => {
    const data = loadJson(fixture.file).data;
    const name = freshName('open');
    await writeOldDatabase(name, data);

    const current = new SteadyDB(name);
    await current.open();
    try {
      expect(await current.profile.toArray()).toEqual([data.userProfile]);
      expect(await current.rescueProtocol.toArray()).toEqual(data.rescueProtocol ? [data.rescueProtocol] : []);
      for (const k of ROW_KEYS) {
        const rows = await (current[k] as unknown as Dexie.Table).toArray();
        expect(byId(rows), `${k} changed after upgrade`).toEqual(byId(data[k] as { id?: string }[]));
      }
      expect((await current.meta.get('lastExportAt'))?.value).toBe('2026-09-29T10:00:00.000Z');
    } finally {
      current.close();
    }
  });

  it('keeps every index working (time ranges, per-day lookups, unique dates)', async () => {
    const data = loadJson(fixture.file).data;
    const name = freshName('index');
    await writeOldDatabase(name, data);
    const current = new SteadyDB(name);
    await current.open();
    try {
      const sorted = data.seizureEvents.map((s) => s.timestamp).sort();
      if (sorted.length) {
        const inRange = await current.seizureEvents.where('timestamp').between(sorted[0], sorted[sorted.length - 1], true, true).count();
        expect(inRange).toBe(sorted.length);
      }
      const dose = data.medicationDoses[0];
      const hit = await current.medicationDoses.where('[medicationId+scheduledTime]').equals([dose.medicationId, dose.scheduledTime]).first();
      expect(hit?.id).toBe(dose.id);
      const item = data.routineChecklistItems[0];
      expect(await current.routineChecklistItems.where('date').equals(item.date).count()).toBeGreaterThan(0);
      const sleep = data.sleepEntries[0];
      await expect(current.sleepEntries.add({ ...sleep, id: 'duplicate-date' })).rejects.toThrow();
      expect((await current.dailyCheckIns.where('date').equals(data.dailyCheckIns[0].date).first())?.id).toBe(data.dailyCheckIns[0].id);
    } finally {
      current.close();
    }
  });

  it('exports the same data it was given (export still works on upgraded data)', async () => {
    const source = loadJson(fixture.file);
    const name = freshName('export');
    await writeOldDatabase(name, source.data);
    const current = new SteadyDB(name);
    await current.open();
    try {
      const out = await createDexieStorage(current).exportAll();
      expect(out.schemaVersion).toBe(SCHEMA_VERSION);
      expect(out.checksum).toHaveLength(64);
      for (const k of ROW_KEYS) expect(byId(out.data[k] as { id?: string }[]), k).toEqual(byId(source.data[k] as { id?: string }[]));
    } finally {
      current.close();
    }
  });
});

describe.each(FROZEN_BACKUPS)('backup file exported by $release', ({ file }) => {
  it('passes its own checksum and parses with no warnings', async () => {
    const raw = loadJson(file);
    expect(await checksumOf(raw.data)).toBe(raw.checksum);
    const parsed = parseEnvelope(raw);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) expect(parsed.warnings).toEqual([]);
  });

  it('imports in replace mode with every record', async () => {
    const raw = loadJson(file);
    const parsed = parseEnvelope(raw);
    if (!parsed.ok) throw new Error(parsed.error);
    const database = new SteadyDB(freshName('replace'));
    const storage = createDexieStorage(database);
    await storage.importAll(parsed.envelope, 'replace');
    const after = await storage.exportAll();
    expect(summarizeData(after.data)).toEqual(summarizeData(raw.data));
    database.close();
  });

  it('imports in merge mode without deleting what is already on the device', async () => {
    const raw = loadJson(file);
    const parsed = parseEnvelope(raw);
    if (!parsed.ok) throw new Error(parsed.error);
    const database = new SteadyDB(freshName('merge'));
    const storage = createDexieStorage(database);
    const existing = { id: 'already-here', timestamp: '2026-09-29T08:00:00.000Z', type: 'focal_aware' } as unknown as ExportData['seizureEvents'][number];
    await storage.put('seizureEvents', existing);
    await storage.importAll(parsed.envelope, 'merge');
    await storage.importAll(parsed.envelope, 'merge'); // twice: no duplicates
    const after = await storage.exportAll();
    expect(after.data.seizureEvents.length).toBe(raw.data.seizureEvents.length + 1);
    expect(after.data.seizureEvents.some((s) => s.id === 'already-here')).toBe(true);
    expect(after.data.medicationDoses.length).toBe(raw.data.medicationDoses.length);
    database.close();
  });
});

/**
 * Optional, and never committed: if a real backup is sitting in the project root
 * (steady-backup-*.json is git-ignored), prove it restores in both modes.
 */
const realBackups = readdirSync('.').filter((f) => /^steady-backup-.*\.json$/.test(f) && !f.includes('.encrypted') && existsSync(join('.', f)));

describe.skipIf(realBackups.length === 0).each(realBackups)('real backup %s', (file) => {
  for (const mode of ['replace', 'merge'] as const) {
    it(`restores in ${mode} mode with every record`, async () => {
      const raw = JSON.parse(readFileSync(file, 'utf8')) as ExportEnvelope;
      const parsed = parseEnvelope(raw);
      if (!parsed.ok) throw new Error(parsed.error);
      const database = new SteadyDB(freshName(`real-${mode}`));
      const storage = createDexieStorage(database);
      await storage.importAll(parsed.envelope, mode);
      const after = await storage.exportAll();
      const expected = summarizeData(raw.data);
      const got = summarizeData(after.data);
      // trigger tags are de-duplicated by label in merge mode; everything else must match exactly
      expect(got).toEqual(expected);
      expect(after.data.userProfile?.id).toBe(raw.data.userProfile?.id);
      database.close();
    });
  }
});
