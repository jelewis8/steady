import { describe, expect, it } from 'vitest';
import { binomialUpperTail, buildDayFeatures, compareExposure, computeInsights, dataReadiness, triggerRanking } from './insights';
import { addDays, localDateTime } from './time';
import type { SeizureEvent, SleepEntry, TriggerTag } from './types';

const END = '2026-09-27';
const NOW = '2026-09-27T12:00:00.000Z';

function seizure(date: string, hour = 7, triggerTagIds: string[] = []): SeizureEvent {
  const ts = localDateTime(date, `${String(hour).padStart(2, '0')}:00`);
  return {
    id: `${date}-${hour}`, timestamp: ts, endTimestamp: null, type: 'focal_aware', durationSeconds: 60, severity: 2,
    auraIds: [], postIctalSymptoms: [], triggerTagIds, location: null, activityAtOnset: null, rescueMedicationUsed: false,
    rescueMedicationDetails: null, observerPresent: null, observerNotes: null, voiceNoteUri: null, notes: null,
    isQuickLog: false, createdAt: ts, updatedAt: ts,
  };
}

function night(date: string, minutes: number): SleepEntry {
  return {
    id: date, date, targetBedtime: '22:30', actualBedtime: '23:00', targetWakeTime: '07:00', actualWakeTime: '07:00',
    durationMinutes: minutes, qualityRating: 3, interruptions: 0, windDownCompleted: false, notes: null, createdAt: NOW,
  };
}

function scenario() {
  const sleep: SleepEntry[] = [];
  const seizures: SeizureEvent[] = [];
  for (let i = 0; i < 60; i++) {
    const date = addDays(END, -i);
    const short = i % 6 === 0;
    sleep.push(night(addDays(date, -1), short ? 300 : 460));
    if (short) seizures.push(seizure(date));
  }
  seizures.push(seizure(addDays(END, -3), 15));
  return { sleep, seizures };
}

const base = { end: END, days: 60, doses: [], hydration: [], meals: [], checkIns: [], checklist: [], triggers: [], hydrationGoalMl: 2000, now: new Date(NOW) };

describe('insight engine', () => {
  it('finds the sleep association with plain, non-causal language', () => {
    const { sleep, seizures } = scenario();
    const out = computeInsights({ ...base, sleep, seizures });
    const s = out.find((i) => i.correlationType === 'sleep_duration_vs_seizures');
    expect(s).toBeDefined();
    expect(s!.summary).toMatch(/less than 6 hours/);
    expect(s!.detail).toMatch(/not proof of cause/);
    expect(['moderate', 'high']).toContain(s!.confidence);
  });

  it('reports nothing when there is no association', () => {
    const sleep = Array.from({ length: 60 }, (_, i) => night(addDays(END, -i - 1), i % 5 === 0 ? 300 : 460));
    const seizures = [seizure(addDays(END, -10)), seizure(addDays(END, -11)), seizure(addDays(END, -12))];
    const out = computeInsights({ ...base, sleep, seizures });
    expect(out.find((i) => i.correlationType === 'sleep_duration_vs_seizures')).toBeUndefined();
  });

  it('needs a minimum number of days on each side', () => {
    const f = buildDayFeatures({ ...base, days: 4, sleep: [night(addDays(END, -1), 300)], seizures: [] });
    expect(compareExposure(f, (x) => (x.sleepMinutes == null ? null : x.sleepMinutes < 360))).toBeNull();
  });

  it('computes exact binomial tails', () => {
    expect(binomialUpperTail(0, 5, 0.3)).toBe(1);
    expect(binomialUpperTail(3, 3, 0.5)).toBeCloseTo(0.125);
    expect(binomialUpperTail(2, 3, 0.5)).toBeCloseTo(0.5);
  });

  it('does not surface a chance pattern from a handful of seizures', () => {
    // 2 of 3 seizures on 10 of 60 "exposed" days: ratio looks big, but it could easily be chance.
    const sleep = Array.from({ length: 60 }, (_, i) => night(addDays(END, -i - 1), i % 6 === 0 ? 300 : 460));
    const seizures = [seizure(END), seizure(addDays(END, -6)), seizure(addDays(END, -20))];
    const out = computeInsights({ ...base, sleep, seizures });
    const s = out.find((i) => i.correlationType === 'sleep_duration_vs_seizures');
    expect(s === undefined || s.confidence === 'low').toBe(true);
  });

  it('ranks triggers by frequency', () => {
    const tags: TriggerTag[] = [
      { id: 'a', label: 'Stress', category: 'stress', isBuiltIn: true, createdAt: NOW },
      { id: 'b', label: 'Poor sleep', category: 'sleep', isBuiltIn: true, createdAt: NOW },
    ];
    const r = triggerRanking([seizure(END, 7, ['a', 'b']), seizure(END, 9, ['b'])], tags);
    expect(r.map((x) => x.tag.label)).toEqual(['Poor sleep', 'Stress']);
  });

  it('explains readiness when data is thin', () => {
    const f = buildDayFeatures({ ...base, days: 30, sleep: [], seizures: [] });
    expect(dataReadiness(f).ready).toBe(false);
  });
});
