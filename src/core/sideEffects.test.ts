import { describe, expect, it } from 'vitest';
import {
  deterministicId,
  describeSideEffectDates,
  groupSideEffects,
  pastMedicationsForReport,
  sideEffectProblem,
  sideEffectsFromNotes,
  sortSideEffects,
} from './sideEffects';
import type { Medication, SideEffectLog } from './types';

const med = (over: Partial<Medication>) =>
  ({ id: 'm1', name: 'Lamotrigine', dosage: '100', unit: 'mg', isActive: true, startDate: '2026-01-01', endDate: null, sideEffectsNoted: [], stopReason: null, stopReasonNote: null, updatedAt: '2026-09-01T00:00:00Z', ...over }) as Medication;
const se = (over: Partial<SideEffectLog>): SideEffectLog => ({
  id: 'x', medicationId: 'm1', name: 'Dizziness', startDate: null, endDate: null, severity: null, notes: null, createdAt: '', updatedAt: '', ...over,
});

describe('deterministicId', () => {
  it('is stable, UUID-shaped, and different for different text', () => {
    const a = deterministicId('side-effect|m1|dizziness');
    expect(a).toBe(deterministicId('side-effect|m1|dizziness'));
    expect(a).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(deterministicId('side-effect|m1|nausea')).not.toBe(a);
  });
});

describe('sideEffectsFromNotes', () => {
  it('turns each old undated name into a "date unknown" entry, tidying blanks and repeats', () => {
    const rows = sideEffectsFromNotes([med({ sideEffectsNoted: ['Dizziness', ' dizziness', '', 'Nausea'] }), med({ id: 'm2', sideEffectsNoted: ['Dizziness'] })]);
    expect(rows.map((r) => [r.medicationId, r.name])).toEqual([
      ['m1', 'Dizziness'],
      ['m1', 'Nausea'],
      ['m2', 'Dizziness'],
    ]);
    expect(rows.every((r) => r.startDate === null && r.endDate === null && r.severity === null && r.notes === null)).toBe(true);
    expect(new Set(rows.map((r) => r.id)).size).toBe(3);
  });
  it('gives the same ids every time, so a second import never duplicates', () => {
    const m = med({ sideEffectsNoted: ['Nausea'] });
    expect(sideEffectsFromNotes([m])[0].id).toBe(sideEffectsFromNotes([m])[0].id);
  });
  it('copes with a medication that has no list at all (very old data)', () => {
    expect(sideEffectsFromNotes([{ id: 'm', updatedAt: '' } as Medication])).toEqual([]);
  });
});

describe('describeSideEffectDates', () => {
  it('says plainly what is known', () => {
    expect(describeSideEffectDates({ startDate: null, endDate: null })).toBe('Start date unknown');
    expect(describeSideEffectDates({ startDate: '2026-09-12', endDate: null })).toMatch(/^Started .*12.* · still happening$/);
    expect(describeSideEffectDates({ startDate: '2026-09-12', endDate: '2026-09-20' })).toMatch(/^Started .* · stopped .*20/);
    expect(describeSideEffectDates({ startDate: null, endDate: '2026-09-20' })).toMatch(/^Start date unknown · stopped/);
  });
  it('flags a stop date before the start date', () => {
    expect(sideEffectProblem('2026-09-12', '2026-09-01')).toMatch(/before/);
    expect(sideEffectProblem('2026-09-12', '2026-09-12')).toBeNull();
    expect(sideEffectProblem(null, '2026-09-12')).toBeNull();
    expect(sideEffectProblem('2026-09-12', null)).toBeNull();
  });
});

describe('ordering and grouping', () => {
  it('sorts newest first with undated entries last', () => {
    const list = sortSideEffects([se({ id: 'a', name: 'B', startDate: null }), se({ id: 'b', startDate: '2026-01-01' }), se({ id: 'c', startDate: '2026-06-01' }), se({ id: 'd', name: 'A', startDate: null })]);
    expect(list.map((x) => x.id)).toEqual(['c', 'b', 'd', 'a']);
  });

  it('groups by medication (current first, then past), then "not sure which medication"', () => {
    const meds = [med({ id: 'past', name: 'Aaa', isActive: false }), med({ id: 'cur', name: 'Zzz' }), med({ id: 'none', name: 'Mmm' })];
    const groups = groupSideEffects(
      [se({ id: '1', medicationId: 'past' }), se({ id: '2', medicationId: 'cur' }), se({ id: '3', medicationId: null }), se({ id: '4', medicationId: 'deleted-med' })],
      meds,
    );
    expect(groups.map((g) => g.medication?.id ?? null)).toEqual(['cur', 'past', null]);
    expect(groups[2].entries.map((e) => e.id).sort()).toEqual(['3', '4']);
  });
});

describe('pastMedicationsForReport (F-007)', () => {
  it('lists only stopped medications with reason, dates and their side effects', () => {
    const meds = [
      med({ id: 'cur' }),
      med({ id: 'p1', name: 'Carbamazepine', isActive: false, startDate: '2025-01-01', endDate: '2026-03-01', stopReason: 'side_effects', stopReasonNote: ' Rash ' }),
      med({ id: 'p2', name: 'Phenytoin', isActive: false, startDate: '', endDate: null }),
    ];
    const rows = pastMedicationsForReport(meds, [se({ id: 's1', medicationId: 'p1', name: 'Rash' }), se({ id: 's2', medicationId: 'cur', name: 'Other' })]);
    expect(rows.map((r) => r.medication.id)).toEqual(['p1', 'p2']); // most recently stopped first
    expect(rows[0]).toMatchObject({ reasonText: 'Side effects', note: 'Rash' });
    expect(rows[0].sideEffects.map((x) => x.name)).toEqual(['Rash']);
    expect(rows[0].period).toMatch(/^Started .* · stopped /);
    expect(rows[1]).toMatchObject({ reason: null, reasonText: 'Reason not recorded', period: 'Start date unknown' });
  });
});
