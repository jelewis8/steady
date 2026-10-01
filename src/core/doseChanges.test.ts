import { describe, expect, it } from 'vitest';
import { compareAroundMedicationDates, comparisonTitle, medicationDateEvents } from './bathroom';
import { describeChange, doseDiffers, doseText, newDoseChange, sortDoseChanges } from './doseChanges';
import type { BathroomLog, Medication } from './types';

const med = (over: Partial<Medication> = {}): Medication =>
  ({ id: 'm1', name: 'Alpha', dosage: '100', unit: 'mg', unitsPerDose: 1, startDate: '2026-01-01', endDate: null, isRescue: false, ...over }) as Medication;

describe('F-011: dose text and change detection', () => {
  it('writes the dose as plain text, including how many the user takes at a time', () => {
    expect(doseText(med())).toBe('100 mg');
    expect(doseText(med({ dosage: '50', unitsPerDose: 2 }))).toBe('50 mg × 2');
    expect(doseText(med({ dosage: '1', unit: 'tablet' }))).toBe('1 tablet');
    expect(doseText(med({ unit: '' }))).toBe('100');
  });
  it('notices a changed amount, unit or number per dose, and ignores everything else', () => {
    expect(doseDiffers(med(), med())).toBe(false);
    expect(doseDiffers(med(), med({ name: 'Beta', notes: 'x' }))).toBe(false);
    expect(doseDiffers(med(), med({ dosage: '150' }))).toBe(true);
    expect(doseDiffers(med(), med({ unit: 'mL' }))).toBe(true);
    expect(doseDiffers(med(), med({ unitsPerDose: 2 }))).toBe(true);
  });
  it('sorts newest first and describes a change in words', () => {
    const a = newDoseChange('m1', '2026-09-01', '75 mg', '100 mg');
    const b = newDoseChange('m1', '2026-09-20', '100 mg', '150 mg', '  with food ');
    expect(sortDoseChanges([a, b]).map((c) => c.date)).toEqual(['2026-09-20', '2026-09-01']);
    expect(b.note).toBe('with food');
    expect(describeChange(b)).toBe('100 mg to 150 mg');
    expect(describeChange({ from: '', to: '100 mg' })).toBe('not recorded to 100 mg');
  });
});

describe('F-011 in F-010: dose changes are comparison dates', () => {
  const log = (date: string): BathroomLog => ({ id: date, date, bowel: false, bowelHow: null, bowelNotes: null, urinationCount: 3, createdAt: '', updatedAt: '' });
  const days = Array.from({ length: 28 }, (_, i) => log(`2026-09-${String(i + 1).padStart(2, '0')}`));
  const change = newDoseChange('m1', '2026-09-15', '100 mg', '150 mg');

  it('lists dose changes with the other events, and skips changes for rescue or unknown medications', () => {
    expect(medicationDateEvents([med()], '2026-09-01', '2026-09-30', [change]).map((e) => `${e.event} ${e.date} ${e.detail}`)).toEqual(['dose changed 2026-09-15 100 mg to 150 mg']);
    expect(medicationDateEvents([med({ isRescue: true })], '2026-09-01', '2026-09-30', [change])).toEqual([]);
    expect(medicationDateEvents([], '2026-09-01', '2026-09-30', [change])).toEqual([]);
    expect(medicationDateEvents([med()], '2026-10-01', '2026-10-30', [change])).toEqual([]);
  });
  it('compares the 14 days either side and names the change in plain words', () => {
    const [c] = compareAroundMedicationDates(days, [med()], '2026-09-01', '2026-09-30', '2026-09-30', [change]);
    expect(c.event).toBe('dose changed');
    expect(c.enough).toBe(true);
    expect(c.before.summary.daysWithRecord).toBe(14);
    expect(comparisonTitle(c, (d) => d)).toBe('Alpha dose changed on 2026-09-15 (100 mg to 150 mg)');
  });
  it('names a second change in the same weeks, but not itself', () => {
    const second = newDoseChange('m1', '2026-09-22', '150 mg', '200 mg');
    const out = compareAroundMedicationDates(days, [med()], '2026-09-01', '2026-09-30', '2026-09-30', [change, second]);
    expect(out.find((c) => c.date === '2026-09-15')!.otherChanges).toEqual(['Alpha dose changed']);
  });
});
