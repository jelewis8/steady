// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { selectTemplate } from '../core/checklist';
import { parseEnvelope, type ExportEnvelope } from '../core/exportSchema';
import { todayKey } from '../core/time';
import { db } from './db';
import { ensureDay, initDatabase } from './repo';
import { storage } from './storage';

/**
 * B-012: restoring a backup into a new device changed her breakfast from 9:30 back to the default 7:30.
 * A new device already has its own default "Everyday" routine; the backup's routine must be the one that is used.
 */
async function backupWithBreakfastAt(hour: number, minute: number): Promise<ExportEnvelope> {
  await storage.eraseAll();
  await initDatabase();
  const everyday = (await db.routineTemplates.toArray()).find((t) => t.isDefault)!;
  await db.routineTemplates.put({
    ...everyday,
    items: everyday.items.map((i) => (i.category === 'meal' && i.mealType === 'breakfast' ? { ...i, hour, minute } : i)),
    updatedAt: new Date(Date.now() + 5000).toISOString(),
  });
  const env = await storage.exportAll();
  await storage.eraseAll();
  return env;
}

const breakfastToday = async () => {
  const item = (await db.routineChecklistItems.where('date').equals(todayKey()).toArray()).find((i) => i.category === 'meal' && i.mealType === 'breakfast');
  return item ? [item.scheduledHour, item.scheduledMinute] : null;
};

describe('restoring a backup keeps her routine (B-012)', () => {
  for (const mode of ['merge', 'replace'] as const) {
    it(`${mode}: on a brand-new device (which has default routines of its own), her 9:30 breakfast is used`, async () => {
      const env = await backupWithBreakfastAt(9, 30);
      await initDatabase(); // the new device's own defaults, with new ids (breakfast 7:30)
      const parsed = parseEnvelope(JSON.parse(JSON.stringify(env)));
      if (!parsed.ok) throw new Error(parsed.error);
      await storage.importAll(parsed.envelope, mode);
      await ensureDay(todayKey());
      const templates = await db.routineTemplates.toArray();
      const chosen = selectTemplate(templates, todayKey());
      expect(chosen?.items.find((i) => i.mealType === 'breakfast')).toMatchObject({ hour: 9, minute: 30 });
      expect(await breakfastToday()).toEqual([9, 30]);
      // the device's own default routines are not left behind as duplicates
      expect(templates.map((t) => t.name).sort()).toEqual(['Everyday', 'Rest day']);
    });
  }

  it('merge into a device that is already set up: the backup’s routine is used, and nothing is deleted', async () => {
    const env = await backupWithBreakfastAt(9, 30);
    await initDatabase();
    await db.profile.toCollection().modify({ onboarded: true }); // an app she has already set up
    const before = await db.routineTemplates.toArray();
    const parsed = parseEnvelope(JSON.parse(JSON.stringify(env)));
    if (!parsed.ok) throw new Error(parsed.error);
    await storage.importAll(parsed.envelope, 'merge');
    await ensureDay(todayKey());
    const after = await db.routineTemplates.toArray();
    for (const t of before) expect(after.some((x) => x.id === t.id)).toBe(true); // nothing deleted
    expect(selectTemplate(after, todayKey())?.items.find((i) => i.mealType === 'breakfast')).toMatchObject({ hour: 9, minute: 30 });
    expect(await breakfastToday()).toEqual([9, 30]);
    // only one routine claims each weekday, and only one is the default
    const claims = after.flatMap((t) => t.applicableDays);
    expect(new Set(claims).size).toBe(claims.length);
    expect(after.filter((t) => t.isDefault)).toHaveLength(1);
  });

  it('restoring the same device’s backup again updates its routine in place', async () => {
    const env = await backupWithBreakfastAt(9, 30);
    const parsed = parseEnvelope(JSON.parse(JSON.stringify(env)));
    if (!parsed.ok) throw new Error(parsed.error);
    await storage.importAll(parsed.envelope, 'replace');
    await storage.importAll(parsed.envelope, 'merge');
    await storage.importAll(parsed.envelope, 'merge');
    expect(await db.routineTemplates.count()).toBe(2);
  });

  it('a backup with no routines leaves the device’s routines alone', async () => {
    const env = await backupWithBreakfastAt(9, 30);
    env.data.routineTemplates = [];
    await initDatabase();
    const before = (await db.routineTemplates.toArray()).map((t) => t.id).sort();
    const parsed = parseEnvelope(JSON.parse(JSON.stringify(env)));
    if (!parsed.ok) throw new Error(parsed.error);
    await storage.importAll(parsed.envelope, 'merge');
    expect((await db.routineTemplates.toArray()).map((t) => t.id).sort()).toEqual(before);
  });
});
