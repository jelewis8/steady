/**
 * Local insight engine — simple, explainable statistics (no AI/ML, per CLAUDE.md).
 * Compares seizure rates on days with and without an exposure. Language is always
 * "associated with", never "caused by" (blueprint §2.7 #2).
 */
import { uuid } from './ids';
import { addDays, dateKeyOf, dateRange } from './time';
import type {
  Confidence,
  CorrelationType,
  DailyCheckIn,
  HydrationLog,
  ISODate,
  MealLog,
  MedicationDose,
  RoutineChecklistItem,
  SeizureEvent,
  SleepEntry,
  TriggerTag,
} from './types';

export interface InsightInput {
  end: ISODate;
  days: number;
  seizures: SeizureEvent[];
  doses: MedicationDose[];
  sleep: SleepEntry[];
  hydration: HydrationLog[];
  meals: MealLog[];
  checkIns: DailyCheckIn[];
  checklist: RoutineChecklistItem[];
  triggers: TriggerTag[];
  hydrationGoalMl: number;
  now?: Date;
}

export interface Insight {
  id: string;
  correlationType: CorrelationType;
  title: string;
  summary: string;
  detail: string;
  confidence: Confidence;
  /** positive association strength, used for ranking */
  strength: number;
  variables: Record<string, unknown>;
}

export interface DayFeatures {
  date: ISODate;
  seizures: number;
  sleepMinutes: number | null;
  missedDose: boolean | null;
  hydrationMl: number | null;
  mealSkipped: boolean | null;
  highStress: boolean | null;
  onPeriod: boolean | null;
}

export const SHORT_SLEEP_MINUTES = 6 * 60;

export function buildDayFeatures(input: InsightInput): DayFeatures[] {
  const start = addDays(input.end, -(input.days - 1));
  const days = dateRange(start, input.end);
  const now = input.now ?? new Date();

  const seizuresByDay = new Map<ISODate, number>();
  for (const s of input.seizures) {
    const k = dateKeyOf(s.timestamp);
    seizuresByDay.set(k, (seizuresByDay.get(k) ?? 0) + 1);
  }
  const sleepByNight = new Map(input.sleep.filter((s) => s.durationMinutes != null).map((s) => [s.date, s.durationMinutes as number]));

  const dosesByDay = new Map<ISODate, MedicationDose[]>();
  for (const d of input.doses) {
    const k = dateKeyOf(d.scheduledTime);
    const arr = dosesByDay.get(k) ?? [];
    arr.push(d);
    dosesByDay.set(k, arr);
  }
  const missedOn = (day: ISODate): boolean | null => {
    const arr = dosesByDay.get(day);
    if (!arr || arr.length === 0) return null;
    const past = arr.filter((d) => new Date(d.scheduledTime) <= now);
    if (past.length === 0) return null;
    return past.some((d) => d.status === 'skipped' || d.status === 'pending' || d.status === 'unsure');
  };

  const hydrationByDay = new Map<ISODate, number>();
  for (const h of input.hydration) {
    const k = dateKeyOf(h.timestamp);
    hydrationByDay.set(k, (hydrationByDay.get(k) ?? 0) + h.amountMl);
  }
  for (const m of input.meals) {
    if (!m.hydrationMl) continue;
    const k = dateKeyOf(m.timestamp);
    hydrationByDay.set(k, (hydrationByDay.get(k) ?? 0) + m.hydrationMl);
  }

  const mealItemsByDay = new Map<ISODate, RoutineChecklistItem[]>();
  for (const c of input.checklist) {
    if (c.category !== 'meal' || c.isOptional) continue;
    const arr = mealItemsByDay.get(c.date) ?? [];
    arr.push(c);
    mealItemsByDay.set(c.date, arr);
  }
  const mealLogsByDay = new Map<ISODate, number>();
  for (const m of input.meals) {
    if (m.mealType === 'snack') continue;
    const k = dateKeyOf(m.timestamp);
    mealLogsByDay.set(k, (mealLogsByDay.get(k) ?? 0) + 1);
  }
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const todayDate = dateKeyOf(now.toISOString());
  const mealSkippedOn = (day: ISODate): boolean | null => {
    // Today's meals that aren't due yet can't have been skipped.
    const items = mealItemsByDay.get(day)?.filter((i) => day !== todayDate || i.scheduledHour * 60 + i.scheduledMinute < nowMinutes);
    if (items && items.length > 0) return items.some((i) => i.status === 'skipped' || i.status === 'pending');
    const n = mealLogsByDay.get(day);
    if (n == null) return null;
    return n < 2;
  };

  const checkInByDay = new Map(input.checkIns.map((c) => [c.date, c]));
  const trackedHydration = hydrationByDay.size >= 7;

  return days.map((date) => {
    const prev = addDays(date, -1);
    const missedToday = missedOn(date);
    const missedPrev = missedOn(prev);
    const missed = missedToday === null && missedPrev === null ? null : Boolean(missedToday) || Boolean(missedPrev);
    const stressToday = checkInByDay.get(date)?.stress ?? null;
    const stressPrev = checkInByDay.get(prev)?.stress ?? null;
    const stress = stressToday === null && stressPrev === null ? null : (stressToday ?? 0) >= 4 || (stressPrev ?? 0) >= 4;
    return {
      date,
      seizures: seizuresByDay.get(date) ?? 0,
      sleepMinutes: sleepByNight.get(prev) ?? null,
      missedDose: missed,
      hydrationMl: trackedHydration ? (hydrationByDay.get(prev) ?? 0) : null,
      mealSkipped: (() => {
        const a = mealSkippedOn(date);
        const b = mealSkippedOn(prev);
        return a === null && b === null ? null : Boolean(a) || Boolean(b);
      })(),
      highStress: stress,
      onPeriod: checkInByDay.get(date)?.onPeriod ?? null,
    };
  });
}

interface Comparison {
  exposedDays: number;
  unexposedDays: number;
  exposedSeizures: number;
  unexposedSeizures: number;
  exposedRate: number;
  unexposedRate: number;
  ratio: number;
  /** one-sided exact binomial p-value: are seizures over-represented on exposed days? */
  pValue: number;
}

/** P(X >= k) for X ~ Binomial(n, p). */
export function binomialUpperTail(k: number, n: number, p: number): number {
  if (k <= 0) return 1;
  if (p <= 0) return 0;
  if (p >= 1) return 1;
  let pmf = Math.pow(1 - p, n); // P(X = 0)
  let cdf = 0;
  for (let i = 0; i < k; i++) {
    cdf += pmf;
    pmf = (pmf * (n - i) * p) / ((i + 1) * (1 - p));
  }
  return Math.max(0, Math.min(1, 1 - cdf));
}

export function compareExposure(features: DayFeatures[], exposure: (f: DayFeatures) => boolean | null): Comparison | null {
  let ed = 0, ud = 0, es = 0, us = 0;
  for (const f of features) {
    const e = exposure(f);
    if (e === null) continue;
    if (e) { ed++; es += f.seizures; } else { ud++; us += f.seizures; }
  }
  if (ed < 3 || ud < 3) return null;
  const exposedRate = es / ed;
  const unexposedRate = us / ud;
  // Additive smoothing avoids dividing by zero when there were no seizures on unexposed days.
  const ratio = (es + 0.5) / (ed + 1) / ((us + 0.5) / (ud + 1));
  // Under 'no association', each seizure lands on an exposed day with probability ed / (ed + ud).
  const pValue = binomialUpperTail(es, es + us, ed / (ed + ud));
  return { exposedDays: ed, unexposedDays: ud, exposedSeizures: es, unexposedSeizures: us, exposedRate, unexposedRate, ratio, pValue };
}

function confidenceFor(c: Comparison): Confidence {
  const days = c.exposedDays + c.unexposedDays;
  const seizures = c.exposedSeizures + c.unexposedSeizures;
  if (c.pValue < 0.01 && days >= 60 && seizures >= 10 && c.exposedDays >= 8 && c.ratio >= 2) return 'high';
  if (c.pValue < 0.05 && days >= 30 && seizures >= 5 && c.exposedDays >= 5) return 'moderate';
  return 'low';
}

const per30 = (rate: number) => {
  const v = rate * 30;
  return v < 1 ? v.toFixed(1) : String(Math.round(v * 10) / 10);
};

function exposureInsight(
  features: DayFeatures[],
  type: CorrelationType,
  exposure: (f: DayFeatures) => boolean | null,
  words: { title: string; exposed: string; unexposed: string },
  days: number,
): Insight | null {
  const c = compareExposure(features, exposure);
  if (!c) return null;
  // Show nothing unless the pattern is reasonably unlikely to be chance (several comparisons are made).
  if (c.exposedSeizures < 2 || c.ratio < 1.5 || c.pValue > 0.1) return null;
  const total = c.exposedSeizures + c.unexposedSeizures;
  const summary = `You logged more seizures on days ${words.exposed}.`;
  const detail =
    `${c.exposedSeizures} of your ${total} seizures happened on the ${c.exposedDays} days ${words.exposed}. ` +
    `That is about ${per30(c.exposedRate)} per 30 days, compared with ${per30(c.unexposedRate)} per 30 days ${words.unexposed}. ` +
    `This is an association in your own records, not proof of cause — worth mentioning to your neurologist.`;
  return {
    id: uuid(),
    correlationType: type,
    title: words.title,
    summary,
    detail,
    confidence: confidenceFor(c),
    strength: c.ratio * Math.log2(1 + c.exposedSeizures),
    variables: { ...c, timeRangeDays: days },
  };
}

export function triggerRanking(seizures: SeizureEvent[], triggers: TriggerTag[]): { tag: TriggerTag; count: number }[] {
  const byId = new Map(triggers.map((t) => [t.id, t]));
  const counts = new Map<string, number>();
  for (const s of seizures) for (const id of s.triggerTagIds) counts.set(id, (counts.get(id) ?? 0) + 1);
  return [...counts.entries()]
    .filter(([id]) => byId.has(id))
    .map(([id, count]) => ({ tag: byId.get(id) as TriggerTag, count }))
    .sort((a, b) => b.count - a.count);
}

export const TIME_BANDS = [
  { key: 'night', label: 'Night (midnight–6am)', from: 0, to: 6 },
  { key: 'morning', label: 'Morning (6am–noon)', from: 6, to: 12 },
  { key: 'afternoon', label: 'Afternoon (noon–6pm)', from: 12, to: 18 },
  { key: 'evening', label: 'Evening (6pm–midnight)', from: 18, to: 24 },
] as const;

export function timeOfDayCounts(seizures: SeizureEvent[]) {
  return TIME_BANDS.map((b) => ({
    ...b,
    count: seizures.filter((s) => {
      const h = new Date(s.timestamp).getHours();
      return h >= b.from && h < b.to;
    }).length,
  }));
}

export function computeInsights(input: InsightInput): Insight[] {
  const features = buildDayFeatures(input);
  const start = addDays(input.end, -(input.days - 1));
  const inRange = input.seizures.filter((s) => {
    const k = dateKeyOf(s.timestamp);
    return k >= start && k <= input.end;
  });
  const out: Insight[] = [];
  const push = (i: Insight | null) => i && out.push(i);

  push(
    exposureInsight(features, 'sleep_duration_vs_seizures', (f) => (f.sleepMinutes == null ? null : f.sleepMinutes < SHORT_SLEEP_MINUTES), {
      title: 'Sleep and seizures',
      exposed: 'after you slept less than 6 hours',
      unexposed: 'after longer nights',
    }, input.days),
  );
  push(
    exposureInsight(features, 'adherence_vs_seizures', (f) => f.missedDose, {
      title: 'Medication timing and seizures',
      exposed: 'when a dose was missed, skipped or not recorded that day or the day before',
      unexposed: 'when every dose was recorded as taken',
    }, input.days),
  );
  push(
    exposureInsight(features, 'meal_regularity_vs_seizures', (f) => f.mealSkipped, {
      title: 'Meals and seizures',
      exposed: 'when a main meal was skipped that day or the day before',
      unexposed: 'when meals were regular',
    }, input.days),
  );
  push(
    exposureInsight(
      features,
      'hydration_vs_seizures',
      (f) => (f.hydrationMl == null ? null : f.hydrationMl < input.hydrationGoalMl * 0.6),
      {
        title: 'Water and seizures',
        exposed: 'after drinking less than 60% of your water goal the day before',
        unexposed: 'after days closer to your goal',
      },
      input.days,
    ),
  );
  const stress = exposureInsight(features, 'custom', (f) => f.highStress, {
    title: 'Stress and seizures',
    exposed: 'when you rated stress 4 or 5 (that day or the day before)',
    unexposed: 'on calmer days',
  }, input.days);
  if (stress) push({ ...stress, variables: { ...stress.variables, variable: 'stress' } });
  const cycle = exposureInsight(features, 'custom', (f) => f.onPeriod, {
    title: 'Cycle and seizures',
    exposed: 'during your period',
    unexposed: 'at other times in your cycle',
  }, input.days);
  if (cycle) push({ ...cycle, variables: { ...cycle.variables, variable: 'cycle' } });

  // Time-of-day pattern
  if (inRange.length >= 5) {
    const bands = timeOfDayCounts(inRange);
    const top = [...bands].sort((a, b) => b.count - a.count)[0];
    const share = top.count / inRange.length;
    if (share >= 0.5) {
      out.push({
        id: uuid(),
        correlationType: 'time_of_day_pattern',
        title: 'Time of day',
        summary: `Most of your seizures (${top.count} of ${inRange.length}) happened in the ${top.label.split(' (')[0].toLowerCase()}.`,
        detail: `Knowing when seizures cluster can help plan medication timing and activities with your care team. Counted over the last ${input.days} days.`,
        confidence: inRange.length >= 10 && share >= 0.6 ? 'moderate' : 'low',
        strength: share * 2,
        variables: { bands, total: inRange.length },
      });
    }
  }

  // Day-of-week pattern
  if (inRange.length >= 8) {
    const dow = [0, 0, 0, 0, 0, 0, 0];
    for (const s of inRange) dow[new Date(s.timestamp).getDay()]++;
    const max = Math.max(...dow);
    const idx = dow.indexOf(max);
    if (max / inRange.length >= 0.35) {
      // 7 Jan 2024 was a Sunday, so offsetting by idx gives the weekday name.
      const name = new Date(2024, 0, 7 + idx).toLocaleDateString(undefined, { weekday: 'long' });
      out.push({
        id: uuid(),
        correlationType: 'day_of_week_pattern',
        title: 'Day of the week',
        summary: `${max} of your ${inRange.length} seizures fell on a ${name}.`,
        detail: 'A weekly pattern can point to routine differences (sleep-ins, late nights, work stress). It may also be chance.',
        confidence: 'low',
        strength: (max / inRange.length) * 1.5,
        variables: { dow },
      });
    }
  }

  // Trigger ranking
  const ranking = triggerRanking(inRange, input.triggers);
  if (ranking.length > 0 && ranking[0].count >= 2) {
    const top = ranking[0];
    out.push({
      id: uuid(),
      correlationType: 'trigger_frequency',
      title: 'Most-noted trigger',
      summary: `"${top.tag.label}" was the trigger you noted most often (${top.count} ${top.count === 1 ? 'time' : 'times'}).`,
      detail: 'This counts what you tagged when logging. Triggers are your best guess — that is still useful information for your neurologist.',
      confidence: top.count >= 5 ? 'moderate' : 'low',
      strength: 1 + top.count / 10,
      variables: { ranking: ranking.map((r) => ({ label: r.tag.label, count: r.count })) },
    });
  }

  return out.sort((a, b) => b.strength - a.strength);
}

/** How much data we have, to explain when insights will appear. */
export function dataReadiness(features: DayFeatures[]): { trackedDays: number; seizures: number; ready: boolean } {
  const trackedDays = features.filter((f) => f.sleepMinutes != null || f.missedDose != null || f.mealSkipped != null).length;
  const seizures = features.reduce((a, f) => a + f.seizures, 0);
  return { trackedDays, seizures, ready: trackedDays >= 14 && seizures >= 3 };
}
