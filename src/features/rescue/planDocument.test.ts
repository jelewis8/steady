import { describe, expect, it } from 'vitest';
import type { Medication } from '../../core/types';
import { buildPlanDocument } from './planDocument';

const med = (over: Partial<Medication>) =>
  ({ id: 'm', name: 'Lamotrigine', dosage: '100', unit: 'mg', isActive: true, isRescue: false, scheduledTimes: ['08:00'], stopReason: null, ...over }) as Medication;

const build = (meds: Medication[]) => buildPlanDocument({ profile: undefined, plan: undefined, meds, contacts: [], emergencyNumber: '911' }).body;

describe('action plan: medications stopped after an allergic reaction (F-007)', () => {
  it('lists only medications stopped because of an allergic reaction, under Allergies', () => {
    const body = build([
      med({ id: 'a', name: 'Carbamazepine', isActive: false, stopReason: 'allergic_reaction' }),
      med({ id: 'b', name: 'Phenytoin', isActive: false, stopReason: 'side_effects' }),
      med({ id: 'c', name: 'Keppra', isActive: false, stopReason: null }),
    ]);
    expect(body).toContain('Medications stopped after an allergic reaction: Carbamazepine');
    expect(body).not.toContain('Phenytoin');
    expect(body).not.toContain('Keppra');
  });

  it('adds nothing when there are none', () => {
    expect(build([med({})])).not.toContain('allergic reaction');
  });

  it('escapes names', () => {
    expect(build([med({ name: '<b>X</b>', isActive: false, stopReason: 'allergic_reaction' })])).toContain('&lt;b&gt;X&lt;/b&gt;');
  });
});
