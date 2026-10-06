/**
 * Dated dose changes (F-011). Pure logic. Steady only records what happened: it never suggests a change.
 */
import { uuid } from './ids';
import { pillsAt } from './medSchedule';
import { isoNow } from './time';
import type { DoseChange, ISODate, Medication } from './types';

type DoseLike = Pick<Medication, 'dosage' | 'unit' | 'unitsPerDose'> & Partial<Pick<Medication, 'scheduledTimes' | 'timeUnits'>>;

/**
 * The dose as one short text, e.g. "100 mg" or "50 mg × 2" (when the user takes more than one at a time).
 * When the pills differ by time of day (F-013) they are listed in time order: "50 mg × 1, 1, 2".
 */
export function doseText(m: DoseLike): string {
  const base = [m.dosage.trim(), m.unit.trim()].filter(Boolean).join(' ') || 'no dose entered';
  const times = [...(m.scheduledTimes ?? [])].sort();
  const counts = times.map((t) => pillsAt(m, t));
  if (counts.length > 1 && counts.some((c) => c !== counts[0])) return `${base} × ${counts.join(', ')}`;
  const per = counts.length ? counts[0] : (m.unitsPerDose ?? 1);
  return per !== 1 ? `${base} × ${per}` : base;
}

/** True when the dose (amount, unit or how many the user takes each time) differs between two versions of a medication. */
export function doseDiffers(a: DoseLike, b: DoseLike): boolean {
  return doseText(a) !== doseText(b);
}

export function newDoseChange(medicationId: string, date: ISODate, from: string, to: string, note: string | null = null): DoseChange {
  const now = isoNow();
  return { id: uuid(), medicationId, date, from: from.trim(), to: to.trim(), note: note?.trim() || null, createdAt: now, updatedAt: now };
}

/** Newest first; same day: by when it was recorded. */
export function sortDoseChanges(changes: DoseChange[]): DoseChange[] {
  return [...changes].sort((a, b) => (a.date === b.date ? (a.createdAt < b.createdAt ? 1 : -1) : a.date < b.date ? 1 : -1));
}

/** "100 mg to 150 mg". */
export function describeChange(c: Pick<DoseChange, 'from' | 'to'>): string {
  return `${c.from || 'not recorded'} to ${c.to || 'not recorded'}`;
}
