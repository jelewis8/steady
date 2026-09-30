/**
 * Calendar view (F-004). Pure logic: which markers does each day of a month get, and how is the month laid out.
 * Weeks start on Monday.
 */
import { SHORT_SLEEP_MINUTES } from './insights';
import { addDays, dateKeyOf, dateRange, fromDateKey, toDateKey } from './time';
import type { AuraLog, DailyCheckIn, ISODate, MedicationDose, SeizureEvent, SleepEntry } from './types';

/** "YYYY-MM" */
export type MonthKey = string;

export interface DayMarkers {
  date: ISODate;
  seizures: number;
  auras: number;
  /** doses recorded as skipped or "not sure" */
  dosesMissed: number;
  /** doses whose time has passed with nothing recorded */
  dosesNotRecorded: number;
  /** the night before this day was under 6 hours */
  shortSleep: boolean;
  period: boolean;
}

export function monthKeyOf(date: ISODate): MonthKey {
  return date.slice(0, 7);
}

export function shiftMonth(month: MonthKey, delta: number): MonthKey {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function monthLabel(month: MonthKey): string {
  const [y, m] = month.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
}

export function firstOfMonth(month: MonthKey): ISODate {
  return `${month}-01`;
}

export function lastOfMonth(month: MonthKey): ISODate {
  return addDays(firstOfMonth(shiftMonth(month, 1)), -1);
}

export function daysOfMonth(month: MonthKey): ISODate[] {
  return dateRange(firstOfMonth(month), lastOfMonth(month));
}

/** Rows of 7 (Monday first). Days outside the month are null. */
export function monthGrid(month: MonthKey): (ISODate | null)[][] {
  const days = daysOfMonth(month);
  const mondayIndex = (fromDateKey(days[0]).getDay() + 6) % 7; // Mon = 0
  const cells: (ISODate | null)[] = [...Array<null>(mondayIndex).fill(null), ...days];
  while (cells.length % 7 !== 0) cells.push(null);
  const rows: (ISODate | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));
  return rows;
}

export function buildMonthMarkers(input: {
  month: MonthKey;
  seizures: SeizureEvent[];
  auras: AuraLog[];
  doses: MedicationDose[];
  sleep: SleepEntry[];
  checkIns: DailyCheckIn[];
  now?: Date;
}): Map<ISODate, DayMarkers> {
  const now = input.now ?? new Date();
  const days = daysOfMonth(input.month);
  const map = new Map<ISODate, DayMarkers>(
    days.map((date) => [date, { date, seizures: 0, auras: 0, dosesMissed: 0, dosesNotRecorded: 0, shortSleep: false, period: false }]),
  );
  for (const s of input.seizures) {
    const m = map.get(dateKeyOf(s.timestamp));
    if (m) m.seizures++;
  }
  for (const a of input.auras) {
    const m = map.get(dateKeyOf(a.timestamp));
    if (m) m.auras++;
  }
  for (const d of input.doses) {
    const m = map.get(dateKeyOf(d.scheduledTime));
    if (!m) continue;
    if (d.status === 'skipped' || d.status === 'unsure') m.dosesMissed++;
    else if (d.status === 'pending' && new Date(d.scheduledTime).getTime() <= now.getTime()) m.dosesNotRecorded++;
  }
  for (const s of input.sleep) {
    // the entry for the night of D-1 is the sleep before day D
    const m = map.get(addDays(s.date, 1));
    if (m && s.durationMinutes != null && s.durationMinutes < SHORT_SLEEP_MINUTES) m.shortSleep = true;
  }
  for (const c of input.checkIns) {
    const m = map.get(c.date);
    if (m && c.onPeriod === true) m.period = true;
  }
  return map;
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** Plain-language list of what happened on a day, for screen readers and the list view. Empty if nothing. */
export function describeMarkers(m: DayMarkers): string[] {
  const out: string[] = [];
  if (m.seizures) out.push(plural(m.seizures, 'seizure', 'seizures'));
  if (m.auras) out.push(plural(m.auras, 'warning sign', 'warning signs'));
  if (m.dosesMissed) out.push(`${plural(m.dosesMissed, 'dose', 'doses')} skipped or not sure`);
  if (m.dosesNotRecorded) out.push(`${plural(m.dosesNotRecorded, 'dose', 'doses')} not recorded`);
  if (m.shortSleep) out.push('short sleep the night before');
  if (m.period) out.push('period');
  return out;
}

export function isFuture(date: ISODate, today: ISODate): boolean {
  return date > today;
}

export function weekdayLong(date: ISODate): string {
  return fromDateKey(date).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
}

export { toDateKey };
