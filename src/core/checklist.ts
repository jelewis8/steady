/**
 * Daily checklist generation — app-blueprint.md §2.3 "Hour-Granularity Scheduling".
 * 1. Select the applicable template for the day.
 * 2. Instantiate a RoutineChecklistItem for each template item.
 * 3. Merge MedicationDose entries generated from active medications.
 * 4. Sort by time.
 * Pure functions only.
 */
import { uuid } from './ids';
import { fromDateKey, localDateTime, minutesOfDay, parseTime, todayKey } from './time';
import type {
  DayPlan,
  ISODate,
  ISODateTime,
  Medication,
  MedicationDose,
  MealType,
  RoutineCategory,
  RoutineChecklistItem,
  RoutineTemplate,
} from './types';

export function selectTemplate(
  templates: RoutineTemplate[],
  date: ISODate,
  plan?: DayPlan | null,
): RoutineTemplate | null {
  if (templates.length === 0) return null;
  if (plan) {
    const chosen = templates.find((t) => t.id === plan.templateId);
    if (chosen) return chosen;
  }
  const dow = fromDateKey(date).getDay();
  return (
    templates.find((t) => t.applicableDays.includes(dow)) ??
    templates.find((t) => t.isDefault) ??
    templates[0]
  );
}

export interface DaySync {
  toAdd: RoutineChecklistItem[];
  toRemoveIds: string[];
  toUpdate: RoutineChecklistItem[];
}

/**
 * Reconcile the stored checklist for a date with its template.
 * Completed/skipped history is never touched; only still-pending items follow template edits.
 */
export function syncDayItems(
  template: RoutineTemplate | null,
  date: ISODate,
  existing: RoutineChecklistItem[],
  now: ISODateTime,
): DaySync {
  const toAdd: RoutineChecklistItem[] = [];
  const toRemoveIds: string[] = [];
  const toUpdate: RoutineChecklistItem[] = [];
  if (!template) return { toAdd, toRemoveIds, toUpdate };

  const byTemplateItem = new Map(existing.filter((e) => !e.isAdHoc).map((e) => [e.templateItemId, e]));
  const templateItemIds = new Set(template.items.map((i) => i.id));

  for (const ti of template.items) {
    const found = byTemplateItem.get(ti.id);
    if (!found) {
      toAdd.push({
        id: uuid(),
        templateItemId: ti.id,
        templateId: template.id,
        date,
        scheduledHour: ti.hour,
        scheduledMinute: ti.minute,
        status: 'pending',
        completedAt: null,
        notes: null,
        label: ti.label,
        category: ti.category,
        isOptional: ti.isOptional,
        isEssential: ti.isEssential ?? false,
        mealType: ti.mealType,
        deferredUntil: null,
        isAdHoc: false,
        createdAt: now,
      });
    } else if (
      found.status === 'pending' &&
      (found.label !== ti.label ||
        found.scheduledHour !== ti.hour ||
        found.scheduledMinute !== ti.minute ||
        found.category !== ti.category ||
        found.isOptional !== ti.isOptional)
    ) {
      toUpdate.push({
        ...found,
        label: ti.label,
        scheduledHour: ti.hour,
        scheduledMinute: ti.minute,
        category: ti.category,
        isOptional: ti.isOptional,
        isEssential: ti.isEssential ?? false,
        mealType: ti.mealType,
      });
    }
  }
  for (const e of existing) {
    if (e.isAdHoc) continue;
    const orphaned = e.templateId !== template.id || !templateItemIds.has(e.templateItemId);
    if (orphaned && e.status === 'pending') toRemoveIds.push(e.id);
  }
  return { toAdd, toRemoveIds, toUpdate };
}

/**
 * Was this medication scheduled on `date`? Today and later follow `isActive`. For past days, a medication she has since
 * stopped still counts up to the day she stopped it (so a past day can be filled in accurately).
 */
export function isMedicationActiveOn(med: Medication, date: ISODate, today: ISODate = todayKey()): boolean {
  if (med.isRescue) return false;
  if (!med.isActive && (date >= today || !med.endDate)) return false;
  if (med.startDate && date < med.startDate) return false;
  if (med.endDate && date > med.endDate) return false;
  return true;
}

/** Doses that should exist for a date but don't yet. */
export function missingDosesForDay(
  meds: Medication[],
  date: ISODate,
  existing: MedicationDose[],
  now: ISODateTime,
  today: ISODate = todayKey(),
): MedicationDose[] {
  const have = new Set(existing.map((d) => `${d.medicationId}|${d.scheduledTime}`));
  const out: MedicationDose[] = [];
  for (const m of meds) {
    if (!isMedicationActiveOn(m, date, today)) continue;
    for (const t of m.scheduledTimes) {
      const scheduledTime = localDateTime(date, t);
      if (have.has(`${m.id}|${scheduledTime}`)) continue;
      out.push({
        id: uuid(),
        medicationId: m.id,
        scheduledTime,
        actualTime: null,
        status: 'pending',
        sideEffects: [],
        notes: null,
        createdAt: now,
      });
    }
  }
  return out;
}

/** Remove still-pending doses whose schedule no longer exists (e.g., a time was edited). */
export function orphanedPendingDoses(meds: Medication[], date: ISODate, existing: MedicationDose[], today: ISODate = todayKey()): string[] {
  const valid = new Set<string>();
  for (const m of meds) {
    if (!isMedicationActiveOn(m, date, today)) continue;
    for (const t of m.scheduledTimes) valid.add(`${m.id}|${localDateTime(date, t)}`);
  }
  return existing
    .filter((d) => d.status === 'pending' && !valid.has(`${d.medicationId}|${d.scheduledTime}`))
    .map((d) => d.id);
}

export type EntryStatus = 'pending' | 'done' | 'skipped' | 'deferred' | 'unsure';

export interface ChecklistEntry {
  key: string;
  kind: 'routine' | 'dose';
  id: string;
  label: string;
  detail: string | null;
  category: RoutineCategory;
  /** minutes since local midnight (effective — deferred items use the deferred time) */
  minutes: number;
  scheduledMinutes: number;
  status: EntryStatus;
  completedAt: ISODateTime | null;
  isOptional: boolean;
  isEssential: boolean;
  overdue: boolean;
  mealType?: MealType;
  medicationId?: string;
  notes: string | null;
}

export interface ChecklistView {
  entries: ChecklistEntry[];
  stillOpen: ChecklistEntry[];
  upNext: ChecklistEntry[];
  later: ChecklistEntry[];
  finished: ChecklistEntry[];
  doneCount: number;
  total: number;
  percent: number;
}

export const OVERDUE_GRACE_MINUTES = 30;

function doseStatus(s: MedicationDose['status']): EntryStatus {
  if (s === 'taken' || s === 'taken_late') return 'done';
  if (s === 'skipped') return 'skipped';
  if (s === 'unsure') return 'unsure';
  return 'pending';
}

export function buildChecklistView(opts: {
  date: ISODate;
  items: RoutineChecklistItem[];
  doses: MedicationDose[];
  meds: Medication[];
  now: Date;
  isToday: boolean;
  essentialsOnly?: boolean;
  upNextCount?: number;
}): ChecklistView {
  const { items, doses, meds, now, isToday } = opts;
  const medById = new Map(meds.map((m) => [m.id, m]));
  const nowMin = isToday ? now.getHours() * 60 + now.getMinutes() : 24 * 60 + 1;
  const entries: ChecklistEntry[] = [];

  for (const it of items) {
    if (opts.essentialsOnly && !it.isEssential && it.category !== 'medication') continue;
    const scheduled = minutesOfDay(it.scheduledHour, it.scheduledMinute);
    let effective = scheduled;
    if (it.status === 'deferred' && it.deferredUntil) {
      const d = new Date(it.deferredUntil);
      effective = d.getHours() * 60 + d.getMinutes();
    }
    const open = it.status === 'pending' || it.status === 'deferred';
    entries.push({
      key: `r:${it.id}`,
      kind: 'routine',
      id: it.id,
      label: it.label,
      detail: it.status === 'deferred' ? 'Moved to later' : null,
      category: it.category,
      minutes: effective,
      scheduledMinutes: scheduled,
      status: it.status,
      completedAt: it.completedAt,
      isOptional: it.isOptional,
      isEssential: it.isEssential ?? false,
      overdue: open && effective + OVERDUE_GRACE_MINUTES < nowMin,
      mealType: it.mealType,
      notes: it.notes,
    });
  }

  for (const d of doses) {
    const med = medById.get(d.medicationId);
    if (!med) continue;
    const t = new Date(d.scheduledTime);
    const scheduled = t.getHours() * 60 + t.getMinutes();
    const status = doseStatus(d.status);
    entries.push({
      key: `d:${d.id}`,
      kind: 'dose',
      id: d.id,
      label: med.name,
      detail: [med.dosage, med.unit && !med.dosage.endsWith(med.unit) ? med.unit : ''].filter(Boolean).join(' ') || null,
      category: 'medication',
      minutes: scheduled,
      scheduledMinutes: scheduled,
      status,
      completedAt: d.actualTime,
      isOptional: false,
      isEssential: true,
      overdue: status === 'pending' && scheduled + OVERDUE_GRACE_MINUTES < nowMin,
      medicationId: med.id,
      notes: d.notes,
    });
  }

  entries.sort((a, b) => a.minutes - b.minutes || (a.kind === 'dose' ? -1 : 1) - (b.kind === 'dose' ? -1 : 1));

  const isOpen = (e: ChecklistEntry) => e.status === 'pending' || e.status === 'deferred';
  const stillOpen = entries.filter((e) => isOpen(e) && e.overdue);
  const upcoming = entries.filter((e) => isOpen(e) && !e.overdue);
  const n = opts.upNextCount ?? 4;
  const finished = entries.filter((e) => !isOpen(e)).sort((a, b) => b.minutes - a.minutes);
  const counted = entries.filter((e) => !e.isOptional || e.status === 'done');
  const doneCount = counted.filter((e) => e.status === 'done').length;
  const total = counted.length;
  return {
    entries,
    stillOpen,
    upNext: upcoming.slice(0, n),
    later: upcoming.slice(n),
    finished,
    doneCount,
    total,
    percent: total === 0 ? 0 : Math.round((doneCount / total) * 100),
  };
}

/** Was a dose taken late given its scheduled time and a grace window? */
export function doseStatusForNow(scheduledTime: ISODateTime, takenAt: Date, windowMinutes: number): 'taken' | 'taken_late' {
  const diff = (takenAt.getTime() - new Date(scheduledTime).getTime()) / 60000;
  return diff > windowMinutes ? 'taken_late' : 'taken';
}

/**
 * Non-punitive consistency: consecutive previous days where ≥80% of required items were done.
 * Returns the run length ending yesterday, and whether yesterday was a gap.
 */
export function routineConsistency(
  dayPercents: { date: ISODate; percent: number; total: number }[],
  today: ISODate,
): { run: number; pickBackUp: boolean } {
  const sorted = dayPercents.filter((d) => d.date < today && d.total > 0).sort((a, b) => (a.date < b.date ? 1 : -1));
  let run = 0;
  for (const d of sorted) {
    if (d.percent >= 80) run++;
    else break;
  }
  const pickBackUp = sorted.length > 0 && sorted[0].percent < 80;
  return { run, pickBackUp };
}

export function templateItemTime(hour: number, minute: number): string {
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

export function sortTimes(times: string[]): string[] {
  return [...new Set(times)].sort((a, b) => {
    const pa = parseTime(a);
    const pb = parseTime(b);
    return pa.hour * 60 + pa.minute - (pb.hour * 60 + pb.minute);
  });
}
