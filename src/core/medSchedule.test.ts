import { describe, expect, it } from 'vitest';
import { buildChecklistView, missingDosesForDay, orphanedPendingDoses, pendingDosesWithStaleUnits } from './checklist';
import { doseDiffers, doseText } from './doseChanges';
import { parseEnvelope } from './exportSchema';
import { compactTimeUnits, describeRepeat, isMedDueOn, pillsAt, pillsPerDayAverage, repeatOf, scheduleText } from './medSchedule';
import { supplyEstimate } from './stats';
import { localDateTime } from './time';
import type { Medication } from './types';

const NOW = '2026-10-06T12:00:00.000Z';

function med(partial: Partial<Medication> = {}): Medication {
  return {
    id: 'lac', name: 'Lacosamide', genericName: null, dosage: '50', unit: 'mg', frequency: 'times daily',
    scheduledTimes: ['09:00', '13:00', '21:00'], prescriber: null, pharmacy: null, remainingCount: 60, unitsPerDose: 1,
    refillDate: null, refillReminderDays: 7, isActive: true, isRescue: false, startDate: '2026-01-01', endDate: null,
    sideEffectsNoted: [], notes: null, stopReason: null, stopReasonNote: null, createdAt: NOW, updatedAt: NOW, ...partial,
  };
}
const lacosamide = () => med({ timeUnits: { '21:00': 2 } });

describe('pills at each time (F-013)', () => {
  it('uses the medication default unless a time has its own count', () => {
    const m = lacosamide();
    expect([pillsAt(m, '09:00'), pillsAt(m, '13:00'), pillsAt(m, '21:00')]).toEqual([1, 1, 2]);
  });
  it('records without the new fields behave exactly as before', () => {
    const m = med({ unitsPerDose: 2 });
    expect(pillsAt(m, '09:00')).toBe(2);
    expect(repeatOf(m)).toEqual({ kind: 'daily' });
    expect(isMedDueOn(m, '2026-10-07')).toBe(true);
  });
  it('compactTimeUnits keeps only the counts that differ from the first', () => {
    expect(compactTimeUnits(['09:00', '13:00', '21:00'], [1, 1, 2], 1)).toEqual({ '21:00': 2 });
  });
  it('each new dose remembers its own pill count', () => {
    const doses = missingDosesForDay([lacosamide()], '2026-10-07', [], NOW, '2026-10-07');
    expect(doses.map((d) => d.units)).toEqual([1, 1, 2]);
  });
  it('the checklist says how many to take when it is not always one', () => {
    const doses = missingDosesForDay([lacosamide()], '2026-10-07', [], NOW, '2026-10-07');
    const view = buildChecklistView({ date: '2026-10-07', items: [], doses, meds: [lacosamide()], now: new Date(2026, 9, 7, 8), isToday: true });
    const text = JSON.stringify(view);
    expect(text).toContain('take 2 pills');
    expect(text).toContain('take 1 pill');
  });
  it('a pending dose follows an edit; a recorded one is left alone', () => {
    const m = lacosamide();
    const doses = missingDosesForDay([m], '2026-10-07', [], NOW, '2026-10-07');
    doses[2].status = 'taken';
    const edited = med({ timeUnits: { '21:00': 3, '13:00': 2 } });
    const stale = pendingDosesWithStaleUnits([edited], '2026-10-07', doses, '2026-10-07');
    expect(stale.map((d) => d.units)).toEqual([2]); // 13:00 follows; 21:00 was already taken
  });
  it('the supply estimate counts every pill in a day', () => {
    expect(pillsPerDayAverage(lacosamide())).toBe(4);
    expect(supplyEstimate(lacosamide(), '2026-10-07').daysLeft).toBe(15);
  });
  it('a change in the pills at one time counts as a dose change', () => {
    expect(doseText(lacosamide())).toBe('50 mg × 1, 1, 2');
    expect(doseDiffers(med(), lacosamide())).toBe(true);
    expect(doseText(med())).toBe('50 mg');
  });
});

describe('which days (F-014)', () => {
  const mwf = () => med({ repeat: { kind: 'weekdays', days: [1, 2, 5] } }); // Mon, Tue, Fri
  it('certain weekdays', () => {
    // 2026-10-05 is a Monday
    expect(['2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08', '2026-10-09', '2026-10-10', '2026-10-11'].map((d) => isMedDueOn(mwf(), d))).toEqual([
      true, true, false, false, true, false, false,
    ]);
    expect(describeRepeat(mwf())).toBe('Mon, Tue, Fri');
  });
  it('every other day, counting from the chosen day, before and after it', () => {
    const m = med({ repeat: { kind: 'everyN', n: 2, from: '2026-10-06' } });
    expect(['2026-10-04', '2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08'].map((d) => isMedDueOn(m, d))).toEqual([true, false, true, false, true]);
    expect(describeRepeat(m)).toBe('Every other day');
  });
  it('an off day gets no doses, and old pending doses on it are removed', () => {
    const m = mwf();
    expect(missingDosesForDay([m], '2026-10-07', [], NOW, '2026-10-07')).toHaveLength(0); // Wednesday
    expect(missingDosesForDay([m], '2026-10-09', [], NOW, '2026-10-09')).toHaveLength(3); // Friday
    const pending = missingDosesForDay([med()], '2026-10-07', [], NOW, '2026-10-07');
    expect(orphanedPendingDoses([m], '2026-10-07', pending, '2026-10-07')).toHaveLength(3);
  });
  it('a dose already taken on what is now an off day is never removed', () => {
    const taken = missingDosesForDay([med()], '2026-10-07', [], NOW, '2026-10-07').map((d) => ({ ...d, status: 'taken' as const }));
    expect(orphanedPendingDoses([mwf()], '2026-10-07', taken, '2026-10-07')).toHaveLength(0);
    expect(missingDosesForDay([mwf()], '2026-10-07', taken, NOW, '2026-10-07')).toHaveLength(0);
  });
  it('bad or empty settings fall back to every day instead of hiding doses', () => {
    expect(repeatOf(med({ repeat: { kind: 'weekdays', days: [] } }))).toEqual({ kind: 'daily' });
    expect(repeatOf(med({ repeat: { kind: 'everyN', n: 1, from: '2026-10-06' } }))).toEqual({ kind: 'daily' });
  });
  it('supply lasts longer when days are skipped', () => {
    expect(supplyEstimate(med({ repeat: { kind: 'everyN', n: 2, from: '2026-10-06' }, remainingCount: 30 }), '2026-10-07').daysLeft).toBe(20);
  });
  it('schedule text for reports', () => {
    expect(scheduleText(med({ timeUnits: { '21:00': 2 }, repeat: { kind: 'weekdays', days: [1, 2, 5] } }))).toBe(
      '09:00 (1 pill), 13:00 (1 pill), 21:00 (2 pills) · Mon, Tue, Fri',
    );
    expect(scheduleText(med())).toBe('09:00, 13:00, 21:00');
  });
  it('the dose time is still the clock time', () => {
    const [d] = missingDosesForDay([mwf()], '2026-10-09', [], NOW, '2026-10-09');
    expect(d.scheduledTime).toBe(localDateTime('2026-10-09', '09:00'));
  });
});

describe('import of older files (1.7.0)', () => {
  it('gives older medications every-day defaults', () => {
    const r = parseEnvelope({ schemaVersion: '1.6.0', data: { medications: [{ id: 'x', name: 'A', scheduledTimes: ['08:00'] }] } });
    expect(r.ok && r.envelope.data.medications[0].repeat).toEqual({ kind: 'daily' });
    expect(r.ok && r.envelope.data.medications[0].timeUnits).toEqual({});
  });
  it('keeps what a 1.7.0 file already says', () => {
    const r = parseEnvelope({ schemaVersion: '1.7.0', data: { medications: [{ id: 'x', name: 'A', scheduledTimes: [], repeat: { kind: 'weekdays', days: [1] }, timeUnits: { '08:00': 2 } }] } });
    expect(r.ok && r.envelope.data.medications[0].repeat).toEqual({ kind: 'weekdays', days: [1] });
  });
});
