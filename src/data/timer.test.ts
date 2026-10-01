// @vitest-environment node
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from './db';
import { deleteSeizure, initDatabase, saveSeizure, saveTimedAura, saveTimedSeizure } from './repo';
import { storage } from './storage';

beforeEach(async () => {
  await storage.eraseAll();
  await initDatabase();
});

const at = (s: string) => new Date(`2026-10-01T${s}`);

describe('one timer for a warning sign or a seizure (F-005)', () => {
  it('a seizure that began with a warning sign is saved with a linked warning sign at the same start, with its length', async () => {
    const id = await saveTimedSeizure({ start: at('10:00:00'), end: at('10:02:30'), auraSeconds: 40 });
    const ev = (await db.seizureEvents.get(id))!;
    expect(ev).toMatchObject({ durationSeconds: 150, timestamp: at('10:00:00').toISOString(), endTimestamp: at('10:02:30').toISOString(), isQuickLog: true });
    const aura = (await db.auraLogs.toArray())[0];
    expect(ev.auraIds).toEqual([aura.id]);
    expect(aura).toMatchObject({ seizureEventId: id, timestamp: ev.timestamp, durationSeconds: 40, progressedToSeizure: true, symptoms: [] });
  });

  it('a seizure with no warning sign has no warning sign record', async () => {
    const id = await saveTimedSeizure({ start: at('10:00:00'), end: at('10:01:00'), auraSeconds: null });
    expect((await db.seizureEvents.get(id))!.auraIds).toEqual([]);
    expect(await db.auraLogs.count()).toBe(0);
  });

  it('a warning sign that stayed a warning sign is saved on its own, with its length and what she noticed, and can be undone', async () => {
    const undo = await saveTimedAura({ start: at('11:00:00'), seconds: 52, symptoms: ['deja_vu', 'fear'] });
    const [a] = await db.auraLogs.toArray();
    expect(a).toMatchObject({ seizureEventId: null, durationSeconds: 52, symptoms: ['deja_vu', 'fear'], progressedToSeizure: false, timestamp: at('11:00:00').toISOString() });
    await undo();
    expect(await db.auraLogs.count()).toBe(0);
  });

  it('editing that seizure later does not lose how long the warning sign lasted (no symptoms ticked)', async () => {
    const id = await saveTimedSeizure({ start: at('10:00:00'), end: at('10:02:00'), auraSeconds: 40 });
    const ev = (await db.seizureEvents.get(id))!;
    await saveSeizure({ ...ev, severity: 4 }, []); // the form saves with an empty list when no chips are ticked
    const auras = await db.auraLogs.toArray();
    expect(auras).toHaveLength(1);
    expect(auras[0]).toMatchObject({ durationSeconds: 40, seizureEventId: id });
    expect((await db.seizureEvents.get(id))!.auraIds).toEqual([auras[0].id]);
  });

  it('ticking symptoms afterwards keeps the length and the start', async () => {
    const id = await saveTimedSeizure({ start: at('10:00:00'), end: at('10:02:00'), auraSeconds: 40 });
    const ev = (await db.seizureEvents.get(id))!;
    await saveSeizure(ev, ['deja_vu']);
    expect((await db.auraLogs.toArray())[0]).toMatchObject({ symptoms: ['deja_vu'], durationSeconds: 40, timestamp: ev.timestamp });
  });

  it('an ordinary warning sign (no length) is still removed when its symptoms are cleared, as before', async () => {
    const id = await saveTimedSeizure({ start: at('10:00:00'), end: at('10:02:00'), auraSeconds: null });
    const ev = (await db.seizureEvents.get(id))!;
    await saveSeizure(ev, ['fear']);
    expect(await db.auraLogs.count()).toBe(1);
    expect((await db.auraLogs.toArray())[0].durationSeconds).toBeNull();
    await saveSeizure((await db.seizureEvents.get(id))!, []);
    expect(await db.auraLogs.count()).toBe(0);
  });

  it('deleting the seizure removes its linked warning sign, and undo brings both back', async () => {
    const id = await saveTimedSeizure({ start: at('10:00:00'), end: at('10:02:00'), auraSeconds: 40 });
    const undo = await deleteSeizure(id);
    expect(await db.seizureEvents.count()).toBe(0);
    expect(await db.auraLogs.count()).toBe(0);
    await undo();
    expect(await db.seizureEvents.count()).toBe(1);
    expect((await db.auraLogs.toArray())[0].durationSeconds).toBe(40);
  });

  it('only the standalone warning sign counts as "on its own"', async () => {
    await saveTimedSeizure({ start: at('10:00:00'), end: at('10:02:00'), auraSeconds: 40 });
    await saveTimedAura({ start: at('12:00:00'), seconds: 30, symptoms: [] });
    const all = await db.auraLogs.toArray();
    expect(all.filter((a) => !a.seizureEventId)).toHaveLength(1);
  });
});
