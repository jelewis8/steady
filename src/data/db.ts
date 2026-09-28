import Dexie, { type EntityTable, type Table } from 'dexie';
import type {
  AuraLog,
  DailyCheckIn,
  DayPlan,
  EmergencyContact,
  HydrationLog,
  InsightRule,
  MealLog,
  Medication,
  MedicationDose,
  RescueProtocol,
  RoutineChecklistItem,
  RoutineTemplate,
  SeizureEvent,
  SleepEntry,
  TriggerTag,
  UserProfile,
  VoiceNote,
} from '../core/types';

export interface MetaRow {
  key: string;
  value: unknown;
}

export class SteadyDB extends Dexie {
  profile!: EntityTable<UserProfile, 'id'>;
  seizureEvents!: EntityTable<SeizureEvent, 'id'>;
  auraLogs!: EntityTable<AuraLog, 'id'>;
  medications!: EntityTable<Medication, 'id'>;
  medicationDoses!: EntityTable<MedicationDose, 'id'>;
  mealLogs!: EntityTable<MealLog, 'id'>;
  hydrationLogs!: EntityTable<HydrationLog, 'id'>;
  sleepEntries!: EntityTable<SleepEntry, 'id'>;
  routineTemplates!: EntityTable<RoutineTemplate, 'id'>;
  routineChecklistItems!: EntityTable<RoutineChecklistItem, 'id'>;
  triggerTags!: EntityTable<TriggerTag, 'id'>;
  rescueProtocol!: EntityTable<RescueProtocol, 'id'>;
  emergencyContacts!: EntityTable<EmergencyContact, 'id'>;
  insightRules!: EntityTable<InsightRule, 'id'>;
  dailyCheckIns!: EntityTable<DailyCheckIn, 'id'>;
  dayPlans!: Table<DayPlan, string>;
  voiceNotes!: EntityTable<VoiceNote, 'id'>;
  meta!: Table<MetaRow, string>;

  constructor(name = 'steady') {
    super(name);
    this.version(1).stores({
      profile: 'id',
      seizureEvents: 'id, timestamp',
      auraLogs: 'id, timestamp, seizureEventId',
      medications: 'id, isActive',
      medicationDoses: 'id, medicationId, scheduledTime, [medicationId+scheduledTime]',
      mealLogs: 'id, timestamp',
      hydrationLogs: 'id, timestamp',
      sleepEntries: 'id, &date',
      routineTemplates: 'id',
      routineChecklistItems: 'id, date, [date+templateItemId]',
      triggerTags: 'id, label',
      rescueProtocol: 'id',
      emergencyContacts: 'id, sortOrder',
      insightRules: 'id, correlationType',
      dailyCheckIns: 'id, &date',
      dayPlans: 'date',
      voiceNotes: 'id, seizureEventId',
      meta: 'key',
    });
  }
}

export const db = new SteadyDB();

export async function getMeta<T>(key: string): Promise<T | undefined> {
  return (await db.meta.get(key))?.value as T | undefined;
}

export async function setMeta(key: string, value: unknown): Promise<void> {
  await db.meta.put({ key, value });
}

/** Ask the browser not to evict our data under storage pressure. */
export async function requestPersistentStorage(): Promise<boolean> {
  try {
    if (navigator.storage?.persisted && (await navigator.storage.persisted())) return true;
    return (await navigator.storage?.persist?.()) ?? false;
  } catch {
    return false;
  }
}
