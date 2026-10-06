import { pillsPerDayAverage } from './medSchedule';
import { addDays, dateKeyOf, dateRange, daysBetween, fromDateKey, todayKey } from './time';
import type { ISODate, Medication, MedicationDose, SeizureEvent, SleepEntry } from './types';

export interface AdherenceSummary {
  scheduled: number;
  taken: number;
  late: number;
  skipped: number;
  unsure: number;
  notRecorded: number;
  /** null when there is nothing scheduled yet */
  percent: number | null;
}

/** Adherence across doses whose scheduled time has passed. Late doses count as taken. */
export function adherence(doses: MedicationDose[], from: ISODate, to: ISODate, now: Date = new Date()): AdherenceSummary {
  const s: AdherenceSummary = { scheduled: 0, taken: 0, late: 0, skipped: 0, unsure: 0, notRecorded: 0, percent: null };
  for (const d of doses) {
    const day = dateKeyOf(d.scheduledTime);
    if (day < from || day > to) continue;
    const past = new Date(d.scheduledTime).getTime() <= now.getTime();
    if (!past && d.status === 'pending') continue;
    s.scheduled++;
    if (d.status === 'taken') s.taken++;
    else if (d.status === 'taken_late') s.late++;
    else if (d.status === 'skipped') s.skipped++;
    else if (d.status === 'unsure') s.unsure++;
    else s.notRecorded++;
  }
  s.percent = s.scheduled === 0 ? null : Math.round(((s.taken + s.late) / s.scheduled) * 100);
  return s;
}

export function adherenceByDay(doses: MedicationDose[], from: ISODate, to: ISODate, now: Date = new Date()) {
  const map = new Map<ISODate, AdherenceSummary>();
  for (const day of dateRange(from, to)) map.set(day, adherence([], day, day, now));
  const byDay = new Map<ISODate, MedicationDose[]>();
  for (const d of doses) {
    const k = dateKeyOf(d.scheduledTime);
    if (k < from || k > to) continue;
    const arr = byDay.get(k) ?? [];
    arr.push(d);
    byDay.set(k, arr);
  }
  for (const [k, arr] of byDay) map.set(k, adherence(arr, k, k, now));
  return map;
}

/** How many pills/units are taken per dose: "2", "1.5", "0,5" → number; empty, zero, negative or text → null. */
export function parseUnitsPerDose(text: string): number | null {
  const n = Number(text.trim().replace(',', '.'));
  return text.trim() !== '' && Number.isFinite(n) && n > 0 && n <= 100 ? n : null;
}

export interface DoseNoteRow {
  doseId: string;
  when: string;
  medication: string;
  note: string;
  sideEffects: string[];
}

/** Doses that have a note or side effects recorded with them, oldest first. Works for current and past medications. */
export function doseNotesForReport(doses: MedicationDose[], meds: Medication[]): DoseNoteRow[] {
  const name = new Map(meds.map((m) => [m.id, `${m.name} ${m.dosage}${m.unit}`.trim()]));
  return doses
    .filter((d) => (d.notes ?? '').trim() !== '' || (d.sideEffects ?? []).length > 0)
    .sort((a, b) => (a.scheduledTime < b.scheduledTime ? -1 : 1))
    .map((d) => ({
      doseId: d.id,
      when: d.actualTime && d.status !== 'pending' ? d.actualTime : d.scheduledTime,
      medication: name.get(d.medicationId) ?? 'Medication no longer listed',
      note: (d.notes ?? '').trim(),
      sideEffects: d.sideEffects ?? [],
    }));
}

export interface SupplyEstimate {
  daysLeft: number | null;
  runOutDate: ISODate | null;
  needsRefill: boolean;
}

export function supplyEstimate(med: Medication, today: ISODate = todayKey()): SupplyEstimate {
  const perDay = pillsPerDayAverage(med);
  if (med.remainingCount == null || perDay === 0) {
    if (med.refillDate) {
      const daysLeft = daysBetween(today, med.refillDate);
      return { daysLeft, runOutDate: med.refillDate, needsRefill: daysLeft <= med.refillReminderDays };
    }
    return { daysLeft: null, runOutDate: null, needsRefill: false };
  }
  const daysLeft = Math.floor(med.remainingCount / perDay);
  return {
    daysLeft,
    runOutDate: addDays(today, daysLeft),
    needsRefill: daysLeft <= med.refillReminderDays,
  };
}

export function seizuresInRange(seizures: SeizureEvent[], from: ISODate, to: ISODate): SeizureEvent[] {
  return seizures.filter((s) => {
    const k = dateKeyOf(s.timestamp);
    return k >= from && k <= to;
  });
}

export function seizureCountsByDay(seizures: SeizureEvent[], from: ISODate, to: ISODate): Map<ISODate, number> {
  const map = new Map<ISODate, number>(dateRange(from, to).map((d) => [d, 0]));
  for (const s of seizures) {
    const k = dateKeyOf(s.timestamp);
    if (map.has(k)) map.set(k, (map.get(k) ?? 0) + 1);
  }
  return map;
}

export interface Bucket {
  label: string;
  start: ISODate;
  end: ISODate;
  count: number;
}

/** Group a range into day buckets (≤31 days) or week buckets (longer). */
export function seizureBuckets(seizures: SeizureEvent[], from: ISODate, to: ISODate): Bucket[] {
  const total = daysBetween(from, to) + 1;
  const byDay = seizureCountsByDay(seizures, from, to);
  const buckets: Bucket[] = [];
  const size = total <= 31 ? 1 : 7;
  for (let start = from; start <= to; start = addDays(start, size)) {
    let end = addDays(start, size - 1);
    if (end > to) end = to;
    let count = 0;
    for (const d of dateRange(start, end)) count += byDay.get(d) ?? 0;
    const date = fromDateKey(start);
    const label =
      size === 1
        ? date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
        : `Wk of ${date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`;
    buckets.push({ label, start, end, count });
  }
  return buckets;
}

export function lastSeizure(seizures: SeizureEvent[]): SeizureEvent | null {
  let last: SeizureEvent | null = null;
  for (const s of seizures) if (!last || s.timestamp > last.timestamp) last = s;
  return last;
}

export function daysSinceLastSeizure(seizures: SeizureEvent[], today: ISODate = todayKey()): number | null {
  const last = lastSeizure(seizures);
  return last ? daysBetween(dateKeyOf(last.timestamp), today) : null;
}

export function averageSleepMinutes(entries: SleepEntry[], from: ISODate, to: ISODate): number | null {
  const vals = entries.filter((e) => e.date >= from && e.date <= to && e.durationMinutes != null).map((e) => e.durationMinutes as number);
  if (vals.length === 0) return null;
  return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
}
