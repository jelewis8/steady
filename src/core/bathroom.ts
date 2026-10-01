/**
 * Bowel and bladder tracking (F-006). Pure logic. Kept private and matter-of-fact: plain words, no scoring.
 */
import { addDays, dateRange, daysBetween, todayKey } from './time';
import { describeChange } from './doseChanges';
import type { BathroomLog, BowelHow, DoseChange, ISODate, Medication } from './types';

export type MedicationEvent = 'started' | 'stopped' | 'dose changed';

export const BOWEL_HOW_LABELS: Record<BowelHow, string> = {
  hard: 'Hard or difficult',
  normal: 'Normal',
  loose: 'Loose',
};

/** Days since the last recorded bowel movement (0 = today), or null if none is recorded up to `today`. */
export function daysSinceLastBowel(logs: BathroomLog[], today: ISODate = todayKey()): number | null {
  let last: ISODate | null = null;
  for (const l of logs) if (l.bowel === true && l.date <= today && (!last || l.date > last)) last = l.date;
  return last == null ? null : daysBetween(last, today);
}

/** "today", "yesterday", "3 days ago". */
export function daysAgoText(days: number): string {
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  return `${days} days ago`;
}

export interface BathroomSummary {
  /** days in the period with anything recorded */
  daysWithRecord: number;
  bowelDays: number;
  /** days the user answered "no" */
  noBowelDays: number;
  how: Record<BowelHow, number>;
  /** most days in a row between recorded bowel movements (or since the last one), null if none recorded */
  longestGapDays: number | null;
  daysSinceLast: number | null;
  /** days where a number of times was recorded, and the average on those days */
  bladderDays: number;
  bladderAverage: number | null;
  hasAnything: boolean;
}

export function summarizeBathroom(logs: BathroomLog[], from: ISODate, to: ISODate, today: ISODate = todayKey()): BathroomSummary {
  const inRange = logs.filter((l) => l.date >= from && l.date <= to);
  const how: Record<BowelHow, number> = { hard: 0, normal: 0, loose: 0 };
  let bowelDays = 0;
  let noBowelDays = 0;
  let bladderDays = 0;
  let bladderTotal = 0;
  let daysWithRecord = 0;
  const bowelDates: ISODate[] = [];
  for (const l of inRange) {
    const hasBladder = (l.urinationCount ?? 0) > 0;
    if (l.bowel !== null || hasBladder) daysWithRecord++;
    if (l.bowel === true) {
      bowelDays++;
      bowelDates.push(l.date);
      if (l.bowelHow) how[l.bowelHow]++;
    } else if (l.bowel === false) noBowelDays++;
    if (hasBladder) {
      bladderDays++;
      bladderTotal += l.urinationCount;
    }
  }
  bowelDates.sort();
  let longest: number | null = null;
  if (bowelDates.length) {
    longest = 0;
    for (let i = 1; i < bowelDates.length; i++) longest = Math.max(longest, daysBetween(bowelDates[i - 1], bowelDates[i]) - 1);
    const end = to < today ? to : today;
    longest = Math.max(longest, daysBetween(bowelDates[bowelDates.length - 1], end));
  }
  return {
    daysWithRecord,
    bowelDays,
    noBowelDays,
    how,
    longestGapDays: longest,
    daysSinceLast: daysSinceLastBowel(logs, to < today ? to : today),
    bladderDays,
    bladderAverage: bladderDays ? Math.round((bladderTotal / bladderDays) * 10) / 10 : null,
    hasAnything: daysWithRecord > 0,
  };
}

/** Dates between from and to (inclusive) on which a bowel movement is recorded. */
export function bowelDates(logs: BathroomLog[], from: ISODate, to: ISODate): Set<ISODate> {
  const range = new Set(dateRange(from, to));
  return new Set(logs.filter((l) => l.bowel === true && range.has(l.date)).map((l) => l.date));
}

/**
 * The user’s own bowel and bladder records on either side of a date a medication was started, stopped or had its dose changed (F-010).
 * Plain counts only. No test, no "associated with", and no statement about any drug: nothing here claims
 * a medication affects bowel or bladder, so it needs no clinical source. The note below is shown with it.
 */
export const BOWEL_BLADDER_NOTE =
  'These are your own numbers, side by side. They don’t show whether a medication made any difference. Bowel and bladder changes can also relate to seizures, other medicines, food and drink, how much you move, and how much you drink. If you notice a change, show this to your neurologist or pharmacist. Steady doesn’t give advice about doses.';

export const COMPARE_WINDOW_DAYS = 14;
/** Fewest days with something recorded, on each side, before a comparison is shown. */
export const COMPARE_MIN_DAYS = 5;

export interface BathroomSide {
  from: ISODate;
  to: ISODate;
  summary: BathroomSummary;
}

export interface MedicationDateComparison {
  medicationId: string;
  medication: string;
  event: MedicationEvent;
  /** for a dose change: "100 mg to 150 mg" */
  detail: string | null;
  date: ISODate;
  before: BathroomSide;
  after: BathroomSide;
  /** both sides have at least COMPARE_MIN_DAYS days with a record */
  enough: boolean;
  /** other medications started or stopped within the two windows, so the user can see it isn't only one change */
  otherChanges: string[];
}

export interface MedicationDateEvent {
  medicationId: string;
  medication: string;
  event: MedicationEvent;
  detail: string | null;
  date: ISODate;
}

/** Dates in [from, to] on which a (non-rescue) medication was started, stopped or had its dose changed, from the dates the user saved. */
export function medicationDateEvents(meds: Medication[], from: ISODate, to: ISODate, doseChanges: DoseChange[] = []): MedicationDateEvent[] {
  const out: MedicationDateEvent[] = [];
  for (const m of meds) {
    if (m.isRescue) continue;
    if (m.startDate && m.startDate >= from && m.startDate <= to) out.push({ medicationId: m.id, medication: m.name, event: 'started', detail: null, date: m.startDate });
    if (m.endDate && m.endDate >= from && m.endDate <= to) out.push({ medicationId: m.id, medication: m.name, event: 'stopped', detail: null, date: m.endDate });
  }
  for (const c of doseChanges) {
    const m = meds.find((x) => x.id === c.medicationId);
    if (!m || m.isRescue || c.date < from || c.date > to) continue;
    out.push({ medicationId: m.id, medication: m.name, event: 'dose changed', detail: describeChange(c), date: c.date });
  }
  return out.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : a.medication.localeCompare(b.medication)));
}

export function compareAroundMedicationDates(
  logs: BathroomLog[],
  meds: Medication[],
  from: ISODate,
  to: ISODate,
  today: ISODate = todayKey(),
  doseChanges: DoseChange[] = [],
): MedicationDateComparison[] {
  const events = medicationDateEvents(meds, from, to, doseChanges);
  const all = medicationDateEvents(meds, '0000-01-01', '9999-12-31', doseChanges);
  return events.map((e) => {
    const beforeFrom = addDays(e.date, -COMPARE_WINDOW_DAYS);
    const beforeTo = addDays(e.date, -1);
    const afterFrom = e.date;
    const afterTo = addDays(e.date, COMPARE_WINDOW_DAYS - 1);
    const afterEnd = afterTo > today ? today : afterTo;
    const before = { from: beforeFrom, to: beforeTo, summary: summarizeBathroom(logs, beforeFrom, beforeTo, today) };
    const after = { from: afterFrom, to: afterEnd, summary: summarizeBathroom(logs, afterFrom, afterEnd, today) };
    const otherChanges = all
      .filter((o) => !(o.medicationId === e.medicationId && o.event === e.event && o.date === e.date) && o.date >= beforeFrom && o.date <= afterTo)
      .map((o) => `${o.medication} ${o.event}`);
    return {
      ...e,
      before,
      after,
      enough: before.summary.daysWithRecord >= COMPARE_MIN_DAYS && after.summary.daysWithRecord >= COMPARE_MIN_DAYS,
      otherChanges: [...new Set(otherChanges)],
    };
  });
}

/** One side as a plain sentence, for the report and the Insights card. */
export function describeSide(s: BathroomSummary): string[] {
  const days = (n: number) => `${n} ${n === 1 ? 'day' : 'days'}`;
  const out = [`Something recorded on ${days(s.daysWithRecord)}.`];
  if (s.bowelDays || s.noBowelDays) out.push(`Bowel movement on ${s.bowelDays} of the ${days(s.bowelDays + s.noBowelDays)} answered.`);
  if (s.longestGapDays != null) out.push(`Longest stretch without one: ${days(s.longestGapDays)}.`);
  if (s.bladderAverage != null) out.push(`Urination: about ${s.bladderAverage} times a day (${days(s.bladderDays)} counted).`);
  return out;
}

/** "Lamotrigine started on 4 Sep", "Lamotrigine dose changed on 4 Sep (100 mg to 150 mg)". */
export function comparisonTitle(c: Pick<MedicationDateComparison, 'medication' | 'event' | 'detail' | 'date'>, formatDate: (d: ISODate) => string): string {
  return `${c.medication} ${c.event} on ${formatDate(c.date)}${c.detail ? ` (${c.detail})` : ''}`;
}

/** Table rows for one comparison: [measure, before, after]. */
export function comparisonRows(c: MedicationDateComparison): [string, string, string][] {
  const n = (v: number) => `${v} ${v === 1 ? 'day' : 'days'}`;
  const side = (s: BathroomSummary) => ({
    recorded: n(s.daysWithRecord),
    bowel: s.bowelDays + s.noBowelDays ? `${s.bowelDays} of ${n(s.bowelDays + s.noBowelDays)} answered` : 'none answered',
    gap: s.longestGapDays == null ? '—' : n(s.longestGapDays),
    bladder: s.bladderAverage == null ? '—' : `about ${s.bladderAverage} a day`,
  });
  const b = side(c.before.summary);
  const a = side(c.after.summary);
  return [
    ['Days with something recorded', b.recorded, a.recorded],
    ['Bowel movement', b.bowel, a.bowel],
    ['Longest stretch without a bowel movement', b.gap, a.gap],
    ['Urination', b.bladder, a.bladder],
  ];
}

export { addDays };
