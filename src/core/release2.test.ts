import { describe, expect, it } from 'vitest';
import { SEIZURE_TYPE_LABELS } from './defaults';
import { doseNotesForReport, parseUnitsPerDose, supplyEstimate } from './stats';
import type { Medication, MedicationDose } from './types';

describe('B-007 pills per dose', () => {
  it('accepts 2, halves and a decimal comma; rejects empty, zero, negative and text', () => {
    expect(parseUnitsPerDose('2')).toBe(2);
    expect(parseUnitsPerDose(' 0.5 ')).toBe(0.5);
    expect(parseUnitsPerDose('1,5')).toBe(1.5);
    for (const bad of ['', '  ', '0', '-1', 'two', '1e9', 'NaN']) expect(parseUnitsPerDose(bad), bad).toBeNull();
  });

  it('refill countdown uses pills per dose', () => {
    const med = (unitsPerDose: number) =>
      ({ scheduledTimes: ['08:00', '20:00'], unitsPerDose, remainingCount: 40, refillReminderDays: 7, refillDate: null }) as unknown as Medication;
    expect(supplyEstimate(med(1), '2026-09-30').daysLeft).toBe(20);
    expect(supplyEstimate(med(2), '2026-09-30').daysLeft).toBe(10);
    expect(supplyEstimate(med(2), '2026-09-30').runOutDate).toBe('2026-10-10');
  });
});

describe('B-009 label', () => {
  it('names the old term so it is recognisable', () => {
    expect(SEIZURE_TYPE_LABELS.focal_to_bilateral_tonic_clonic.label).toBe('Focal to bilateral tonic-clonic (formerly grand mal)');
  });
});

describe('B-011 dose notes in the report', () => {
  const med = { id: 'm1', name: 'Lamotrigine', dosage: '100', unit: 'mg' } as Medication;
  const dose = (id: string, scheduledTime: string, extra: Partial<MedicationDose>) =>
    ({ id, medicationId: 'm1', scheduledTime, actualTime: null, status: 'pending', sideEffects: [], notes: null, ...extra }) as MedicationDose;

  it('lists only doses with a note or side effects, oldest first, with the medication name', () => {
    const rows = doseNotesForReport(
      [
        dose('c', '2026-09-03T08:00:00', { notes: 'Dizzy after', status: 'taken', actualTime: '2026-09-03T08:20:00' }),
        dose('a', '2026-09-01T08:00:00', { notes: '  ' }),
        dose('b', '2026-09-02T08:00:00', { sideEffects: ['nausea'] }),
        dose('d', '2026-09-01T20:00:00', { notes: 'Felt fine' }),
      ],
      [med],
    );
    expect(rows.map((r) => r.doseId)).toEqual(['d', 'b', 'c']);
    expect(rows[0].medication).toBe('Lamotrigine 100mg');
    expect(rows[2].when).toBe('2026-09-03T08:20:00');
    expect(rows[1].sideEffects).toEqual(['nausea']);
  });

  it('still shows notes for a medication that was later removed', () => {
    const rows = doseNotesForReport([{ ...dose('x', '2026-09-01T08:00:00', { notes: 'Rash' }), medicationId: 'gone' }], [med]);
    expect(rows[0].medication).toBe('Medication no longer listed');
  });
});
