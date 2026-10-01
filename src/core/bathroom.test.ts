import { describe, expect, it } from 'vitest';
import { BOWEL_BLADDER_NOTE, compareAroundMedicationDates, daysAgoText, daysSinceLastBowel, describeSide, medicationDateEvents, summarizeBathroom } from './bathroom';
import type { BathroomLog, Medication } from './types';

const log = (date: string, over: Partial<BathroomLog> = {}): BathroomLog => ({
  id: date, date, bowel: null, bowelHow: null, bowelNotes: null, urinationCount: 0, createdAt: '', updatedAt: '', ...over,
});

describe('daysSinceLastBowel', () => {
  it('counts from the last recorded bowel movement, ignoring "no" days and the future', () => {
    const logs = [log('2026-09-20', { bowel: true }), log('2026-09-25', { bowel: false }), log('2026-09-27', { bowel: null, urinationCount: 4 }), log('2026-10-05', { bowel: true })];
    expect(daysSinceLastBowel(logs, '2026-09-28')).toBe(8);
    expect(daysSinceLastBowel(logs, '2026-09-20')).toBe(0);
  });
  it('is null when none is recorded', () => {
    expect(daysSinceLastBowel([], '2026-09-28')).toBeNull();
    expect(daysSinceLastBowel([log('2026-09-20', { bowel: false })], '2026-09-28')).toBeNull();
  });
  it('words it plainly', () => {
    expect([0, 1, 4].map(daysAgoText)).toEqual(['today', 'yesterday', '4 days ago']);
  });
});

describe('summarizeBathroom (for the report)', () => {
  const logs = [
    log('2026-09-01', { bowel: true, bowelHow: 'normal', urinationCount: 4 }),
    log('2026-09-02', { bowel: false, urinationCount: 5 }),
    log('2026-09-03', { bowel: false }),
    log('2026-09-04', { bowel: false }),
    log('2026-09-05', { bowel: true, bowelHow: 'hard' }),
    log('2026-09-06', { bowel: true, bowelHow: 'loose', urinationCount: 3 }),
    log('2026-08-15', { bowel: true, bowelHow: 'normal' }), // outside the period
  ];

  it('counts days, textures and the longest stretch between movements', () => {
    const s = summarizeBathroom(logs, '2026-09-01', '2026-09-08', '2026-09-08');
    expect(s.hasAnything).toBe(true);
    expect(s.bowelDays).toBe(3);
    expect(s.noBowelDays).toBe(3);
    expect(s.how).toEqual({ hard: 1, normal: 1, loose: 1 });
    expect(s.longestGapDays).toBe(3); // 2nd, 3rd, 4th
    expect(s.daysSinceLast).toBe(2); // last on the 6th, period ends the 8th
    expect(s.bladderDays).toBe(3);
    expect(s.bladderAverage).toBe(4); // (4+5+3)/3
    expect(s.daysWithRecord).toBe(6);
  });

  it('includes the stretch since the last movement if it is the longest', () => {
    const s = summarizeBathroom([log('2026-09-01', { bowel: true }), log('2026-09-02', { bowel: true })], '2026-09-01', '2026-09-10', '2026-09-10');
    expect(s.longestGapDays).toBe(8);
  });

  it('does not count the future when the period ends after today', () => {
    const s = summarizeBathroom([log('2026-09-01', { bowel: true })], '2026-09-01', '2026-09-30', '2026-09-05');
    expect(s.longestGapDays).toBe(4);
  });

  it('says nothing when nothing is recorded (so the report leaves the section out)', () => {
    const s = summarizeBathroom([log('2026-09-02', { bowel: null, urinationCount: 0 })], '2026-09-01', '2026-09-08', '2026-09-08');
    expect(s.hasAnything).toBe(false);
    expect(s.longestGapDays).toBeNull();
    expect(s.bladderAverage).toBeNull();
  });
});

describe('F-010: the user’s own numbers around medication start and stop dates', () => {
  const med = (id: string, name: string, over: Partial<Medication> = {}): Medication =>
    ({ id, name, startDate: '2026-01-01', endDate: null, isRescue: false, ...over }) as Medication;
  const days = (from: number, to: number, mk: (n: number) => Partial<BathroomLog>) =>
    Array.from({ length: to - from + 1 }, (_, i) => log(`2026-09-${String(from + i).padStart(2, '0')}`, mk(from + i)));

  it('lists starts and stops inside the range, newest first, and skips rescue medication', () => {
    const meds = [med('a', 'Alpha', { startDate: '2026-09-10' }), med('b', 'Beta', { endDate: '2026-09-20' }), med('r', 'Rescue', { startDate: '2026-09-12', isRescue: true })];
    expect(medicationDateEvents(meds, '2026-09-01', '2026-09-30').map((e) => `${e.medication} ${e.event} ${e.date}`)).toEqual(['Beta stopped 2026-09-20', 'Alpha started 2026-09-10']);
    expect(medicationDateEvents(meds, '2026-09-11', '2026-09-30')).toHaveLength(1);
  });

  it('counts the 14 days before and from the date, and says when there is not enough to compare', () => {
    // before (Sep 1-14): a bowel movement every other day; after (Sep 15-28): none recorded as "no"
    const logs = [...days(1, 14, (n) => ({ bowel: n % 2 === 0, urinationCount: 5 })), ...days(15, 28, () => ({ bowel: false, urinationCount: 7 }))];
    const [c] = compareAroundMedicationDates(logs, [med('a', 'Alpha', { startDate: '2026-09-15' })], '2026-09-01', '2026-09-30', '2026-09-30');
    expect(c.enough).toBe(true);
    expect(c.before.summary.bowelDays).toBe(7);
    expect(c.after.summary.bowelDays).toBe(0);
    expect(c.after.summary.noBowelDays).toBe(14);
    expect(c.before.summary.bladderAverage).toBe(5);
    expect(c.after.summary.bladderAverage).toBe(7);
    expect(describeSide(c.after.summary)).toContain('Bowel movement on 0 of the 14 days answered.');

    const [few] = compareAroundMedicationDates(days(10, 12, () => ({ bowel: true })), [med('a', 'Alpha', { startDate: '2026-09-15' })], '2026-09-01', '2026-09-30', '2026-09-30');
    expect(few.enough).toBe(false);
  });

  it('never looks past today, and names other changes in the same weeks', () => {
    const meds = [med('a', 'Alpha', { startDate: '2026-09-25' }), med('b', 'Beta', { startDate: '2026-09-20' })];
    const [c] = compareAroundMedicationDates([], meds, '2026-09-24', '2026-09-30', '2026-09-28');
    expect(c.after.to).toBe('2026-09-28');
    expect(c.otherChanges).toEqual(['Beta started']);
  });

  it('keeps the plain, non-causal note: no drug claims, no advice', () => {
    expect(BOWEL_BLADDER_NOTE).toMatch(/don’t show whether a medication made any difference/);
    expect(BOWEL_BLADDER_NOTE).toMatch(/neurologist or pharmacist/);
    expect(BOWEL_BLADDER_NOTE).not.toMatch(/caused by|side effect of|known to|stop taking|reduce/i);
  });
});
