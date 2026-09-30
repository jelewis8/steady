/**
 * Domain actions. The only module (with hooks.ts and storage.ts) that talks to Dexie.
 * Every mutating action returns an `undo` function so the UI can offer undo everywhere.
 */
import {
  buildChecklistView,
  doseStatusForNow,
  missingDosesForDay,
  orphanedPendingDoses,
  selectTemplate,
  syncDayItems,
} from '../core/checklist';
import { countryByCode, emergencyNumberFor } from '../core/crisisLines';
import { buildDefaultTemplates, builtInTriggerTags, DEFAULT_PREFERENCES, defaultProfile, defaultRescueProtocol, type RoutineSetup } from '../core/defaults';
import { uuid } from '../core/ids';
import { dateKeyOf, isoNow, localDateTime, sleepDurationMinutes, todayKey } from '../core/time';
import type {
  AuraLog,
  ChecklistStatus,
  DailyCheckIn,
  DoseStatus,
  EmergencyContact,
  InsightRule,
  ISODate,
  ISOTime,
  MealLog,
  MealType,
  Medication,
  MedicationDose,
  RescueProtocol,
  RoutineChecklistItem,
  RoutineTemplate,
  SafetyPlan,
  SeizureEvent,
  SideEffectLog,
  SleepEntry,
  StopReason,
  TriggerCategory,
  TriggerTag,
  UserPreferences,
  UserProfile,
} from '../core/types';
import { db } from './db';

export type Undo = () => Promise<void>;
const noop: Undo = async () => {};

// ───────────────────────── setup ─────────────────────────

export async function getProfile(): Promise<UserProfile | undefined> {
  return db.profile.toCollection().first();
}

/** Make sure the singletons and built-ins exist. Safe to call on every launch. */
export async function initDatabase(): Promise<UserProfile> {
  return db.transaction('rw', [db.profile, db.triggerTags, db.rescueProtocol, db.routineTemplates], async () => {
    const now = isoNow();
    let profile = await db.profile.toCollection().first();
    if (!profile) {
      profile = defaultProfile(now);
      await db.profile.put(profile);
    }
    if ((await db.triggerTags.count()) === 0) await db.triggerTags.bulkPut(builtInTriggerTags(now));
    if ((await db.rescueProtocol.count()) === 0) await db.rescueProtocol.put(defaultRescueProtocol(now));
    if ((await db.routineTemplates.count()) === 0) await db.routineTemplates.bulkPut(buildDefaultTemplates(now));
    return profile;
  });
}

export async function updateProfile(patch: Partial<Omit<UserProfile, 'preferences'>>): Promise<void> {
  const p = await getProfile();
  if (!p) return;
  await db.profile.put({ ...p, ...patch, updatedAt: isoNow() });
}

export async function updatePreferences(patch: Partial<UserPreferences>): Promise<Undo> {
  const p = await getProfile();
  if (!p) return noop;
  const before = p.preferences;
  await db.profile.put({ ...p, preferences: { ...p.preferences, ...patch }, updatedAt: isoNow() });
  return async () => {
    const cur = await getProfile();
    if (cur) await db.profile.put({ ...cur, preferences: before });
  };
}

// ───────────────────────── daily checklist ─────────────────────────

/** Instantiate/reconcile a day's checklist and medication doses (blueprint §2.3). */
export async function ensureDay(date: ISODate = todayKey()): Promise<void> {
  await db.transaction(
    'rw',
    [db.routineTemplates, db.routineChecklistItems, db.medications, db.medicationDoses, db.dayPlans],
    async () => {
      const now = isoNow();
      const [templates, plan, items, meds] = await Promise.all([
        db.routineTemplates.toArray(),
        db.dayPlans.get(date),
        db.routineChecklistItems.where('date').equals(date).toArray(),
        db.medications.toArray(),
      ]);
      const template = selectTemplate(templates, date, plan);
      const sync = syncDayItems(template, date, items, now);
      if (sync.toAdd.length) await db.routineChecklistItems.bulkAdd(sync.toAdd);
      if (sync.toUpdate.length) await db.routineChecklistItems.bulkPut(sync.toUpdate);
      if (sync.toRemoveIds.length) await db.routineChecklistItems.bulkDelete(sync.toRemoveIds);

      const start = localDateTime(date, '00:00');
      const end = localDateTime(date, '23:59');
      const doses = await db.medicationDoses.where('scheduledTime').between(start, end, true, true).toArray();
      const missing = missingDosesForDay(meds, date, doses, now);
      if (missing.length) await db.medicationDoses.bulkAdd(missing);
      const orphans = orphanedPendingDoses(meds, date, doses);
      if (orphans.length) await db.medicationDoses.bulkDelete(orphans);
    },
  );
}

export async function setDayTemplate(date: ISODate, templateId: string): Promise<void> {
  await db.dayPlans.put({ date, templateId });
  await ensureDay(date);
}

export async function setChecklistStatus(
  id: string,
  status: ChecklistStatus,
  opts: { glassMl?: number; deferMinutes?: number } = {},
): Promise<Undo> {
  const item = await db.routineChecklistItems.get(id);
  if (!item) return noop;
  const before = { ...item };
  const now = new Date();
  const next: RoutineChecklistItem = {
    ...item,
    status,
    completedAt: status === 'done' ? now.toISOString() : null,
    deferredUntil: status === 'deferred' ? new Date(now.getTime() + (opts.deferMinutes ?? 30) * 60000).toISOString() : null,
  };
  await db.transaction('rw', [db.routineChecklistItems, db.mealLogs, db.hydrationLogs], async () => {
    await db.routineChecklistItems.put(next);
    // Linked side-effects share the checklist item's id so undo can remove them precisely.
    if (item.category === 'meal') {
      if (status === 'done') {
        await db.mealLogs.put({
          id: item.id,
          timestamp: now.toISOString(),
          mealType: item.mealType ?? guessMealType(now),
          foods: null,
          triggerFoodsFlagged: [],
          hydrationMl: 0,
          carbsGrams: null,
          notes: null,
          createdAt: now.toISOString(),
        });
      } else {
        await db.mealLogs.delete(item.id);
      }
    }
    if (item.category === 'hydration') {
      if (status === 'done') {
        await db.hydrationLogs.put({ id: item.id, timestamp: now.toISOString(), amountMl: opts.glassMl ?? 250, createdAt: now.toISOString() });
      } else {
        await db.hydrationLogs.delete(item.id);
      }
    }
  });
  return async () => {
    await db.routineChecklistItems.put(before);
    if (before.status !== 'done') {
      await db.mealLogs.delete(id);
      await db.hydrationLogs.delete(id);
    }
  };
}

export async function setChecklistNote(id: string, notes: string): Promise<void> {
  await db.routineChecklistItems.update(id, { notes: notes || null });
}

export async function addAdHocItem(date: ISODate, time: ISOTime, label: string): Promise<Undo> {
  const [h, m] = time.split(':').map(Number);
  const id = uuid();
  await db.routineChecklistItems.add({
    id,
    templateItemId: id,
    templateId: 'adhoc',
    date,
    scheduledHour: h,
    scheduledMinute: m,
    status: 'pending',
    completedAt: null,
    notes: null,
    label,
    category: 'custom',
    isOptional: false,
    isAdHoc: true,
    deferredUntil: null,
    createdAt: isoNow(),
  });
  return async () => db.routineChecklistItems.delete(id);
}

export async function deleteChecklistItem(id: string): Promise<Undo> {
  const item = await db.routineChecklistItems.get(id);
  if (!item) return noop;
  await db.routineChecklistItems.delete(id);
  return async () => {
    await db.routineChecklistItems.put(item);
  };
}

export function guessMealType(d: Date): MealType {
  const h = d.getHours();
  if (h < 10.5) return 'breakfast';
  if (h < 15) return 'lunch';
  if (h >= 17 && h < 22) return 'dinner';
  return 'snack';
}

// ───────────────────────── medication ─────────────────────────

export async function setDoseStatus(doseId: string, status: DoseStatus, at: Date = new Date()): Promise<Undo> {
  const dose = await db.medicationDoses.get(doseId);
  if (!dose) return noop;
  const med = await db.medications.get(dose.medicationId);
  const profile = await getProfile();
  const window = profile?.preferences.missedDoseWindowMinutes ?? 60;
  const beforeDose = { ...dose };
  const beforeMed = med ? { ...med } : null;
  let finalStatus: DoseStatus = status;
  if (status === 'taken') finalStatus = doseStatusForNow(dose.scheduledTime, at, window);
  const wasTaken = dose.status === 'taken' || dose.status === 'taken_late';
  const isTaken = finalStatus === 'taken' || finalStatus === 'taken_late';
  await db.transaction('rw', [db.medicationDoses, db.medications], async () => {
    await db.medicationDoses.put({
      ...dose,
      status: finalStatus,
      actualTime: isTaken ? at.toISOString() : null,
    });
    if (med && med.remainingCount != null && wasTaken !== isTaken) {
      const delta = (isTaken ? -1 : 1) * (med.unitsPerDose || 1);
      await db.medications.put({ ...med, remainingCount: Math.max(0, med.remainingCount + delta), updatedAt: isoNow() });
    }
  });
  return async () => {
    await db.medicationDoses.put(beforeDose);
    if (beforeMed) await db.medications.put(beforeMed);
  };
}

export async function setDoseNote(doseId: string, notes: string, sideEffects?: string[]): Promise<void> {
  const patch: Partial<MedicationDose> = { notes: notes || null };
  if (sideEffects) patch.sideEffects = sideEffects;
  await db.medicationDoses.update(doseId, patch);
}

export function newMedication(): Medication {
  const now = isoNow();
  return {
    id: uuid(),
    name: '',
    genericName: null,
    dosage: '',
    unit: '',
    frequency: 'twice daily',
    scheduledTimes: ['08:00', '20:00'],
    prescriber: null,
    pharmacy: null,
    remainingCount: null,
    unitsPerDose: 1,
    refillDate: null,
    refillReminderDays: 7,
    isActive: true,
    isRescue: false,
    startDate: todayKey(),
    endDate: null,
    sideEffectsNoted: [],
    stopReason: null,
    stopReasonNote: null,
    notes: null,
    createdAt: now,
    updatedAt: now,
  };
}

export async function saveMedication(med: Medication): Promise<void> {
  await db.medications.put({ ...med, updatedAt: isoNow() });
  await ensureDay(todayKey());
}

export interface StopDetails {
  /** Date she stopped (defaults to today) */
  endDate?: ISODate;
  reason?: StopReason | null;
  note?: string | null;
}

/** "I no longer take this": archives the medication (history is kept) and records when and, if she says, why. */
export async function deleteMedication(id: string, stop: StopDetails = {}): Promise<Undo> {
  const med = await db.medications.get(id);
  if (!med) return noop;
  // Keep dose history (it's medical history); only remove today's still-pending doses.
  const today = todayKey();
  const pending = (await db.medicationDoses.where('medicationId').equals(id).toArray()).filter(
    (d) => d.status === 'pending' && dateKeyOf(d.scheduledTime) >= today,
  );
  await db.transaction('rw', [db.medications, db.medicationDoses], async () => {
    await db.medications.put({
      ...med,
      isActive: false,
      endDate: stop.endDate ?? today,
      stopReason: stop.reason ?? null,
      stopReasonNote: stop.note?.trim() || null,
      updatedAt: isoNow(),
    });
    await db.medicationDoses.bulkDelete(pending.map((d) => d.id));
  });
  return async () => {
    await db.medications.put(med);
    await db.medicationDoses.bulkPut(pending);
  };
}

/** Add or correct why (and when) an already-stopped medication was stopped. */
export async function saveStopDetails(id: string, stop: StopDetails): Promise<Undo> {
  const med = await db.medications.get(id);
  if (!med) return noop;
  await db.medications.put({
    ...med,
    endDate: stop.endDate ?? med.endDate,
    stopReason: stop.reason ?? null,
    stopReasonNote: stop.note?.trim() || null,
    updatedAt: isoNow(),
  });
  return async () => {
    await db.medications.put(med);
  };
}

// ───────────────────────── side effects ─────────────────────────

export function newSideEffect(medicationId: string | null = null): SideEffectLog {
  const now = isoNow();
  return { id: uuid(), medicationId, name: '', startDate: null, endDate: null, severity: null, notes: null, createdAt: now, updatedAt: now };
}

export async function saveSideEffect(se: SideEffectLog): Promise<Undo> {
  const before = await db.sideEffects.get(se.id);
  await db.sideEffects.put({ ...se, name: se.name.trim(), notes: se.notes?.trim() || null, updatedAt: isoNow() });
  return async () => {
    if (before) await db.sideEffects.put(before);
    else await db.sideEffects.delete(se.id);
  };
}

export async function deleteSideEffect(id: string): Promise<Undo> {
  const se = await db.sideEffects.get(id);
  if (!se) return noop;
  await db.sideEffects.delete(id);
  return async () => {
    await db.sideEffects.put(se);
  };
}

// ───────────────────────── seizures & auras ─────────────────────────

export function newSeizure(partial: Partial<SeizureEvent> = {}): SeizureEvent {
  const now = isoNow();
  return {
    id: uuid(),
    timestamp: now,
    endTimestamp: null,
    type: 'unknown',
    durationSeconds: null,
    severity: 3,
    auraIds: [],
    postIctalSymptoms: [],
    triggerTagIds: [],
    location: null,
    activityAtOnset: null,
    rescueMedicationUsed: false,
    rescueMedicationDetails: null,
    observerPresent: null,
    observerNotes: null,
    voiceNoteUri: null,
    notes: null,
    isQuickLog: false,
    createdAt: now,
    updatedAt: now,
    ...partial,
  };
}

export async function saveSeizure(ev: SeizureEvent, auraSymptoms?: string[]): Promise<void> {
  await db.transaction('rw', [db.seizureEvents, db.auraLogs], async () => {
    let auraIds = ev.auraIds;
    if (auraSymptoms !== undefined) {
      const existingId = auraIds[0];
      if (auraSymptoms.length === 0) {
        if (existingId) await db.auraLogs.delete(existingId);
        auraIds = [];
      } else {
        const aura: AuraLog = {
          id: existingId ?? uuid(),
          seizureEventId: ev.id,
          timestamp: ev.timestamp,
          symptoms: auraSymptoms,
          durationSeconds: null,
          progressedToSeizure: true,
          notes: null,
          createdAt: isoNow(),
        };
        await db.auraLogs.put(aura);
        auraIds = [aura.id];
      }
    }
    await db.seizureEvents.put({ ...ev, auraIds, updatedAt: isoNow() });
  });
}

export async function deleteSeizure(id: string): Promise<Undo> {
  const ev = await db.seizureEvents.get(id);
  if (!ev) return noop;
  const auras = await db.auraLogs.where('seizureEventId').equals(id).toArray();
  const voices = await db.voiceNotes.where('seizureEventId').equals(id).toArray();
  await db.transaction('rw', [db.seizureEvents, db.auraLogs, db.voiceNotes], async () => {
    await db.seizureEvents.delete(id);
    await db.auraLogs.bulkDelete(auras.map((a) => a.id));
    await db.voiceNotes.bulkDelete(voices.map((v) => v.id));
  });
  return async () => {
    await db.transaction('rw', [db.seizureEvents, db.auraLogs, db.voiceNotes], async () => {
      await db.seizureEvents.put(ev);
      await db.auraLogs.bulkPut(auras);
      await db.voiceNotes.bulkPut(voices);
    });
  };
}

export async function logAura(symptoms: string[], notes: string | null = null): Promise<Undo> {
  const now = isoNow();
  const aura: AuraLog = {
    id: uuid(),
    seizureEventId: null,
    timestamp: now,
    symptoms,
    durationSeconds: null,
    progressedToSeizure: false,
    notes,
    createdAt: now,
  };
  await db.auraLogs.add(aura);
  return async () => db.auraLogs.delete(aura.id);
}

export async function deleteAura(id: string): Promise<Undo> {
  const a = await db.auraLogs.get(id);
  if (!a) return noop;
  await db.auraLogs.delete(id);
  return async () => {
    await db.auraLogs.put(a);
  };
}

export async function saveVoiceNote(blob: Blob, mimeType: string, durationMs: number, seizureEventId: string | null) {
  const id = uuid();
  await db.voiceNotes.add({ id, blob, mimeType, durationMs, seizureEventId, createdAt: isoNow() });
  return id;
}

export async function deleteVoiceNote(id: string) {
  await db.voiceNotes.delete(id);
}

export async function addTriggerTag(label: string, category: TriggerCategory = 'other'): Promise<TriggerTag> {
  const existing = (await db.triggerTags.toArray()).find((t) => t.label.toLowerCase() === label.trim().toLowerCase());
  if (existing) return existing;
  const tag: TriggerTag = { id: uuid(), label: label.trim(), category, isBuiltIn: false, createdAt: isoNow() };
  await db.triggerTags.add(tag);
  return tag;
}

// ───────────────────────── diet & hydration ─────────────────────────

export async function addWater(ml: number): Promise<Undo> {
  const now = isoNow();
  const id = uuid();
  await db.hydrationLogs.add({ id, timestamp: now, amountMl: ml, createdAt: now });
  // Tick the next open water item on today's checklist, if any.
  const today = todayKey();
  const items = await db.routineChecklistItems.where('date').equals(today).toArray();
  const water = items
    .filter((i) => i.category === 'hydration' && (i.status === 'pending' || i.status === 'deferred'))
    .sort((a, b) => a.scheduledHour * 60 + a.scheduledMinute - (b.scheduledHour * 60 + b.scheduledMinute))[0];
  if (water) await db.routineChecklistItems.update(water.id, { status: 'done', completedAt: now });
  return async () => {
    await db.hydrationLogs.delete(id);
    if (water) await db.routineChecklistItems.update(water.id, { status: water.status, completedAt: water.completedAt });
  };
}

export async function removeLatestWaterToday(): Promise<void> {
  const today = todayKey();
  const logs = (await db.hydrationLogs.toArray()).filter((h) => dateKeyOf(h.timestamp) === today).sort((a, b) => (a.timestamp < b.timestamp ? 1 : -1));
  if (logs[0]) {
    await db.hydrationLogs.delete(logs[0].id);
    await db.routineChecklistItems.where('id').equals(logs[0].id).modify({ status: 'pending', completedAt: null });
  }
}

export async function logMeal(input: Partial<MealLog> & { mealType: MealType }, triggerFoods: string[]): Promise<Undo> {
  const now = isoNow();
  const foods = input.foods?.trim() || null;
  const lower = (foods ?? '').toLowerCase();
  const flagged = triggerFoods.filter((f) => f.trim() && lower.includes(f.trim().toLowerCase()));
  const meal: MealLog = {
    id: uuid(),
    timestamp: input.timestamp ?? now,
    mealType: input.mealType,
    foods,
    triggerFoodsFlagged: flagged,
    hydrationMl: input.hydrationMl ?? 0,
    carbsGrams: input.carbsGrams ?? null,
    notes: input.notes ?? null,
    createdAt: now,
  };
  await db.mealLogs.add(meal);
  // Tick the matching meal on today's checklist.
  const day = dateKeyOf(meal.timestamp);
  const items = await db.routineChecklistItems.where('date').equals(day).toArray();
  const match = items.find((i) => i.category === 'meal' && i.mealType === meal.mealType && i.status !== 'done');
  if (match) await db.routineChecklistItems.update(match.id, { status: 'done', completedAt: meal.timestamp });
  return async () => {
    await db.mealLogs.delete(meal.id);
    if (match) await db.routineChecklistItems.update(match.id, { status: match.status, completedAt: match.completedAt });
  };
}

export async function deleteMeal(id: string): Promise<Undo> {
  const m = await db.mealLogs.get(id);
  if (!m) return noop;
  await db.mealLogs.delete(id);
  return async () => {
    await db.mealLogs.put(m);
  };
}

// ───────────────────────── sleep ─────────────────────────

export async function saveSleep(entry: Omit<SleepEntry, 'id' | 'createdAt' | 'durationMinutes'> & { id?: string }): Promise<void> {
  const existing = await db.sleepEntries.where('date').equals(entry.date).first();
  const duration = entry.actualBedtime && entry.actualWakeTime ? sleepDurationMinutes(entry.actualBedtime, entry.actualWakeTime) : null;
  await db.sleepEntries.put({
    ...entry,
    id: existing?.id ?? entry.id ?? uuid(),
    durationMinutes: duration,
    createdAt: existing?.createdAt ?? isoNow(),
  });
  // A sleep log also ticks today's "wake up" item.
  const today = todayKey();
  const items = await db.routineChecklistItems.where('date').equals(today).toArray();
  const wake = items.find((i) => i.category === 'sleep' && /wake/i.test(i.label) && i.status !== 'done');
  if (wake && entry.actualWakeTime) await db.routineChecklistItems.update(wake.id, { status: 'done', completedAt: isoNow() });
}

export async function deleteSleep(id: string): Promise<Undo> {
  const s = await db.sleepEntries.get(id);
  if (!s) return noop;
  await db.sleepEntries.delete(id);
  return async () => {
    await db.sleepEntries.put(s);
  };
}

const BEDTIME_KEY = 'sleep.inBedSince';
export async function startSleepTimer(): Promise<void> {
  await db.meta.put({ key: BEDTIME_KEY, value: isoNow() });
}
export async function getSleepTimer(): Promise<string | null> {
  return ((await db.meta.get(BEDTIME_KEY))?.value as string) ?? null;
}
export async function cancelSleepTimer(): Promise<void> {
  await db.meta.delete(BEDTIME_KEY);
}

// ───────────────────────── check-ins ─────────────────────────

export async function saveCheckIn(date: ISODate, patch: Partial<Omit<DailyCheckIn, 'id' | 'date'>>): Promise<void> {
  const existing = await db.dailyCheckIns.where('date').equals(date).first();
  const now = isoNow();
  const base: DailyCheckIn = existing ?? {
    id: uuid(),
    date,
    stress: null,
    mood: null,
    onPeriod: null,
    illness: null,
    alcoholDrinks: null,
    seizureActivityReported: null,
    notes: null,
    createdAt: now,
    updatedAt: now,
  };
  await db.dailyCheckIns.put({ ...base, ...patch, updatedAt: now });
  if (patch.stress != null || patch.mood != null) {
    const items = await db.routineChecklistItems.where('date').equals(date).toArray();
    const check = items.find((i) => (i.category === 'stress_check' || i.category === 'mood') && i.status !== 'done');
    if (check) await db.routineChecklistItems.update(check.id, { status: 'done', completedAt: now });
  }
}

// ───────────────────────── routines ─────────────────────────

export async function saveTemplate(t: RoutineTemplate): Promise<void> {
  await db.transaction('rw', db.routineTemplates, async () => {
    if (t.isDefault) {
      const others = await db.routineTemplates.toArray();
      for (const o of others) if (o.id !== t.id && o.isDefault) await db.routineTemplates.put({ ...o, isDefault: false });
    }
    // A weekday can belong to only one template.
    const others = await db.routineTemplates.toArray();
    for (const o of others) {
      if (o.id === t.id) continue;
      const days = o.applicableDays.filter((d) => !t.applicableDays.includes(d));
      if (days.length !== o.applicableDays.length) await db.routineTemplates.put({ ...o, applicableDays: days });
    }
    await db.routineTemplates.put({ ...t, updatedAt: isoNow() });
  });
  await ensureDay(todayKey());
}

export async function deleteTemplate(id: string): Promise<Undo> {
  const t = await db.routineTemplates.get(id);
  if (!t) return noop;
  if ((await db.routineTemplates.count()) <= 1) return noop;
  await db.routineTemplates.delete(id);
  await ensureDay(todayKey());
  return async () => {
    await db.routineTemplates.put(t);
    await ensureDay(todayKey());
  };
}

export async function replaceRoutineFromSetup(setup: RoutineSetup): Promise<void> {
  const now = isoNow();
  const [everyday, rest] = buildDefaultTemplates(now, setup);
  await db.transaction('rw', db.routineTemplates, async () => {
    await db.routineTemplates.clear();
    await db.routineTemplates.bulkPut([everyday, rest]);
  });
  // Today's untouched items follow the new routine.
  const today = todayKey();
  const items = await db.routineChecklistItems.where('date').equals(today).toArray();
  await db.routineChecklistItems.bulkDelete(items.filter((i) => i.status === 'pending' && !i.isAdHoc).map((i) => i.id));
  await ensureDay(today);
}

// ───────────────────────── rescue ─────────────────────────

export async function saveRescueProtocol(patch: Partial<RescueProtocol>): Promise<void> {
  const existing = (await db.rescueProtocol.toCollection().first()) ?? defaultRescueProtocol(isoNow());
  await db.rescueProtocol.put({ ...existing, ...patch, updatedAt: isoNow() });
}

export async function saveContact(c: EmergencyContact): Promise<void> {
  await db.emergencyContacts.put(c);
}

export async function saveSafetyPlan(plan: SafetyPlan | null): Promise<Undo> {
  const p = await getProfile();
  if (!p) return noop;
  const before = p.safetyPlan ?? null;
  await db.profile.put({ ...p, safetyPlan: plan ? { ...plan, updatedAt: isoNow() } : null, updatedAt: isoNow() });
  return async () => {
    const cur = await getProfile();
    if (cur) await db.profile.put({ ...cur, safetyPlan: before });
  };
}

export async function deleteContact(id: string): Promise<Undo> {
  const c = await db.emergencyContacts.get(id);
  if (!c) return noop;
  await db.emergencyContacts.delete(id);
  return async () => {
    await db.emergencyContacts.put(c);
  };
}

export function newContact(sortOrder: number): EmergencyContact {
  return {
    id: uuid(),
    name: '',
    relationship: '',
    phone: '',
    email: null,
    notifyOnEmergency: true,
    canViewRescueProtocol: true,
    supportPerson: false,
    sortOrder,
    createdAt: isoNow(),
  };
}

// ───────────────────────── insights ─────────────────────────

const insightKey = (i: { correlationType: string; title: string }) => `${i.correlationType}:${i.title}`;

/** Store the latest computed insights as InsightRule rows (so they're part of the export), keeping dismissals. */
export async function persistInsights(
  insights: { correlationType: InsightRule['correlationType']; title: string; summary: string; confidence: InsightRule['confidenceLevel']; variables: Record<string, unknown> }[],
  days: number,
): Promise<void> {
  await db.transaction('rw', db.insightRules, async () => {
    const existing = await db.insightRules.toArray();
    const byKey = new Map(existing.map((r) => [String(r.variables?.key ?? ''), r]));
    const now = isoNow();
    const rows: InsightRule[] = insights.map((i) => {
      const key = insightKey(i);
      const prev = byKey.get(key);
      return {
        id: prev?.id ?? uuid(),
        correlationType: i.correlationType,
        timeRangeDays: days,
        variables: { ...i.variables, key, title: i.title },
        confidenceLevel: i.confidence,
        plainLanguageSummary: i.summary,
        generatedAt: now,
        dismissedByUser: prev?.dismissedByUser ?? false,
      };
    });
    const keep = new Set(rows.map((r) => r.id));
    // Keep dismissed rows even if not currently computed, so they stay dismissed.
    const stale = existing.filter((r) => !keep.has(r.id) && !r.dismissedByUser).map((r) => r.id);
    await db.insightRules.bulkDelete(stale);
    await db.insightRules.bulkPut(rows);
  });
}

export async function setInsightDismissed(correlationType: string, title: string, dismissed: boolean): Promise<void> {
  const key = insightKey({ correlationType, title });
  const rows = await db.insightRules.toArray();
  const row = rows.find((r) => r.variables?.key === key);
  if (row) await db.insightRules.put({ ...row, dismissedByUser: dismissed });
}

// ───────────────────────── misc ─────────────────────────

/** Snapshot of a day's completion, used for routine consistency. */
export async function dayCompletion(date: ISODate) {
  const [items, doses, meds] = await Promise.all([
    db.routineChecklistItems.where('date').equals(date).toArray(),
    db.medicationDoses.where('scheduledTime').between(localDateTime(date, '00:00'), localDateTime(date, '23:59'), true, true).toArray(),
    db.medications.toArray(),
  ]);
  const v = buildChecklistView({ date, items, doses, meds, now: new Date(), isToday: false });
  return { date, percent: v.percent, total: v.total };
}

/**
 * Choose the country used for crisis lines. If her emergency number is still the previous country's default
 * (or the 911 starting value), switch it to the new country's default. A number she set herself is left alone.
 */
export async function setCountry(code: string | null): Promise<Undo> {
  const p = await getProfile();
  if (!p) return noop;
  const prefs = { ...DEFAULT_PREFERENCES, ...p.preferences };
  const patch: Partial<UserPreferences> = { country: code };
  if (code && countryByCode(code) && prefs.emergencyNumber === emergencyNumberFor(prefs.country)) {
    patch.emergencyNumber = emergencyNumberFor(code);
  }
  return updatePreferences(patch);
}
