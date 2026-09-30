import { describe, expect, it } from 'vitest';
import { checkRestore, describeRestoredData, emptyExportData, type ExportData } from './exportSchema';

const med = { id: 'm1' } as ExportData['medications'][number];
const dose = (id: string) => ({ id }) as ExportData['medicationDoses'][number];

describe('restore confirmation (B-008)', () => {
  it('names seizures, medications, doses and sleep even when zero, and singularises one', () => {
    const d = emptyExportData();
    d.medications = [med];
    d.medicationDoses = [dose('a'), dose('b')];
    expect(describeRestoredData(d)).toBe('0 seizure events, 1 medication, 2 dose records, 0 sleep entries');
  });

  it('omits other empty categories', () => {
    const d = emptyExportData();
    d.hydrationLogs = [{ id: 'h' } as ExportData['hydrationLogs'][number]];
    expect(describeRestoredData(d)).toContain('1 water log');
    expect(describeRestoredData(d)).not.toContain('voice');
  });

  it('reports no problems when the device holds everything in the file (or more)', () => {
    const file = emptyExportData();
    file.medicationDoses = [dose('a')];
    const device = emptyExportData();
    device.medicationDoses = [dose('a'), dose('x')];
    expect(checkRestore(file, device, 'merge')).toEqual([]);
  });

  it('flags missing records and a missing profile', () => {
    const file = emptyExportData();
    file.medicationDoses = [dose('a'), dose('b')];
    file.userProfile = { id: 'p1' } as ExportData['userProfile'];
    const device = emptyExportData();
    device.medicationDoses = [dose('a')];
    device.userProfile = { id: 'p2' } as ExportData['userProfile'];
    const problems = checkRestore(file, device, 'replace');
    expect(problems).toContain('dose records: the backup has 2 but this device has 1');
    expect(problems).toContain('your profile was not restored');
    expect(checkRestore(file, device, 'merge')).toHaveLength(1);
  });
});
