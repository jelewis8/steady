// @vitest-environment node
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from './db';
import { deleteMedication, deleteSideEffect, initDatabase, newMedication, newSideEffect, saveMedication, saveSideEffect, saveStopDetails } from './repo';
import { storage } from './storage';

beforeEach(async () => {
  await storage.eraseAll();
  await initDatabase();
});

const addMed = async (name = 'Lamotrigine') => {
  const m = { ...newMedication(), name, dosage: '100', unit: 'mg' };
  await saveMedication(m);
  return m;
};

describe('side-effect log (F-001)', () => {
  it('saves with dates and severity, edits in place, and undo puts back the earlier version', async () => {
    const m = await addMed();
    const se = { ...newSideEffect(m.id), name: '  Dizziness ', startDate: '2026-09-01', severity: 'mild' as const, notes: '  mornings ' };
    const undoAdd = await saveSideEffect(se);
    let row = (await db.sideEffects.get(se.id))!;
    expect(row).toMatchObject({ name: 'Dizziness', startDate: '2026-09-01', endDate: null, severity: 'mild', notes: 'mornings', medicationId: m.id });

    const undoEdit = await saveSideEffect({ ...row, endDate: '2026-09-10', severity: 'moderate' });
    row = (await db.sideEffects.get(se.id))!;
    expect(row).toMatchObject({ endDate: '2026-09-10', severity: 'moderate' });
    await undoEdit();
    expect((await db.sideEffects.get(se.id))!).toMatchObject({ endDate: null, severity: 'mild' });
    await undoAdd();
    expect(await db.sideEffects.get(se.id)).toBeUndefined();
  });

  it('allows "not sure which medication" and "date unknown"', async () => {
    const se = { ...newSideEffect(null), name: 'Headaches' };
    await saveSideEffect(se);
    expect(await db.sideEffects.get(se.id)).toMatchObject({ medicationId: null, startDate: null, endDate: null, severity: null });
  });

  it('delete can be undone', async () => {
    const se = { ...newSideEffect(null), name: 'Rash' };
    await saveSideEffect(se);
    const undo = await deleteSideEffect(se.id);
    expect(await db.sideEffects.count()).toBe(0);
    await undo();
    expect((await db.sideEffects.get(se.id))?.name).toBe('Rash');
  });

  it('keeps side effects when the medication is stopped (history is kept)', async () => {
    const m = await addMed();
    await saveSideEffect({ ...newSideEffect(m.id), name: 'Rash' });
    await deleteMedication(m.id, { reason: 'side_effects' });
    expect(await db.sideEffects.count()).toBe(1);
  });
});

describe('medications that didn’t work out (F-007)', () => {
  it('records the date and reason when a medication is stopped, and undo restores it', async () => {
    const m = await addMed();
    const undo = await deleteMedication(m.id, { endDate: '2026-09-15', reason: 'not_controlling', note: '  Seizures kept coming ' });
    const stopped = (await db.medications.get(m.id))!;
    expect(stopped).toMatchObject({ isActive: false, endDate: '2026-09-15', stopReason: 'not_controlling', stopReasonNote: 'Seizures kept coming' });
    await undo();
    expect((await db.medications.get(m.id))!).toMatchObject({ isActive: true, endDate: null, stopReason: null });
  });

  it('stopping without giving a reason still works (the user can skip it)', async () => {
    const m = await addMed();
    await deleteMedication(m.id);
    expect((await db.medications.get(m.id))!).toMatchObject({ isActive: false, stopReason: null, stopReasonNote: null });
  });

  it('a past medication can have its reason added later', async () => {
    const m = await addMed();
    await deleteMedication(m.id);
    const undo = await saveStopDetails(m.id, { reason: 'allergic_reaction', note: 'Hives' });
    expect((await db.medications.get(m.id))!).toMatchObject({ stopReason: 'allergic_reaction', stopReasonNote: 'Hives', isActive: false });
    await undo();
    expect((await db.medications.get(m.id))!.stopReason).toBeNull();
  });

  it('a medication saved by an earlier release (no stop fields) still opens', async () => {
    const m = await addMed();
    const old: Record<string, unknown> = { ...(await db.medications.get(m.id)) };
    delete old.stopReason;
    delete old.stopReasonNote;
    await db.medications.put(old as never);
    await deleteMedication(m.id, { reason: 'other' });
    expect((await db.medications.get(m.id))!.stopReason).toBe('other');
  });
});
