import Dexie, { type EntityTable, type Table } from 'dexie';
import { sideEffectsFromNotes } from '../core/sideEffects';
import type {
  AuraLog,
  BathroomLog,
  DailyCheckIn,
  DayPlan,
  DoseChange,
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
  SideEffectLog,
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
  sideEffects!: EntityTable<SideEffectLog, 'id'>;
  bathroomLogs!: EntityTable<BathroomLog, 'id'>;
  doseChanges!: EntityTable<DoseChange, 'id'>;
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
    // Release 2026-09-30-4 (F-001, F-007): a table for the dated side-effect log. Existing tables are unchanged.
    // The upgrade turns each medication's old undated side-effect names into "date unknown" entries.
    // It never deletes or edits the old field, so rolling back to an earlier release loses nothing.
    this.version(2)
      .stores({ sideEffects: 'id, medicationId, startDate' })
      .upgrade(async (tx) => {
        const meds = await tx.table('medications').toArray();
        const rows = sideEffectsFromNotes(meds);
        if (rows.length) await tx.table('sideEffects').bulkPut(rows);
      });
    // Release 2026-09-30-6 (F-006): a table for bowel and bladder records, one per day. Nothing existing is changed or migrated.
    this.version(3).stores({ bathroomLogs: 'id, &date' });
    // Release 2026-10-01-5 (F-011): a table for dated dose changes. Nothing existing is changed or migrated: the table starts empty,
    // and a medication's current dose stays on the medication exactly as before.
    this.version(4).stores({ doseChanges: 'id, medicationId, date' });
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
