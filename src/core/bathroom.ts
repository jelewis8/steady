/**
 * Bowel and bladder tracking (F-006). Pure logic. Kept private and matter-of-fact: plain words, no scoring.
 */
import { addDays, dateRange, daysBetween, todayKey } from './time';
import type { BathroomLog, BowelHow, ISODate } from './types';

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
  /** days she answered "no" */
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

export { addDays };
