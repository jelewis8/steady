import { useLiveQuery } from 'dexie-react-hooks';
import { addDays, localDateTime, todayKey } from '../core/time';
import type { ISODate } from '../core/types';
import { db } from './db';

export function useProfile() {
  return useLiveQuery(() => db.profile.toCollection().first(), []);
}

export function usePrefs() {
  return useProfile()?.preferences;
}

export function useMedications() {
  return useLiveQuery(() => db.medications.toArray(), []) ?? [];
}

export function useDoses(from: ISODate, to: ISODate) {
  return (
    useLiveQuery(
      () => db.medicationDoses.where('scheduledTime').between(localDateTime(from, '00:00'), localDateTime(to, '23:59'), true, true).toArray(),
      [from, to],
    ) ?? []
  );
}

export function useChecklistItems(date: ISODate) {
  return useLiveQuery(() => db.routineChecklistItems.where('date').equals(date).toArray(), [date]);
}

export function useChecklistRange(from: ISODate, to: ISODate) {
  return useLiveQuery(() => db.routineChecklistItems.where('date').between(from, to, true, true).toArray(), [from, to]) ?? [];
}

export function useSeizures() {
  return useLiveQuery(() => db.seizureEvents.orderBy('timestamp').reverse().toArray(), []) ?? [];
}

export function useSeizure(id: string | undefined) {
  return useLiveQuery(() => (id ? db.seizureEvents.get(id) : undefined), [id]);
}

export function useAuras() {
  return useLiveQuery(() => db.auraLogs.orderBy('timestamp').reverse().toArray(), []) ?? [];
}

export function useTriggerTags() {
  return useLiveQuery(() => db.triggerTags.toArray(), []) ?? [];
}

export function useSleepEntries() {
  return useLiveQuery(() => db.sleepEntries.orderBy('date').reverse().toArray(), []) ?? [];
}

export function useHydration(from: ISODate, to: ISODate) {
  return (
    useLiveQuery(
      () => db.hydrationLogs.where('timestamp').between(localDateTime(from, '00:00'), localDateTime(addDays(to, 1), '00:00'), true, false).toArray(),
      [from, to],
    ) ?? []
  );
}

export function useMeals(from: ISODate, to: ISODate) {
  return (
    useLiveQuery(
      () => db.mealLogs.where('timestamp').between(localDateTime(from, '00:00'), localDateTime(addDays(to, 1), '00:00'), true, false).toArray(),
      [from, to],
    ) ?? []
  );
}

export function useCheckIns() {
  return useLiveQuery(() => db.dailyCheckIns.toArray(), []) ?? [];
}

export function useCheckIn(date: ISODate) {
  return useLiveQuery(() => db.dailyCheckIns.where('date').equals(date).first(), [date]);
}

export function useTemplates() {
  return useLiveQuery(() => db.routineTemplates.toArray(), []);
}

export function useDayPlan(date: ISODate) {
  return useLiveQuery(() => db.dayPlans.get(date), [date]);
}

export function useRescueProtocol() {
  return useLiveQuery(() => db.rescueProtocol.toCollection().first(), []);
}

export function useContacts() {
  return useLiveQuery(() => db.emergencyContacts.orderBy('sortOrder').toArray(), []) ?? [];
}

export function useVoiceNote(id: string | null | undefined) {
  return useLiveQuery(() => (id ? db.voiceNotes.get(id) : undefined), [id]);
}

export function useMeta<T>(key: string) {
  return useLiveQuery(async () => ((await db.meta.get(key))?.value as T | undefined) ?? null, [key]);
}

export function useInsightRules() {
  return useLiveQuery(() => db.insightRules.toArray(), []) ?? [];
}

export function useToday(): ISODate {
  return todayKey();
}
