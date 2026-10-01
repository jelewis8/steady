import { describe, expect, it } from 'vitest';
import { buildMonthMarkers, daysOfMonth, describeMarkers, lastOfMonth, monthGrid, shiftMonth } from './calendar';
import { isMedicationActiveOn, missingDosesForDay } from './checklist';
import type { AuraLog, DailyCheckIn, Medication, MedicationDose, SeizureEvent, SleepEntry } from './types';

describe('monthGrid (weeks start on Monday)', () => {
  it('lays out September 2026 (starts on a Tuesday, 30 days)', () => {
    const g = monthGrid('2026-09');
    expect(g[0]).toEqual([null, '2026-09-01', '2026-09-02', '2026-09-03', '2026-09-04', '2026-09-05', '2026-09-06']);
    expect(g.every((r) => r.length === 7)).toBe(true);
    expect(g.flat().filter(Boolean)).toHaveLength(30);
    expect(g[g.length - 1]).toEqual(['2026-09-28', '2026-09-29', '2026-09-30', null, null, null, null]);
  });
  it('a month starting on Monday has no leading blanks; one starting on Sunday has six', () => {
    expect(monthGrid('2026-06')[0][0]).toBe('2026-06-01'); // Mon
    expect(monthGrid('2026-02')[0].filter((x) => x === null)).toHaveLength(6); // Sun Feb 1, 2026
  });
  it('handles leap years and month changes', () => {
    expect(daysOfMonth('2028-02')).toHaveLength(29);
    expect(lastOfMonth('2026-12')).toBe('2026-12-31');
    expect(shiftMonth('2026-12', 1)).toBe('2027-01');
    expect(shiftMonth('2026-01', -1)).toBe('2025-12');
    expect(shiftMonth('2026-09', 0)).toBe('2026-09');
  });
});

describe('buildMonthMarkers', () => {
  const now = new Date(2026, 8, 20, 12, 0); // 20 Sep 2026
  const at = (day: number, h = 10) => new Date(2026, 8, day, h, 0).toISOString();
  const seizure = (day: number) => ({ id: `s${day}`, timestamp: at(day) }) as SeizureEvent;
  const dose = (day: number, h: number, status: MedicationDose['status']) => ({ id: `d${day}${h}${status}`, scheduledTime: at(day, h), status }) as MedicationDose;

  it('counts seizures, warning signs, doses and period days on the right days', () => {
    const map = buildMonthMarkers({
      month: '2026-09',
      now,
      seizures: [seizure(3), seizure(3), seizure(10), { id: 'other-month', timestamp: new Date(2026, 7, 31, 10).toISOString() } as SeizureEvent],
      auras: [{ id: 'a', timestamp: at(5) } as AuraLog],
      doses: [dose(3, 8, 'skipped'), dose(3, 20, 'unsure'), dose(4, 8, 'pending'), dose(4, 20, 'taken'), dose(20, 8, 'pending'), dose(25, 8, 'pending')],
      sleep: [],
      checkIns: [{ date: '2026-09-07', onPeriod: true } as DailyCheckIn, { date: '2026-09-08', onPeriod: false } as DailyCheckIn],
    });
    expect(map.get('2026-09-03')).toMatchObject({ seizures: 2, dosesMissed: 2 });
    expect(map.get('2026-09-10')?.seizures).toBe(1);
    expect(map.get('2026-09-05')?.auras).toBe(1);
    expect(map.get('2026-09-04')).toMatchObject({ dosesNotRecorded: 1, dosesMissed: 0 });
    expect(map.get('2026-09-20')?.dosesNotRecorded).toBe(1); // 8:00 today has passed
    expect(map.get('2026-09-25')?.dosesNotRecorded).toBe(0); // the future is not "not recorded"
    expect(map.get('2026-09-07')?.period).toBe(true);
    expect(map.get('2026-09-08')?.period).toBe(false);
    expect(map.has('2026-08-31')).toBe(false);
  });

  it('marks short sleep on the morning after the night, only under 6 hours', () => {
    const night = (date: string, durationMinutes: number | null) => ({ date, durationMinutes }) as SleepEntry;
    const map = buildMonthMarkers({
      month: '2026-09',
      now,
      seizures: [],
      auras: [],
      doses: [],
      sleep: [night('2026-09-09', 300), night('2026-09-10', 360), night('2026-09-11', null), night('2026-08-31', 200)],
      checkIns: [],
    });
    expect(map.get('2026-09-10')?.shortSleep).toBe(true); // night of the 9th
    expect(map.get('2026-09-11')?.shortSleep).toBe(false); // exactly 6 h is not short
    expect(map.get('2026-09-12')?.shortSleep).toBe(false);
    expect(map.get('2026-09-01')?.shortSleep).toBe(true); // night of 31 Aug, morning of 1 Sep
  });

  it('describes a day in plain words, and says nothing for an empty day', () => {
    const empty = { date: '2026-09-01', seizures: 0, auras: 0, dosesMissed: 0, dosesNotRecorded: 0, shortSleep: false, period: false, bowel: false };
    expect(describeMarkers(empty)).toEqual([]);
    expect(describeMarkers({ ...empty, seizures: 1, auras: 2, dosesMissed: 1, dosesNotRecorded: 3, shortSleep: true, period: true, bowel: true })).toEqual([
      '1 seizure',
      '2 warning signs',
      '1 dose skipped or not sure',
      '3 doses not recorded',
      'short sleep the night before',
      'period',
      'bowel movement',
    ]);
  });
});

describe('medications on past days (F-003)', () => {
  const med = (over: Partial<Medication>) =>
    ({ id: 'm', isActive: true, isRescue: false, startDate: '2026-01-01', endDate: null, scheduledTimes: ['08:00'], ...over }) as Medication;
  const today = '2026-09-20';

  it('a current medication is active from its start date', () => {
    expect(isMedicationActiveOn(med({}), '2026-09-10', today)).toBe(true);
    expect(isMedicationActiveOn(med({}), '2025-12-31', today)).toBe(false);
  });
  it('a medication stopped on 10 Sep was being taken before that, and is not scheduled today', () => {
    const stopped = med({ isActive: false, endDate: '2026-09-10' });
    expect(isMedicationActiveOn(stopped, '2026-09-05', today)).toBe(true);
    expect(isMedicationActiveOn(stopped, '2026-09-10', today)).toBe(true);
    expect(isMedicationActiveOn(stopped, '2026-09-11', today)).toBe(false);
    expect(isMedicationActiveOn(stopped, today, today)).toBe(false);
  });
  it('a medication stopped today is not scheduled again today', () => {
    expect(isMedicationActiveOn(med({ isActive: false, endDate: today }), today, today)).toBe(false);
  });
  it('a stopped medication with no stop date, and rescue medications, are never scheduled', () => {
    expect(isMedicationActiveOn(med({ isActive: false, endDate: null }), '2026-09-05', today)).toBe(false);
    expect(isMedicationActiveOn(med({ isRescue: true }), '2026-09-05', today)).toBe(false);
  });
  it('doses generated for a past day cover medications the user has since stopped', () => {
    const doses = missingDosesForDay([med({ id: 'old', isActive: false, endDate: '2026-09-10' }), med({ id: 'cur' })], '2026-09-05', [], '2026-09-20T00:00:00Z', today);
    expect(doses.map((d) => d.medicationId).sort()).toEqual(['cur', 'old']);
  });
});
