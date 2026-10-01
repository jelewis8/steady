// @vitest-environment node
import { beforeEach, describe, expect, it } from 'vitest';
import { addDays, localDateTime, todayKey } from '../core/time';
import { db } from './db';
import {
  addBowelItemToRoutines,
  adjustUrination,
  ensureDay,
  initDatabase,
  newMedication,
  patchTemplate,
  saveBathroomLog,
  saveMedication,
  saveTemplate,
  setBathroomBreaks,
} from './repo';
import { storage } from './storage';

beforeEach(async () => {
  await storage.eraseAll();
  await initDatabase();
});

const today = () => todayKey();

describe('bowel and bladder records (F-006)', () => {
  it('keeps one record per day and merges changes into it', async () => {
    await saveBathroomLog(today(), { bowel: true, bowelHow: 'normal' });
    await saveBathroomLog(today(), { bowelNotes: '  Papaya and tea ', urinationCount: 3 });
    const rows = await db.bathroomLogs.toArray();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ date: today(), bowel: true, bowelHow: 'normal', bowelNotes: 'Papaya and tea', urinationCount: 3 });
  });

  it('forgets the texture when the answer is no, and never stores a negative count', async () => {
    await saveBathroomLog(today(), { bowel: true, bowelHow: 'hard' });
    await saveBathroomLog(today(), { bowel: false });
    await saveBathroomLog(today(), { urinationCount: -4 });
    const row = (await db.bathroomLogs.toArray())[0];
    expect(row).toMatchObject({ bowel: false, bowelHow: null, urinationCount: 0 });
  });

  it('the one-tap counter adds and takes one off, never below zero', async () => {
    await adjustUrination(today(), 1);
    await adjustUrination(today(), 1);
    await adjustUrination(today(), 1);
    await adjustUrination(today(), -1);
    expect((await db.bathroomLogs.toArray())[0].urinationCount).toBe(2);
    await adjustUrination(today(), -5);
    expect((await db.bathroomLogs.toArray())[0].urinationCount).toBe(0);
  });

  it('records past days separately', async () => {
    const d = addDays(today(), -3);
    await saveBathroomLog(d, { bowel: true });
    await saveBathroomLog(today(), { bowel: false });
    expect((await db.bathroomLogs.toArray()).map((r) => r.date).sort()).toEqual([d, today()].sort());
  });

  it('answering the bowel question ticks that day’s routine item, and undo puts both back', async () => {
    await addBowelItemToRoutines('20:00');
    await ensureDay(today());
    const item = () => db.routineChecklistItems.where('date').equals(today()).filter((i) => i.category === 'bowel').first();
    expect((await item())?.status).toBe('pending');
    const undo = await saveBathroomLog(today(), { bowel: false });
    expect((await item())?.status).toBe('done');
    await undo();
    expect((await item())?.status).toBe('pending');
    expect(await db.bathroomLogs.count()).toBe(0);
  });

  it('counting urination alone does not tick the bowel item', async () => {
    await addBowelItemToRoutines('20:00');
    await ensureDay(today());
    await saveBathroomLog(today(), { urinationCount: 2 });
    expect((await db.routineChecklistItems.where('date').equals(today()).filter((i) => i.category === 'bowel').first())?.status).toBe('pending');
  });

  it('adds the bowel question to every routine once, and undo removes it', async () => {
    const before = (await db.routineTemplates.toArray()).map((t) => t.items.length);
    const undo = await addBowelItemToRoutines('20:30');
    let templates = await db.routineTemplates.toArray();
    expect(templates.every((t) => t.items.filter((i) => i.category === 'bowel').length === 1)).toBe(true);
    await addBowelItemToRoutines('20:30'); // again: no duplicates
    templates = await db.routineTemplates.toArray();
    expect(templates.every((t) => t.items.filter((i) => i.category === 'bowel').length === 1)).toBe(true);
    await undo();
    // (the second call added nothing, so undoing the first restores the original list)
    expect((await db.routineTemplates.toArray()).map((t) => t.items.length)).toEqual(before);
  });

  it('bathroom-break times replace each other, sort, de-duplicate, and can be cleared or undone', async () => {
    await setBathroomBreaks(['09:00', '13:00', '13:00', '']);
    const count = async () => (await db.routineTemplates.toArray())[0].items.filter((i) => i.category === 'bathroom');
    expect((await count()).map((i) => `${i.hour}:${i.minute}`)).toEqual(['9:0', '13:0']);
    const undo = await setBathroomBreaks(['07:30']);
    expect((await count()).map((i) => `${i.hour}:${i.minute}`)).toEqual(['7:30']);
    await undo();
    expect((await count()).map((i) => i.hour)).toEqual([9, 13]);
    await setBathroomBreaks([]);
    expect(await count()).toEqual([]);
  });

  it('bathroom-break items appear on today’s checklist with a reminder', async () => {
    await setBathroomBreaks(['10:00']);
    await ensureDay(today());
    const items = await db.routineChecklistItems.where('date').equals(today()).filter((i) => i.category === 'bathroom').toArray();
    expect(items.map((i) => [i.label, i.scheduledHour])).toEqual([['Bathroom break', 10]]);
  });
});

describe('a routine that repeats and moves doses later (F-008), end to end', () => {
  async function setup(startOffsetDays: number) {
    const med = { ...newMedication(), name: 'Lamotrigine', dosage: '100', unit: 'mg', scheduledTimes: ['08:00', '20:00'], startDate: addDays(today(), -60) };
    await saveMedication(med);
    await ensureDay(today());
    const base = (await db.routineTemplates.toArray()).find((t) => t.isDefault)!;
    const toilet = {
      ...base,
      id: 'toilet-day',
      name: 'Toilet day',
      isDefault: false,
      applicableDays: [],
      items: base.items.map((i) => ({ ...i, id: `${i.id}-copy` })),
      repeatEveryDays: 6,
      repeatStartDate: addDays(today(), startOffsetDays),
      doseShiftMinutes: 60,
      doseShiftWhich: 'morning' as const,
    };
    await saveTemplate(toilet);
    return { med, toilet };
  }

  it('on a toilet day the morning dose is at 9:00 and the evening dose is unchanged', async () => {
    const { med } = await setup(0); // today is day 1 of the cycle
    await ensureDay(today());
    const doses = (await db.medicationDoses.where('medicationId').equals(med.id).toArray());
    const times = doses.filter((d) => d.scheduledTime >= localDateTime(today(), '00:00') && d.scheduledTime <= localDateTime(today(), '23:59')).map((d) => d.scheduledTime).sort();
    expect(times).toEqual([localDateTime(today(), '09:00'), localDateTime(today(), '20:00')]);
  });

  it('the day after, doses are back to 8:00 and 20:00', async () => {
    const { med } = await setup(0);
    const tomorrow = addDays(today(), 1);
    await ensureDay(tomorrow);
    const times = (await db.medicationDoses.where('medicationId').equals(med.id).toArray())
      .filter((d) => d.scheduledTime >= localDateTime(tomorrow, '00:00') && d.scheduledTime <= localDateTime(tomorrow, '23:59'))
      .map((d) => d.scheduledTime)
      .sort();
    expect(times).toEqual([localDateTime(tomorrow, '08:00'), localDateTime(tomorrow, '20:00')]);
  });

  it('six days later it is a toilet day again', async () => {
    const { med } = await setup(0);
    const d = addDays(today(), 6);
    await ensureDay(d);
    const times = (await db.medicationDoses.where('medicationId').equals(med.id).toArray())
      .filter((x) => x.scheduledTime >= localDateTime(d, '00:00') && x.scheduledTime <= localDateTime(d, '23:59'))
      .map((x) => x.scheduledTime)
      .sort();
    expect(times).toEqual([localDateTime(d, '09:00'), localDateTime(d, '20:00')]);
  });

  it('a dose the user already took at 8:00 is kept, and no second 9:00 dose appears', async () => {
    const med = { ...newMedication(), name: 'Lamotrigine', dosage: '100', unit: 'mg', scheduledTimes: ['08:00'], startDate: addDays(today(), -60) };
    await saveMedication(med);
    await ensureDay(today());
    const dose = (await db.medicationDoses.where('medicationId').equals(med.id).toArray()).find((d) => d.scheduledTime === localDateTime(today(), '08:00'))!;
    await db.medicationDoses.put({ ...dose, status: 'taken', actualTime: dose.scheduledTime });
    const base = (await db.routineTemplates.toArray()).find((t) => t.isDefault)!;
    await saveTemplate({ ...base, id: 'toilet-day', name: 'Toilet day', isDefault: false, applicableDays: [], repeatEveryDays: 6, repeatStartDate: today(), doseShiftMinutes: 60, doseShiftWhich: 'all' });
    await ensureDay(today());
    const after = await db.medicationDoses.where('medicationId').equals(med.id).toArray();
    expect(after).toHaveLength(1);
    expect(after[0].status).toBe('taken');
  });

  it('a pending 8:00 dose moves to 9:00 when the routine’s shift is turned on', async () => {
    const med = { ...newMedication(), name: 'Lamotrigine', dosage: '100', unit: 'mg', scheduledTimes: ['08:00'], startDate: addDays(today(), -60) };
    await saveMedication(med);
    await ensureDay(today());
    const base = (await db.routineTemplates.toArray()).find((t) => t.isDefault)!;
    await saveTemplate({ ...base, repeatEveryDays: null, doseShiftMinutes: 60, doseShiftWhich: 'all' }); // the everyday routine itself shifts
    await ensureDay(today());
    const after = await db.medicationDoses.where('medicationId').equals(med.id).toArray();
    expect(after.map((d) => d.scheduledTime)).toEqual([localDateTime(today(), '09:00')]);
  });
});

describe('routine edits never overwrite each other (F-008)', () => {
  it('a rename and a switch to "every few days" made at nearly the same moment both stick', async () => {
    const base = (await db.routineTemplates.toArray()).find((t) => t.isDefault)!;
    await saveTemplate({ ...base, id: 'copy', name: 'New routine', isDefault: false, applicableDays: [] });
    await Promise.all([
      patchTemplate('copy', { name: 'Toilet day' }),
      patchTemplate('copy', { repeatEveryDays: 6, repeatStartDate: today(), applicableDays: [] }),
      patchTemplate('copy', { doseShiftMinutes: 60, doseShiftWhich: 'morning' }),
    ]);
    expect(await db.routineTemplates.get('copy')).toMatchObject({ name: 'Toilet day', repeatEveryDays: 6, repeatStartDate: today(), doseShiftMinutes: 60, doseShiftWhich: 'morning' });
  });

  it('patching a routine that no longer exists does nothing', async () => {
    await patchTemplate('gone', { name: 'x' });
    expect(await db.routineTemplates.get('gone')).toBeUndefined();
  });
});
