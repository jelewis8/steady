import { describe, expect, it } from 'vitest';
import { feelingsLines, summarizeFeelings } from './feelings';
import type { DailyCheckIn } from './types';

const ci = (date: string, over: Partial<DailyCheckIn> = {}): DailyCheckIn =>
  ({ id: date, date, stress: null, mood: null, depression: null, anxiety: null, feelingsNote: null, onPeriod: null, illness: null, alcoholDrinks: null, seizureActivityReported: null, notes: null, createdAt: '', updatedAt: '', ...over }) as DailyCheckIn;

describe('summarizeFeelings', () => {
  const list = [
    ci('2026-09-01', { depression: 2, anxiety: 4, mood: 4 }),
    ci('2026-09-02', { depression: 4, anxiety: 5, mood: 2, feelingsNote: '  Rough night, worried about the appointment ' }),
    ci('2026-09-03', { depression: 5, mood: 1 }),
    ci('2026-09-04', { anxiety: 3 }),
    ci('2026-09-05', {}), // nothing answered
    ci('2026-08-20', { depression: 5, anxiety: 5, feelingsNote: 'outside the period' }),
  ];

  it('averages and counts only what the user entered, within the period', () => {
    const s = summarizeFeelings(list, '2026-09-01', '2026-09-30');
    expect(s.depression).toEqual({ days: 3, average: 3.7, highDays: 2 });
    expect(s.anxiety).toEqual({ days: 3, average: 4, highDays: 2 });
    expect(s.mood).toMatchObject({ days: 3, average: 2.3, lowDays: 2 });
    expect(s.hasAnything).toBe(true);
  });

  it('collects the user’s written notes (only within the period, oldest first, trimmed)', () => {
    const s = summarizeFeelings(list, '2026-09-01', '2026-09-30');
    expect(s.notes).toEqual([{ date: '2026-09-02', text: 'Rough night, worried about the appointment' }]);
  });

  it('says nothing when nothing was rated (so the report leaves the section out)', () => {
    const s = summarizeFeelings([ci('2026-09-01', { stress: 3, feelingsNote: '   ' })], '2026-09-01', '2026-09-30');
    expect(s.hasAnything).toBe(false);
    expect(s.notes).toEqual([]);
    expect(feelingsLines(s)).toEqual([]);
  });

  it('copes with older check-ins that have no depression, anxiety or note fields at all', () => {
    const old = { id: 'x', date: '2026-09-01', stress: 3, mood: 3 } as DailyCheckIn;
    const s = summarizeFeelings([old], '2026-09-01', '2026-09-30');
    expect(s.depression.days).toBe(0);
    expect(s.mood.days).toBe(1);
  });

  it('writes plain sentences, with counts and no judgement', () => {
    const lines = feelingsLines(summarizeFeelings(list, '2026-09-01', '2026-09-30'));
    expect(lines).toEqual([
      'Low mood or depression, rated on 3 days: average 3.7 out of 5; rated 4 or 5 on 2 days.',
      'Anxiety, rated on 3 days: average 4 out of 5; rated 4 or 5 on 2 days.',
      'Overall mood (1 very low, 5 great), rated on 3 days: average 2.3; 1 or 2 on 2 days.',
    ]);
    expect(feelingsLines(summarizeFeelings([ci('2026-09-01', { depression: 3 })], '2026-09-01', '2026-09-30'))[0]).toContain('on 1 day:');
  });
});
