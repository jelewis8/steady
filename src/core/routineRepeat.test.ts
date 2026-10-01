import { describe, expect, it } from 'vitest';
import { missingDosesForDay, nextRepeatDates, orphanedPendingDoses, repeatMatches, selectTemplate, shiftedDoseTime } from './checklist';
import { adherence } from './stats';
import { doseStatusForNow } from './checklist';
import { localDateTime } from './time';
import type { Medication, MedicationDose, RoutineTemplate } from './types';

const tpl = (over: Partial<RoutineTemplate>): RoutineTemplate =>
  ({ id: 't', name: 'T', isDefault: false, applicableDays: [], items: [], createdAt: '', updatedAt: '', ...over }) as RoutineTemplate;

const everyday = tpl({ id: 'everyday', name: 'Everyday', isDefault: true, applicableDays: [0, 1, 2, 3, 4, 5, 6] });
const toilet = tpl({ id: 'toilet', name: 'Toilet day', applicableDays: [0, 1, 2, 3, 4, 5, 6], repeatEveryDays: 6, repeatStartDate: '2026-10-01', doseShiftMinutes: 60, doseShiftWhich: 'morning' });

describe('routines that repeat every N days (F-008)', () => {
  it('falls on the start date and every 6th day after, never before', () => {
    const days = ['2026-09-25', '2026-10-01', '2026-10-02', '2026-10-06', '2026-10-07', '2026-10-13', '2026-10-19'];
    expect(days.map((d) => repeatMatches(toilet, d))).toEqual([false, true, false, false, true, true, true]);
  });

  it('works across month and year ends, and the start date can be in the past', () => {
    const t = tpl({ repeatEveryDays: 6, repeatStartDate: '2026-12-28' });
    expect(repeatMatches(t, '2027-01-03')).toBe(true);
    expect(repeatMatches(t, '2027-01-02')).toBe(false);
    const old = tpl({ repeatEveryDays: 6, repeatStartDate: '2025-01-01' });
    expect(repeatMatches(old, '2025-01-07')).toBe(true);
    expect(repeatMatches(old, '2026-09-30')).toBe(((Date.UTC(2026, 8, 30) - Date.UTC(2025, 0, 1)) / 86_400_000) % 6 === 0);
  });

  it('is off when N is under 2, there is no start date, or it is not set at all', () => {
    expect(repeatMatches(tpl({ repeatEveryDays: 1, repeatStartDate: '2026-10-01' }), '2026-10-02')).toBe(false);
    expect(repeatMatches(tpl({ repeatEveryDays: 6, repeatStartDate: null }), '2026-10-01')).toBe(false);
    expect(repeatMatches(tpl({}), '2026-10-01')).toBe(false);
  });

  it('lists the next days it will fall on', () => {
    expect(nextRepeatDates(toilet, '2026-10-02', 3)).toEqual(['2026-10-07', '2026-10-13', '2026-10-19']);
    expect(nextRepeatDates(toilet, '2026-10-01', 2)).toEqual(['2026-10-01', '2026-10-07']);
    expect(nextRepeatDates(toilet, '2026-09-01', 2)).toEqual(['2026-10-01', '2026-10-07']); // not started yet
    expect(nextRepeatDates(everyday, '2026-10-01', 3)).toEqual([]);
  });

  it('chooses the repeating routine on its days and otherwise the normal weekday routine', () => {
    const all = [everyday, toilet];
    expect(selectTemplate(all, '2026-10-07')?.id).toBe('toilet');
    expect(selectTemplate(all, '2026-10-08')?.id).toBe('everyday');
    expect(selectTemplate(all, '2026-09-20')?.id).toBe('everyday'); // before it starts
    expect(selectTemplate([toilet, everyday], '2026-10-08')?.id).toBe('everyday'); // order does not matter: a repeating routine never takes part in the weekday choice
  });

  it('the user’s own choice for a day still wins', () => {
    expect(selectTemplate([everyday, toilet], '2026-10-07', { date: '2026-10-07', templateId: 'everyday' })?.id).toBe('everyday');
  });

  it('an old routine saved without the new fields behaves exactly as before', () => {
    const old = tpl({ id: 'old', isDefault: true, applicableDays: [1] }); // no repeat or shift fields at all
    expect(selectTemplate([old], '2026-10-05')?.id).toBe('old'); // Monday
    expect(shiftedDoseTime('08:00', old)).toBe('08:00');
  });
});

describe('moving medication times later on those days (F-008)', () => {
  it('moves morning doses by the routine’s shift and leaves the rest alone', () => {
    expect(shiftedDoseTime('08:00', toilet)).toBe('09:00');
    expect(shiftedDoseTime('11:30', toilet)).toBe('12:30');
    expect(shiftedDoseTime('12:00', toilet)).toBe('12:00');
    expect(shiftedDoseTime('20:00', toilet)).toBe('20:00');
  });
  it('"all doses" moves every dose, and never past the end of the day', () => {
    const all = tpl({ doseShiftMinutes: 90, doseShiftWhich: 'all' });
    expect(shiftedDoseTime('20:00', all)).toBe('21:30');
    expect(shiftedDoseTime('23:00', all)).toBe('23:59');
  });
  it('never moves a dose earlier, and ignores no routine', () => {
    expect(shiftedDoseTime('08:00', tpl({ doseShiftMinutes: -60 }))).toBe('08:00');
    expect(shiftedDoseTime('08:00', null)).toBe('08:00');
    expect(shiftedDoseTime('08:00', tpl({ doseShiftMinutes: 0 }))).toBe('08:00');
  });

  const med = { id: 'm', isActive: true, isRescue: false, startDate: '2026-01-01', endDate: null, scheduledTimes: ['08:00', '20:00'] } as Medication;
  const today = '2026-10-07';
  const at = (date: string, time: string) => localDateTime(date, time);

  it('creates that day’s doses at the moved times', () => {
    const doses = missingDosesForDay([med], '2026-10-07', [], '2026-10-07T00:00:00Z', today, toilet);
    expect(doses.map((d) => d.scheduledTime).sort()).toEqual([at('2026-10-07', '09:00'), at('2026-10-07', '20:00')]);
    const normal = missingDosesForDay([med], '2026-10-08', [], '2026-10-08T00:00:00Z', '2026-10-08', everyday);
    expect(normal.map((d) => d.scheduledTime).sort()).toEqual([at('2026-10-08', '08:00'), at('2026-10-08', '20:00')]);
  });

  it('replaces a still-pending 8:00 dose with the 9:00 one, but keeps a dose the user already took', () => {
    const pending = { id: 'p', medicationId: 'm', scheduledTime: at('2026-10-07', '08:00'), status: 'pending' } as MedicationDose;
    expect(orphanedPendingDoses([med], '2026-10-07', [pending], today, toilet)).toEqual(['p']);
    const taken = { ...pending, status: 'taken' as const };
    expect(orphanedPendingDoses([med], '2026-10-07', [taken], today, toilet)).toEqual([]);
    // and no second, shifted dose is created on top of one the user has already answered
    const made = missingDosesForDay([med], '2026-10-07', [taken], '2026-10-07T00:00:00Z', today, toilet);
    expect(made.map((d) => d.scheduledTime)).toEqual([at('2026-10-07', '20:00')]);
  });

  it('a shifted dose counts as on time when the user takes it at the moved time (adherence)', () => {
    const scheduled = at('2026-10-07', '09:00'); // moved from 8:00
    const takenAt = new Date(scheduled);
    const status = doseStatusForNow(scheduled, takenAt, 60);
    expect(status).toBe('taken');
    const dose = { id: 'd', medicationId: 'm', scheduledTime: scheduled, actualTime: takenAt.toISOString(), status } as MedicationDose;
    const a = adherence([dose], '2026-10-07', '2026-10-07', new Date('2026-10-07T23:00:00'));
    expect(a).toMatchObject({ scheduled: 1, taken: 1, late: 0, percent: 100 });
  });

  it('is judged against the moved time, not the original one', () => {
    // taking the 9:00 dose at 9:40 is on time (within the window); the same 9:40 against 8:00 would have been late
    expect(doseStatusForNow(at('2026-10-07', '09:00'), new Date(at('2026-10-07', '09:40')), 60)).toBe('taken');
    expect(doseStatusForNow(at('2026-10-07', '08:00'), new Date(at('2026-10-07', '09:40')), 60)).toBe('taken_late');
  });
});
