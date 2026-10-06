/**
 * When a medication is taken and how many pills at each time (F-013, F-014). Pure logic.
 * Steady only records what the user entered from their prescription. It never suggests a schedule or a dose.
 */
import { daysBetween, fromDateKey } from './time';
import type { ISODate, ISOTime, MedRepeat, Medication } from './types';

export const WEEKDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export const WEEKDAY_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
/** Monday first, as in the calendar. */
export const WEEKDAY_ORDER = [1, 2, 3, 4, 5, 6, 0];

type Sched = Pick<Medication, 'scheduledTimes' | 'unitsPerDose' | 'timeUnits' | 'repeat'>;

/** Records saved before 1.7.0 have no `repeat`: they are taken every day. */
export function repeatOf(m: Pick<Medication, 'repeat'>): MedRepeat {
  const r = m.repeat;
  if (!r) return { kind: 'daily' };
  if (r.kind === 'weekdays' && Array.isArray(r.days) && r.days.length > 0 && r.days.length < 7) return r;
  if (r.kind === 'everyN' && r.n >= 2 && r.from) return r;
  return { kind: 'daily' };
}

export function isMedDueOn(m: Pick<Medication, 'repeat'>, date: ISODate): boolean {
  const r = repeatOf(m);
  if (r.kind === 'weekdays') return r.days.includes(fromDateKey(date).getDay());
  if (r.kind === 'everyN') {
    const diff = daysBetween(r.from, date);
    return diff % r.n === 0; // dates before `from` count back the same way, so past days stay consistent
  }
  return true;
}

/** Pills at one scheduled time. */
export function pillsAt(m: Pick<Medication, 'unitsPerDose' | 'timeUnits'>, time: ISOTime): number {
  const v = m.timeUnits?.[time];
  return typeof v === 'number' && v > 0 ? v : m.unitsPerDose || 1;
}

/** Pills in a day on which it is taken. */
export function pillsPerDueDay(m: Sched): number {
  return m.scheduledTimes.reduce((sum, t) => sum + pillsAt(m, t), 0);
}

/** Average pills per calendar day, counting days off. Used for the supply estimate. */
export function pillsPerDayAverage(m: Sched): number {
  const r = repeatOf(m);
  const share = r.kind === 'weekdays' ? r.days.length / 7 : r.kind === 'everyN' ? 1 / r.n : 1;
  return pillsPerDueDay(m) * share;
}

/** True when the number of pills is not simply "1 every time", so the checklist should say it. */
export function showsPills(m: Sched): boolean {
  return m.scheduledTimes.some((t) => pillsAt(m, t) !== 1);
}

/** Short words for the pill count: "1 pill", "2 pills", "half a pill". */
export function pillsWords(n: number): string {
  if (n === 0.5) return 'half a pill';
  return `${n} ${n === 1 ? 'pill' : 'pills'}`;
}

/** "Every day", "Mon, Tue, Fri" or "Every other day" / "Every 3rd day". */
export function describeRepeat(m: Pick<Medication, 'repeat'>): string {
  const r = repeatOf(m);
  if (r.kind === 'weekdays') return WEEKDAY_ORDER.filter((d) => r.days.includes(d)).map((d) => WEEKDAY_SHORT[d]).join(', ');
  if (r.kind === 'everyN') return r.n === 2 ? 'Every other day' : `Every ${r.n}${r.n === 3 ? 'rd' : 'th'} day`;
  return 'Every day';
}

/** What the medication list shows under the name, without clock times, e.g. "Every day · 1, 1 and 2 pills". */
export function pillsSummary(m: Sched): string | null {
  if (!showsPills(m)) return null;
  const parts = m.scheduledTimes.map((t) => pillsAt(m, t));
  return parts.join(', ') + (parts.every((p) => p === 1) ? '' : ' pills');
}

/** The next time units for edits: renaming a time keeps its pill count. Returns a map holding only counts that differ. */
export function compactTimeUnits(times: ISOTime[], perTime: number[], unitsPerDose: number): Record<ISOTime, number> {
  const out: Record<ISOTime, number> = {};
  times.forEach((t, i) => {
    if (perTime[i] !== unitsPerDose) out[t] = perTime[i];
  });
  return out;
}

/** The whole schedule as plain text for reports and the action plan: "09:00, 13:00, 21:00 (2 pills) · Mon, Tue, Fri". */
export function scheduleText(m: Sched): string {
  const times = [...m.scheduledTimes].sort();
  const withPills = showsPills(m);
  const list = times.map((t) => (withPills ? `${t} (${pillsWords(pillsAt(m, t))})` : t)).join(', ');
  const r = repeatOf(m);
  return r.kind === 'daily' ? list : `${list} · ${describeRepeat(m)}`;
}
