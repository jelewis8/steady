import { describe, expect, it } from 'vitest';
import {
  buildChecklistView,
  doseStatusForNow,
  missingDosesForDay,
  orphanedPendingDoses,
  routineConsistency,
  selectTemplate,
  syncDayItems,
} from './checklist';
import { buildDefaultTemplates } from './defaults';
import { localDateTime } from './time';
import type { Medication, RoutineTemplate } from './types';

const NOW = '2026-09-27T12:00:00.000Z';

function med(partial: Partial<Medication> = {}): Medication {
  return {
    id: 'm1', name: 'Lamotrigine', genericName: null, dosage: '100', unit: 'mg', frequency: 'twice daily',
    scheduledTimes: ['08:00', '20:00'], prescriber: null, pharmacy: null, remainingCount: 10, unitsPerDose: 1,
    refillDate: null, refillReminderDays: 7, isActive: true, isRescue: false, startDate: '2026-01-01', endDate: null,
    sideEffectsNoted: [], notes: null, stopReason: null, stopReasonNote: null, createdAt: NOW, updatedAt: NOW, ...partial,
  };
}

describe('selectTemplate', () => {
  const [everyday, rest] = buildDefaultTemplates(NOW);
  it('uses the template assigned to the weekday', () => {
    expect(selectTemplate([rest, everyday], '2026-09-27')?.id).toBe(everyday.id);
  });
  it('honours a day plan override (e.g. rest day)', () => {
    expect(selectTemplate([everyday, rest], '2026-09-27', { date: '2026-09-27', templateId: rest.id })?.id).toBe(rest.id);
  });
  it('falls back to the default template', () => {
    const t: RoutineTemplate = { ...everyday, applicableDays: [] };
    expect(selectTemplate([rest, t], '2026-09-27')?.id).toBe(t.id);
  });
  it('returns null with no templates', () => {
    expect(selectTemplate([], '2026-09-27')).toBeNull();
  });
});

describe('syncDayItems', () => {
  const [everyday] = buildDefaultTemplates(NOW);
  it('instantiates every template item once', () => {
    const { toAdd } = syncDayItems(everyday, '2026-09-27', [], NOW);
    expect(toAdd).toHaveLength(everyday.items.length);
    const again = syncDayItems(everyday, '2026-09-27', toAdd, NOW);
    expect(again.toAdd).toHaveLength(0);
    expect(again.toRemoveIds).toHaveLength(0);
  });
  it('never removes completed history when the template changes', () => {
    const { toAdd } = syncDayItems(everyday, '2026-09-27', [], NOW);
    toAdd[0].status = 'done';
    const trimmed = { ...everyday, items: [] };
    const res = syncDayItems(trimmed, '2026-09-27', toAdd, NOW);
    expect(res.toRemoveIds).not.toContain(toAdd[0].id);
    expect(res.toRemoveIds).toHaveLength(toAdd.length - 1);
  });
  it('updates pending items when their time changes', () => {
    const { toAdd } = syncDayItems(everyday, '2026-09-27', [], NOW);
    const edited = { ...everyday, items: everyday.items.map((i, idx) => (idx === 0 ? { ...i, hour: 5 } : i)) };
    const res = syncDayItems(edited, '2026-09-27', toAdd, NOW);
    expect(res.toUpdate).toHaveLength(1);
    expect(res.toUpdate[0].scheduledHour).toBe(5);
  });
});

describe('medication doses', () => {
  it('creates one dose per scheduled time', () => {
    const doses = missingDosesForDay([med()], '2026-09-27', [], NOW);
    expect(doses).toHaveLength(2);
    expect(doses.every((d) => d.status === 'pending')).toBe(true);
  });
  it('is idempotent', () => {
    const first = missingDosesForDay([med()], '2026-09-27', [], NOW);
    expect(missingDosesForDay([med()], '2026-09-27', first, NOW)).toHaveLength(0);
  });
  it('skips inactive, rescue, future-start and ended medications', () => {
    const meds = [
      med({ id: 'a', isActive: false }),
      med({ id: 'b', isRescue: true }),
      med({ id: 'c', startDate: '2026-10-01' }),
      med({ id: 'd', endDate: '2026-09-01' }),
    ];
    expect(missingDosesForDay(meds, '2026-09-27', [], NOW)).toHaveLength(0);
  });
  it('flags pending doses orphaned by a schedule change', () => {
    const doses = missingDosesForDay([med()], '2026-09-27', [], NOW);
    const orphans = orphanedPendingDoses([med({ scheduledTimes: ['09:00'] })], '2026-09-27', doses);
    expect(orphans).toHaveLength(2);
  });
  it('marks a dose late only after the window', () => {
    const sched = localDateTime('2026-09-27', '08:00');
    const at = (mins: number) => new Date(new Date(sched).getTime() + mins * 60000);
    expect(doseStatusForNow(sched, at(30), 60)).toBe('taken');
    expect(doseStatusForNow(sched, at(90), 60)).toBe('taken_late');
  });
});

describe('buildChecklistView', () => {
  const [everyday] = buildDefaultTemplates(NOW);
  const date = '2026-09-27';
  const items = syncDayItems(everyday, date, [], NOW).toAdd;
  const doses = missingDosesForDay([med()], date, [], NOW);
  const noon = new Date(localDateTime(date, '12:00'));

  it('merges doses and routine items in time order', () => {
    const v = buildChecklistView({ date, items, doses, meds: [med()], now: noon, isToday: true });
    const minutes = v.entries.map((e) => e.minutes);
    expect(minutes).toEqual([...minutes].sort((a, b) => a - b));
    expect(v.entries.filter((e) => e.kind === 'dose')).toHaveLength(2);
  });
  it('surfaces past pending items as "still open" rather than failed', () => {
    const v = buildChecklistView({ date, items, doses, meds: [med()], now: noon, isToday: true });
    expect(v.stillOpen.some((e) => e.kind === 'dose' && e.scheduledMinutes === 8 * 60)).toBe(true);
    expect(v.entries.every((e) => ['pending', 'done', 'skipped', 'deferred', 'unsure'].includes(e.status))).toBe(true);
  });
  it('essentials-only keeps medications and essential items', () => {
    const v = buildChecklistView({ date, items, doses, meds: [med()], now: noon, isToday: true, essentialsOnly: true });
    expect(v.entries.every((e) => e.category === 'medication' || e.isEssential)).toBe(true);
  });
  it('counts optional items only when completed', () => {
    const v = buildChecklistView({ date, items, doses, meds: [med()], now: noon, isToday: true });
    const required = v.entries.filter((e) => !e.isOptional).length;
    expect(v.total).toBe(required);
  });
});

describe('routineConsistency', () => {
  it('counts a run of good days and never reports failure', () => {
    const res = routineConsistency(
      [
        { date: '2026-09-26', percent: 90, total: 10 },
        { date: '2026-09-25', percent: 100, total: 10 },
        { date: '2026-09-24', percent: 20, total: 10 },
      ],
      '2026-09-27',
    );
    expect(res).toEqual({ run: 2, pickBackUp: false });
  });
  it('suggests picking back up after a gap', () => {
    const res = routineConsistency([{ date: '2026-09-26', percent: 40, total: 10 }], '2026-09-27');
    expect(res.pickBackUp).toBe(true);
  });
});
