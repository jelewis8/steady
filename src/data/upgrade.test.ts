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
import { afterEach, describe, expect, it } from 'vitest';
import { COLLECTION_KEYS, parseEnvelope, summarizeData, type ExportData, type ExportEnvelope } from '../core/exportSchema';
import { SCHEMA_VERSION } from '../core/defaults';
import { SteadyDB } from './db';
import { checksumOf, createDexieStorage } from './storage';
import backup20260927 from '../test/fixtures/backup-release-2026-09-27.json?raw';
import backup20260930v5 from '../test/fixtures/backup-release-2026-09-30-5.json?raw';
import backup20261001v4 from '../test/fixtures/backup-release-2026-10-01-4.json?raw';

// Releases 2026-09-27 through 2026-09-30-3 all used database schema version 1, so the first entry covers them.
// Releases 2026-09-30-4 and -5 used version 2 (the sideEffects table). release-2026-09-30-6 added version 3 (bathroomLogs).
// release-2026-10-01-4 is the last release on version 3 (bathroomLogs). release-2026-10-01-5 added version 4 (doseChanges, F-011).
// When the NEXT schema change ships, add the version-4 stores here too, with a fresh frozen backup.
const PREVIOUS_RELEASES: { release: string; /** the Dexie version that release used */ version: number; stores: Record<string, string> }[] = [
  {
    release: 'release-2026-09-27',
    version: 1,
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
  {
    release: 'release-2026-09-30-5',
    version: 2,
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
      sideEffects: 'id, medicationId, startDate',
    },
  },
  {
    release: 'release-2026-10-01-4',
    version: 3,
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
      sideEffects: 'id, medicationId, startDate',
      bathroomLogs: 'id, &date',
    },
  },
];

const FROZEN_BACKUPS: { release: string; raw: string }[] = [
  { release: 'release-2026-09-27', raw: backup20260927 },
  { release: 'release-2026-09-30-5', raw: backup20260930v5 },
  { release: 'release-2026-10-01-4', raw: backup20261001v4 },
];

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
const loadJson = (raw: string) => JSON.parse(raw) as ExportEnvelope;

/** Collections whose stored rows should come back exactly as they went in. */
const ROW_KEYS = COLLECTION_KEYS.filter((k) => k !== 'voiceNotes');

describe.each(PREVIOUS_RELEASES)('database written by $release', ({ release, version, stores }) => {
  // Collections that did not exist in that release (added later) are checked by the migration tests below.
  const rowKeys = ROW_KEYS.filter((k) => k in stores);
  const fixture = FROZEN_BACKUPS.find((f) => f.release === release);
  if (!fixture) throw new Error(`No frozen backup registered for ${release}`);

  async function writeOldDatabase(name: string, data: ExportData) {
    const old = new Dexie(name);
    old.version(version).stores(stores);
    await old.open();
    await old.table('profile').put(data.userProfile);
    if (data.rescueProtocol) await old.table('rescueProtocol').put(data.rescueProtocol);
    for (const k of rowKeys) await old.table(k).bulkPut(data[k] as unknown[]);
    await old.table('meta').put({ key: 'lastExportAt', value: '2026-09-29T10:00:00.000Z' });
    old.close();
  }

  it('opens with the current code and every record is intact', async () => {
    const data = loadJson(fixture.raw).data;
    const name = freshName('open');
    await writeOldDatabase(name, data);

    const current = new SteadyDB(name);
    await current.open();
    try {
      expect(await current.profile.toArray()).toEqual([data.userProfile]);
      expect(await current.rescueProtocol.toArray()).toEqual(data.rescueProtocol ? [data.rescueProtocol] : []);
      for (const k of rowKeys) {
        const rows = await (current[k] as unknown as Dexie.Table).toArray();
        expect(byId(rows), `${k} changed after upgrade`).toEqual(byId(data[k] as { id?: string }[]));
      }
      expect((await current.meta.get('lastExportAt'))?.value).toBe('2026-09-29T10:00:00.000Z');
    } finally {
      current.close();
    }
  });

  it('keeps every index working (time ranges, per-day lookups, unique dates)', async () => {
    const data = loadJson(fixture.raw).data;
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
    const source = loadJson(fixture.raw);
    const name = freshName('export');
    await writeOldDatabase(name, source.data);
    const current = new SteadyDB(name);
    await current.open();
    try {
      const out = await createDexieStorage(current).exportAll();
      expect(out.schemaVersion).toBe(SCHEMA_VERSION);
      expect(out.checksum).toHaveLength(64);
      for (const k of rowKeys) expect(byId(out.data[k] as { id?: string }[]), k).toEqual(byId(source.data[k] as { id?: string }[]));
    } finally {
      current.close();
    }
  });
});

describe.each(FROZEN_BACKUPS)('backup file exported by $release', ({ raw: text }) => {
  it('passes its own checksum and parses with no warnings', async () => {
    const raw = loadJson(text);
    expect(await checksumOf(raw.data)).toBe(raw.checksum);
    const parsed = parseEnvelope(raw);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) expect(parsed.warnings).toEqual([]);
  });

  it('imports in replace mode with every record', async () => {
    const raw = loadJson(text);
    const parsed = parseEnvelope(raw);
    if (!parsed.ok) throw new Error(parsed.error);
    const database = new SteadyDB(freshName('replace'));
    const storage = createDexieStorage(database);
    await storage.importAll(parsed.envelope, 'replace');
    const after = await storage.exportAll();
    expect(summarizeData(after.data)).toEqual(summarizeData(parsed.envelope.data));
    database.close();
  });

  it('imports in merge mode without deleting what is already on the device', async () => {
    const raw = loadJson(text);
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
const realBackups = Object.entries(import.meta.glob('/steady-backup-*.json', { query: '?raw', import: 'default', eager: true }) as Record<string, string>)
  .filter(([path]) => !path.includes('.encrypted'))
  .map(([path, text]) => ({ path, text }));

describe.skipIf(realBackups.length === 0).each(realBackups)('real backup $path', ({ text }) => {
  for (const mode of ['replace', 'merge'] as const) {
    it(`restores in ${mode} mode with every record`, async () => {
      const raw = JSON.parse(text) as ExportEnvelope;
      const parsed = parseEnvelope(raw);
      if (!parsed.ok) throw new Error(parsed.error);
      const database = new SteadyDB(freshName(`real-${mode}`));
      const storage = createDexieStorage(database);
      await storage.importAll(parsed.envelope, mode);
      const after = await storage.exportAll();
      expect(summarizeData(after.data)).toEqual(summarizeData(parsed.envelope.data));
      expect(after.data.userProfile?.id).toBe(raw.data.userProfile?.id);
      database.close();
    });
  }
});

/**
 * Release 2026-09-30-4 (F-001): side effects move from an undated list on each medication into a dated log.
 * Every old entry must survive as a "date unknown" entry, nothing old may be removed, and running it twice must not duplicate.
 */
describe('side-effect migration (F-001)', () => {
  const sources = [
    { label: 'frozen backup', text: backup20260927 },
    ...realBackups.map((b) => ({ label: `real backup ${b.path}`, text: b.text })),
  ];

  for (const src of sources) {
    it(`Dexie upgrade: every old undated side effect becomes a date-unknown entry, and the old field is untouched (${src.label})`, async () => {
      const data = (JSON.parse(src.text) as ExportEnvelope).data;
      // give the old data some side effects, as the release-2026-09-30-3 app would have saved them
      const meds = data.medications.map((m, i) => ({ ...m, sideEffectsNoted: i === 0 ? ['Dizziness', 'dizziness ', 'Nausea'] : (m.sideEffectsNoted ?? []) }));
      const name = freshName('se-upgrade');
      const old = new Dexie(name);
      old.version(1).stores(PREVIOUS_RELEASES[0].stores);
      await old.open();
      await old.table('medications').bulkPut(meds);
      old.close();

      const current = new SteadyDB(name);
      await current.open();
      try {
        const rows = await current.sideEffects.toArray();
        const expected = meds.flatMap((m) => [...new Set((m.sideEffectsNoted ?? []).map((x) => x.trim().toLowerCase()).filter(Boolean))].map((n) => `${m.id}|${n}`));
        expect(rows.map((r) => `${r.medicationId}|${r.name.toLowerCase()}`).sort()).toEqual(expected.sort());
        expect(rows.every((r) => r.startDate === null && r.endDate === null && r.severity === null)).toBe(true);
        expect(rows.length).toBeGreaterThan(0);
        // the old field is left exactly as it was
        const after = await current.medications.toArray();
        expect(byId(after.map((m) => ({ id: m.id, n: m.sideEffectsNoted })) as never)).toEqual(byId(meds.map((m) => ({ id: m.id, n: m.sideEffectsNoted })) as never));
        expect(await current.medications.count()).toBe(meds.length);
      } finally {
        current.close();
      }
    });

    it(`Dexie upgrade: a database with no side effects upgrades cleanly and opens (${src.label})`, async () => {
      const data = (JSON.parse(src.text) as ExportEnvelope).data;
      const name = freshName('se-none');
      const old = new Dexie(name);
      old.version(1).stores(PREVIOUS_RELEASES[0].stores);
      await old.open();
      await old.table('medications').bulkPut(data.medications.map((m) => ({ ...m, sideEffectsNoted: [] })));
      old.close();
      const current = new SteadyDB(name);
      await current.open();
      try {
        expect(await current.sideEffects.count()).toBe(0);
        expect(await current.medications.count()).toBe(data.medications.length);
      } finally {
        current.close();
      }
    });

    it(`backup import: an older backup gets the same date-unknown entries, and importing twice does not duplicate (${src.label})`, async () => {
      const raw = JSON.parse(src.text) as ExportEnvelope;
      raw.data.medications = raw.data.medications.map((m, i) => ({ ...m, sideEffectsNoted: i === 0 ? ['Dizziness', 'Nausea'] : (m.sideEffectsNoted ?? []) }));
      const parsed = parseEnvelope(raw);
      if (!parsed.ok) throw new Error(parsed.error);
      expect(parsed.envelope.data.sideEffects.length).toBeGreaterThanOrEqual(2);
      const database = new SteadyDB(freshName('se-import'));
      const storage = createDexieStorage(database);
      await storage.importAll(parsed.envelope, 'replace');
      const again = parseEnvelope(JSON.parse(JSON.stringify(raw)));
      if (!again.ok) throw new Error(again.error);
      await storage.importAll(again.envelope, 'merge');
      const after = await storage.exportAll();
      expect(after.data.sideEffects.length).toBe(parsed.envelope.data.sideEffects.length);
      expect(after.data.medications.every((m) => m.stopReason === null && m.stopReasonNote === null)).toBe(true);
      database.close();
    });
  }

  it('a current-version backup keeps its own side-effect log and is not re-migrated', async () => {
    const raw = JSON.parse(backup20260927) as ExportEnvelope;
    raw.data.medications = raw.data.medications.map((m) => ({ ...m, sideEffectsNoted: ['Old note'] }));
    raw.data.sideEffects = [
      { id: 'se-1', medicationId: raw.data.medications[0].id, name: 'Dizziness', startDate: '2026-09-01', endDate: null, severity: 'mild', notes: null, createdAt: '2026-09-01T00:00:00Z', updatedAt: '2026-09-01T00:00:00Z' },
    ];
    const parsed = parseEnvelope(raw);
    if (!parsed.ok) throw new Error(parsed.error);
    expect(parsed.envelope.data.sideEffects.map((x) => x.id)).toEqual(['se-1']);
  });
});

/**
 * Release 2026-09-30-6 (F-006, F-008): Dexie version 3 adds the bathroomLogs table, and routines gain repeat and dose-shift settings.
 * Nothing existing may change, the new table starts empty, and routines saved without the new settings must behave exactly as before.
 */
describe('bathroom table and routine settings (F-006, F-008)', () => {
  for (const p of PREVIOUS_RELEASES) {
    const fixture = FROZEN_BACKUPS.find((f) => f.release === p.release)!;
    it(`upgrading a ${p.release} database (Dexie v${p.version}) adds an empty bathroom table and keeps every routine as it was`, async () => {
      const data = loadJson(fixture.raw).data;
      const name = freshName('bath');
      const old = new Dexie(name);
      old.version(p.version).stores(p.stores);
      await old.open();
      await old.table('profile').put(data.userProfile);
      await old.table('routineTemplates').bulkPut(data.routineTemplates);
      await old.table('medications').bulkPut(data.medications);
      old.close();

      const current = new SteadyDB(name);
      await current.open();
      try {
        expect(await current.bathroomLogs.count()).toBe(0);
        expect(byId(await current.routineTemplates.toArray())).toEqual(byId(data.routineTemplates)); // untouched, no new fields added behind her back
        expect(await current.medications.count()).toBe(data.medications.length);
        // and the new table works, with one record per day
        await current.bathroomLogs.add({ id: 'b1', date: '2026-09-01', bowel: true, bowelHow: 'normal', bowelNotes: null, urinationCount: 3, createdAt: '', updatedAt: '' });
        await expect(current.bathroomLogs.add({ id: 'b2', date: '2026-09-01', bowel: false, bowelHow: null, bowelNotes: null, urinationCount: 0, createdAt: '', updatedAt: '' })).rejects.toThrow();
        expect(current.verno).toBeGreaterThanOrEqual(3); // the table exists from version 3; later versions only add
      } finally {
        current.close();
      }
    });
  }

  it('a backup from before 1.4.0 gets routine defaults (no repeat, no dose shift) and no bathroom records, and nothing else changes', async () => {
    for (const f of FROZEN_BACKUPS.filter((x) => !x.release.includes('2026-10-01'))) {
      const raw = loadJson(f.raw);
      const parsed = parseEnvelope(raw);
      if (!parsed.ok) throw new Error(parsed.error);
      expect(parsed.warnings).toEqual([]);
      expect(parsed.envelope.data.bathroomLogs).toEqual([]);
      for (const t of parsed.envelope.data.routineTemplates) {
        expect(t).toMatchObject({ repeatEveryDays: null, repeatStartDate: null, doseShiftMinutes: 0, doseShiftWhich: 'all' });
      }
      expect(parsed.envelope.data.routineTemplates.map((t) => t.items.length)).toEqual(raw.data.routineTemplates.map((t) => t.items.length));
      expect(parsed.envelope.data.userProfile?.preferences.trackBathroom).toBe(false);
    }
  });
});

/**
 * Release 2026-10-01-5 (F-011): a table for dated dose changes. It starts empty, and a medication keeps its current dose
 * on the medication itself, exactly as before. Nothing existing may change.
 */
describe('dose-change table (F-011)', () => {
  for (const p of PREVIOUS_RELEASES) {
    const fixture = FROZEN_BACKUPS.find((f) => f.release === p.release)!;
    it(`upgrading a ${p.release} database (Dexie v${p.version}) adds an empty dose-change table and leaves every record as it was`, async () => {
      const data = loadJson(fixture.raw).data;
      const rowKeys = ROW_KEYS.filter((k) => k in p.stores);
      const name = freshName('dose');
      const old = new Dexie(name);
      old.version(p.version).stores(p.stores);
      await old.open();
      await old.table('profile').put(data.userProfile);
      for (const k of rowKeys) await old.table(k).bulkPut(data[k] as unknown[]);
      old.close();

      const current = new SteadyDB(name);
      await current.open();
      try {
        expect(await current.doseChanges.count()).toBe(0);
        for (const k of rowKeys) {
          const rows = await (current[k] as unknown as Dexie.Table).toArray();
          expect(byId(rows), `${k} changed after upgrade`).toEqual(byId(data[k] as { id?: string }[]));
        }
        const med = data.medications[0];
        await current.doseChanges.add({ id: 'd1', medicationId: med.id, date: '2026-09-01', from: '75 mg', to: '100 mg', note: null, createdAt: '', updatedAt: '' });
        expect((await current.doseChanges.where('medicationId').equals(med.id).toArray()).map((c) => c.id)).toEqual(['d1']);
        expect((await current.doseChanges.where('date').equals('2026-09-01').first())?.id).toBe('d1');
        expect(current.verno).toBe(4);
      } finally {
        current.close();
      }
    });
  }

  it('every older backup opens with no dose changes, no warnings, and nothing else changed', () => {
    for (const f of FROZEN_BACKUPS) {
      const raw = loadJson(f.raw);
      const parsed = parseEnvelope(raw);
      if (!parsed.ok) throw new Error(parsed.error);
      expect(parsed.warnings).toEqual([]);
      expect(parsed.envelope.data.doseChanges).toEqual([]);
      expect(parsed.envelope.schemaVersion).toBe(SCHEMA_VERSION);
      expect(parsed.envelope.data.medications.map((m) => m.dosage)).toEqual(raw.data.medications.map((m) => m.dosage));
    }
  });

  it('dose changes survive export and import in both modes, once only', async () => {
    const raw = loadJson(backup20261001v4);
    const parsed = parseEnvelope(raw);
    if (!parsed.ok) throw new Error(parsed.error);
    const med = parsed.envelope.data.medications[0];
    parsed.envelope.data.doseChanges = [{ id: 'dc1', medicationId: med.id, date: '2026-09-01', from: '75 mg', to: '100 mg', note: 'with food', createdAt: '', updatedAt: '' }];
    for (const mode of ['replace', 'merge'] as const) {
      const database = new SteadyDB(freshName(`dose-${mode}`));
      const storage = createDexieStorage(database);
      await storage.importAll(parsed.envelope, mode);
      await storage.importAll(parsed.envelope, mode);
      const out = await storage.exportAll();
      expect(out.data.doseChanges).toEqual(parsed.envelope.data.doseChanges);
      expect(summarizeData(out.data).find((s) => s.label === 'dose changes')?.count).toBe(1);
      database.close();
    }
  });
});
