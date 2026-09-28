// @vitest-environment node
import { beforeEach, describe, expect, it } from 'vitest';
import { parseEnvelope } from '../core/exportSchema';
import { todayKey } from '../core/time';
import { webCrypto } from '../platform/crypto';
import { db } from './db';
import {
  addWater,
  ensureDay,
  initDatabase,
  newMedication,
  newSeizure,
  saveMedication,
  saveSeizure,
  setChecklistStatus,
  setDoseStatus,
  deleteSeizure,
} from './repo';
import { checksumOf, storage } from './storage';
import { loadSampleData } from './sample';

beforeEach(async () => {
  await storage.eraseAll();
  await initDatabase();
});

describe('daily generation', () => {
  it('creates checklist items and doses for today exactly once', async () => {
    const med = { ...newMedication(), name: 'Lamotrigine', dosage: '100', unit: 'mg', remainingCount: 10 };
    await saveMedication(med);
    await ensureDay();
    await ensureDay();
    const items = await db.routineChecklistItems.where('date').equals(todayKey()).count();
    const doses = await db.medicationDoses.count();
    expect(items).toBeGreaterThan(3);
    expect(doses).toBe(2);
  });

  it('taking a dose decrements supply and undo restores it', async () => {
    const med = { ...newMedication(), name: 'X', dosage: '1', remainingCount: 10 };
    await saveMedication(med);
    const dose = (await db.medicationDoses.toArray())[0];
    const undo = await setDoseStatus(dose.id, 'taken');
    expect((await db.medications.get(med.id))?.remainingCount).toBe(9);
    await undo();
    expect((await db.medications.get(med.id))?.remainingCount).toBe(10);
    expect((await db.medicationDoses.get(dose.id))?.status).toBe('pending');
  });

  it('checking off a meal creates a linked meal log, undo removes it', async () => {
    await ensureDay();
    const meal = (await db.routineChecklistItems.toArray()).find((i) => i.category === 'meal')!;
    const undo = await setChecklistStatus(meal.id, 'done');
    expect(await db.mealLogs.get(meal.id)).toBeDefined();
    await undo();
    expect(await db.mealLogs.get(meal.id)).toBeUndefined();
  });

  it('adding water ticks the next water item', async () => {
    await ensureDay();
    await addWater(250);
    const water = (await db.routineChecklistItems.toArray()).filter((i) => i.category === 'hydration');
    expect(water.some((w) => w.status === 'done')).toBe(true);
    expect(await db.hydrationLogs.count()).toBe(1);
  });
});

describe('seizures', () => {
  it('stores aura symptoms as a linked AuraLog and deletes with undo', async () => {
    const ev = newSeizure({ type: 'focal_aware', severity: 2 });
    await saveSeizure(ev, ['deja_vu']);
    const saved = await db.seizureEvents.get(ev.id);
    expect(saved?.auraIds).toHaveLength(1);
    const undo = await deleteSeizure(ev.id);
    expect(await db.auraLogs.count()).toBe(0);
    await undo();
    expect(await db.seizureEvents.get(ev.id)).toBeDefined();
    expect(await db.auraLogs.count()).toBe(1);
  });
});

describe('export / import', () => {
  it('exports everything with a valid checksum and restores it on replace', async () => {
    await saveSeizure(newSeizure({ type: 'focal_aware' }));
    await db.voiceNotes.add({ id: 'v1', seizureEventId: null, blob: new Blob(['abc'], { type: 'audio/webm' }), mimeType: 'audio/webm', durationMs: 1000, createdAt: '' });
    const env = await storage.exportAll();
    expect(env.schemaVersion).toBeDefined();
    expect(env.checksum).toBe(await checksumOf(env.data));
    expect(env.data.voiceNotes[0].dataBase64).toBe(btoa('abc'));

    const json = JSON.parse(JSON.stringify(env));
    await storage.eraseAll();
    const parsed = parseEnvelope(json);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    await storage.importAll(parsed.envelope, 'replace');
    expect(await db.seizureEvents.count()).toBe(1);
    expect(await db.voiceNotes.count()).toBe(1);
    expect(await db.profile.count()).toBe(1);
  });

  it('merge does not duplicate built-in trigger tags', async () => {
    const env = await storage.exportAll();
    const before = await db.triggerTags.count();
    // Simulate a file from another device: same labels, different ids
    env.data.triggerTags = env.data.triggerTags.map((t) => ({ ...t, id: crypto.randomUUID() }));
    await storage.importAll(env, 'merge');
    expect(await db.triggerTags.count()).toBe(before);
  });

  it('encrypted export round-trips with AES-GCM', async () => {
    const salt = webCrypto.randomSalt();
    const key = await webCrypto.deriveKey('correct horse', salt, 1000);
    const payload = await webCrypto.encrypt('{"hello":1}', key);
    expect(await webCrypto.decrypt(payload, key)).toBe('{"hello":1}');
    const wrong = await webCrypto.deriveKey('wrong', salt, 1000);
    await expect(webCrypto.decrypt(payload, wrong)).rejects.toBeDefined();
  });
});

describe('sample data', () => {
  it('generates a rich, flagged dataset', async () => {
    await loadSampleData(60);
    const profile = await db.profile.toCollection().first();
    expect(profile?.isSampleData).toBe(true);
    expect(await db.seizureEvents.count()).toBeGreaterThan(2);
    expect(await db.medicationDoses.count()).toBeGreaterThan(100);
  });
});
