import type { ISODate, ISODateTime, ISOTime } from './types';

const pad = (n: number) => String(n).padStart(2, '0');

/** Local calendar date key for a Date. */
export function toDateKey(d: Date): ISODate {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function todayKey(now: Date = new Date()): ISODate {
  return toDateKey(now);
}

/** Parse "YYYY-MM-DD" as local midnight. */
export function fromDateKey(key: ISODate): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(key: ISODate, days: number): ISODate {
  const d = fromDateKey(key);
  d.setDate(d.getDate() + days);
  return toDateKey(d);
}

export function daysBetween(a: ISODate, b: ISODate): number {
  const ms = fromDateKey(b).getTime() - fromDateKey(a).getTime();
  return Math.round(ms / 86_400_000);
}

/** Inclusive list of date keys from start to end. */
export function dateRange(start: ISODate, end: ISODate): ISODate[] {
  const out: ISODate[] = [];
  for (let k = start; k <= end; k = addDays(k, 1)) out.push(k);
  return out;
}

export function parseTime(t: ISOTime): { hour: number; minute: number } {
  const [h, m] = t.split(':').map(Number);
  return { hour: h || 0, minute: m || 0 };
}

export function formatTimeKey(hour: number, minute: number): ISOTime {
  return `${pad(hour)}:${pad(minute)}`;
}

/** Combine a local date key and HH:mm into an ISO UTC timestamp. */
export function localDateTime(date: ISODate, time: ISOTime): ISODateTime {
  const d = fromDateKey(date);
  const { hour, minute } = parseTime(time);
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
}

export function minutesOfDay(hour: number, minute: number): number {
  return hour * 60 + minute;
}

export function nowMinutes(now: Date = new Date()): number {
  return now.getHours() * 60 + now.getMinutes();
}

/** Minutes slept between a bedtime and wake time (handles crossing midnight). */
export function sleepDurationMinutes(bed: ISOTime, wake: ISOTime): number {
  const b = parseTime(bed);
  const w = parseTime(wake);
  let diff = minutesOfDay(w.hour, w.minute) - minutesOfDay(b.hour, b.minute);
  if (diff <= 0) diff += 24 * 60;
  return diff;
}

/**
 * When a checklist item on `date` was done at clock time `time`. A time many hours before the
 * scheduled time (e.g. 00:00 for a 22:30 bedtime) means after midnight, so it falls on the next day.
 */
export function resolveDoneTime(date: ISODate, scheduledMinutes: number, time: ISOTime): Date {
  const t = parseTime(time);
  const wrapsPastMidnight = minutesOfDay(t.hour, t.minute) < scheduledMinutes - 12 * 60;
  return new Date(localDateTime(wrapsPastMidnight ? addDays(date, 1) : date, time));
}

export function isoNow(): ISODateTime {
  return new Date().toISOString();
}

/** Which local date does an ISO timestamp fall on. */
export function dateKeyOf(iso: ISODateTime): ISODate {
  return toDateKey(new Date(iso));
}

export function formatClock(hour: number, minute: number, use24h = prefers24h()): string {
  if (use24h) return formatTimeKey(hour, minute);
  const h12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${h12}:${pad(minute)} ${hour < 12 ? 'AM' : 'PM'}`;
}

export function formatIsoClock(iso: ISODateTime): string {
  const d = new Date(iso);
  return formatClock(d.getHours(), d.getMinutes());
}

let cached24h: boolean | null = null;
export function prefers24h(): boolean {
  if (cached24h !== null) return cached24h;
  try {
    const parts = new Intl.DateTimeFormat(undefined, { hour: 'numeric' }).formatToParts(new Date(2020, 0, 1, 13));
    cached24h = !parts.some((p) => p.type === 'dayPeriod');
  } catch {
    cached24h = false;
  }
  return cached24h;
}

export function formatDuration(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = Math.round(totalSeconds % 60);
  if (m === 0) return `${s} sec`;
  if (s === 0) return `${m} min`;
  return `${m} min ${s} sec`;
}

export function formatHours(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return m === 0 ? `${h} h` : `${h} h ${m} m`;
}

export function formatDateLong(key: ISODate): string {
  return fromDateKey(key).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
}

export function formatDateShort(key: ISODate): string {
  return fromDateKey(key).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function relativeDay(key: ISODate, today: ISODate = todayKey()): string {
  const diff = daysBetween(key, today);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  if (diff > 1 && diff < 7) return fromDateKey(key).toLocaleDateString(undefined, { weekday: 'long' });
  return formatDateShort(key);
}
