/**
 * Mood, depression and anxiety ratings and the "why" diary note (F-009).
 * Self-rated 1 to 5 by the person herself. Steady only counts and averages what she entered: no scoring, no risk
 * detection, no diagnosis, nothing inferred.
 */
import type { DailyCheckIn, ISODate } from './types';

export type Rating = 1 | 2 | 3 | 4 | 5;

/** A rating at or above this is counted as "high" in the report. */
export const HIGH_RATING = 4;

export interface RatingSummary {
  /** days with a rating */
  days: number;
  average: number | null;
  /** days rated 4 or 5 */
  highDays: number;
}

export interface FeelingsSummary {
  depression: RatingSummary;
  anxiety: RatingSummary;
  /** mood: 1 is very low, 5 is great, so "low" days are 1 or 2 */
  mood: RatingSummary & { lowDays: number };
  notes: { date: ISODate; text: string }[];
  hasAnything: boolean;
}

function summarizeRating(values: (number | null | undefined)[], isHigh: (n: number) => boolean): RatingSummary {
  const v = values.filter((x): x is number => typeof x === 'number');
  return {
    days: v.length,
    average: v.length ? Math.round((v.reduce((a, b) => a + b, 0) / v.length) * 10) / 10 : null,
    highDays: v.filter(isHigh).length,
  };
}

export function summarizeFeelings(checkIns: DailyCheckIn[], from: ISODate, to: ISODate): FeelingsSummary {
  const inRange = checkIns.filter((c) => c.date >= from && c.date <= to);
  const depression = summarizeRating(inRange.map((c) => c.depression), (n) => n >= HIGH_RATING);
  const anxiety = summarizeRating(inRange.map((c) => c.anxiety), (n) => n >= HIGH_RATING);
  const moodBase = summarizeRating(inRange.map((c) => c.mood), () => false);
  const lowDays = inRange.filter((c) => typeof c.mood === 'number' && c.mood <= 2).length;
  const notes = inRange
    .filter((c) => (c.feelingsNote ?? '').trim() !== '')
    .map((c) => ({ date: c.date, text: (c.feelingsNote as string).trim() }))
    .sort((a, b) => (a.date < b.date ? -1 : 1));
  return {
    depression,
    anxiety,
    mood: { ...moodBase, lowDays },
    notes,
    hasAnything: depression.days > 0 || anxiety.days > 0 || moodBase.days > 0,
  };
}

const days = (n: number) => `${n} ${n === 1 ? 'day' : 'days'}`;

/** Plain sentences for the report. Counts and averages of what she entered, nothing more. */
export function feelingsLines(s: FeelingsSummary): string[] {
  const out: string[] = [];
  if (s.depression.days) {
    out.push(`Low mood or depression, rated on ${days(s.depression.days)}: average ${s.depression.average} out of 5; rated 4 or 5 on ${days(s.depression.highDays)}.`);
  }
  if (s.anxiety.days) {
    out.push(`Anxiety, rated on ${days(s.anxiety.days)}: average ${s.anxiety.average} out of 5; rated 4 or 5 on ${days(s.anxiety.highDays)}.`);
  }
  if (s.mood.days) {
    out.push(`Overall mood (1 very low, 5 great), rated on ${days(s.mood.days)}: average ${s.mood.average}; 1 or 2 on ${days(s.mood.lowDays)}.`);
  }
  return out;
}
