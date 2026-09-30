import { describe, expect, it } from 'vitest';
import { daysAgoText, daysSinceLastBowel, summarizeBathroom } from './bathroom';
import type { BathroomLog } from './types';

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
