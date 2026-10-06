import { describe, expect, it } from 'vitest';
import { adherence, seizureBuckets, supplyEstimate } from './stats';
import { buildEnvelope, emptyExportData, parseEnvelope, seizuresCsv, toCsv } from './exportSchema';
import { addDays, dateRange, localDateTime, resolveDoneTime, sleepDurationMinutes } from './time';
import { SCHEMA_VERSION } from './defaults';
import type { Medication, MedicationDose } from './types';

describe('time helpers', () => {
  it('handles sleep across midnight', () => {
    expect(sleepDurationMinutes('23:00', '07:00')).toBe(480);
    expect(sleepDurationMinutes('01:00', '07:30')).toBe(390);
  });
  it('puts a midnight bedtime on the next day, and an evening time on the same day', () => {
    const bed = 22 * 60 + 30;
    expect(resolveDoneTime('2026-10-05', bed, '00:00').toISOString()).toBe(localDateTime('2026-10-06', '00:00'));
    expect(resolveDoneTime('2026-10-05', bed, '00:45').toISOString()).toBe(localDateTime('2026-10-06', '00:45'));
    expect(resolveDoneTime('2026-10-05', bed, '23:15').toISOString()).toBe(localDateTime('2026-10-05', '23:15'));
    expect(resolveDoneTime('2026-10-05', 9 * 60, '08:30').toISOString()).toBe(localDateTime('2026-10-05', '08:30'));
  });
  it('builds inclusive date ranges', () => {
    expect(dateRange('2026-09-25', '2026-09-27')).toEqual(['2026-09-25', '2026-09-26', '2026-09-27']);
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
  });
});

describe('adherence', () => {
  const dose = (time: string, status: MedicationDose['status']): MedicationDose => ({
    id: time + status, medicationId: 'm', scheduledTime: localDateTime('2026-09-27', time), actualTime: null, status,
    sideEffects: [], notes: null, createdAt: '',
  });
  it('counts late doses as taken and ignores future doses', () => {
    const now = new Date(localDateTime('2026-09-27', '12:00'));
    const s = adherence([dose('08:00', 'taken'), dose('09:00', 'taken_late'), dose('10:00', 'skipped'), dose('20:00', 'pending')], '2026-09-27', '2026-09-27', now);
    expect(s.scheduled).toBe(3);
    expect(s.percent).toBe(67);
  });
  it('returns null percent with nothing scheduled', () => {
    expect(adherence([], '2026-09-27', '2026-09-27').percent).toBeNull();
  });
});

describe('supplyEstimate', () => {
  it('estimates days left from remaining count', () => {
    const med = { scheduledTimes: ['08:00', '20:00'], unitsPerDose: 1, remainingCount: 13, refillReminderDays: 7, refillDate: null } as unknown as Medication;
    const s = supplyEstimate(med, '2026-09-27');
    expect(s.daysLeft).toBe(6);
    expect(s.needsRefill).toBe(true);
  });
});

describe('seizureBuckets', () => {
  it('uses weekly buckets for long ranges', () => {
    expect(seizureBuckets([], '2026-07-01', '2026-09-27').length).toBeLessThanOrEqual(13);
    expect(seizureBuckets([], '2026-09-01', '2026-09-27')).toHaveLength(27);
  });
});

describe('export envelope', () => {
  it('round-trips and stamps the schema version', () => {
    const env = buildEnvelope(emptyExportData(), '2026-09-27T12:00:00Z');
    const parsed = parseEnvelope(JSON.parse(JSON.stringify(env)));
    expect(parsed.ok).toBe(true);
    if (parsed.ok) expect(parsed.envelope.schemaVersion).toBe(SCHEMA_VERSION);
  });
  it('rejects files from a newer major version', () => {
    const parsed = parseEnvelope({ schemaVersion: '9.0.0', data: {} });
    expect(parsed.ok).toBe(false);
  });
  it('migrates 1.0.0 medications with defaults', () => {
    const parsed = parseEnvelope({ schemaVersion: '1.0.0', data: { medications: [{ id: 'x', name: 'A', scheduledTimes: [] }] } });
    expect(parsed.ok && parsed.envelope.data.medications[0].unitsPerDose).toBe(1);
  });
  it('rejects garbage', () => {
    expect(parseEnvelope('nope').ok).toBe(false);
    expect(parseEnvelope({ foo: 1 }).ok).toBe(false);
  });
  it('escapes CSV correctly', () => {
    expect(toCsv([{ a: 'x,"y"', b: ['1', '2'] }], ['a', 'b'])).toBe('a,b\r\n"x,""y""",1; 2');
    expect(seizuresCsv(emptyExportData()).split('\r\n')[0]).toContain('timestamp');
  });
});
