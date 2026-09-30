/**
 * Export envelope — app-blueprint.md §2.3 "Export Envelope" and Workflow 4.
 * Versioned, self-describing, no proprietary encoding. Voice notes are embedded as base64.
 */
import { APP_VERSION, SCHEMA_VERSION } from './defaults';
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
} from './types';

export interface ExportedVoiceNote {
  id: string;
  seizureEventId: string | null;
  mimeType: string;
  durationMs: number;
  dataBase64: string;
  createdAt: string;
}

export interface ExportData {
  userProfile: UserProfile | null;
  seizureEvents: SeizureEvent[];
  auraLogs: AuraLog[];
  medications: Medication[];
  medicationDoses: MedicationDose[];
  mealLogs: MealLog[];
  sleepEntries: SleepEntry[];
  routineTemplates: RoutineTemplate[];
  routineChecklistItems: RoutineChecklistItem[];
  triggerTags: TriggerTag[];
  rescueProtocol: RescueProtocol | null;
  emergencyContacts: EmergencyContact[];
  insightRules: InsightRule[];
  hydrationLogs: HydrationLog[];
  dailyCheckIns: DailyCheckIn[];
  dayPlans: DayPlan[];
  voiceNotes: ExportedVoiceNote[];
}

export interface ExportEnvelope {
  $schema: string;
  schemaVersion: string;
  exportedAt: string;
  appVersion: string;
  /** SHA-256 hex of JSON.stringify(data) */
  checksum?: string;
  data: ExportData;
}

export interface EncryptedEnvelope {
  format: 'steady-encrypted-export';
  schemaVersion: string;
  exportedAt: string;
  kdf: { name: 'PBKDF2'; hash: 'SHA-256'; iterations: number; saltBase64: string };
  cipher: { name: 'AES-GCM'; ivBase64: string };
  ciphertextBase64: string;
}

export const EXPORT_SCHEMA_URL = 'https://steady.example.com/schema/export-v1.json';

export const COLLECTION_KEYS = [
  'seizureEvents',
  'auraLogs',
  'medications',
  'medicationDoses',
  'mealLogs',
  'sleepEntries',
  'routineTemplates',
  'routineChecklistItems',
  'triggerTags',
  'emergencyContacts',
  'insightRules',
  'hydrationLogs',
  'dailyCheckIns',
  'dayPlans',
  'voiceNotes',
] as const;
export type CollectionKey = (typeof COLLECTION_KEYS)[number];

export function emptyExportData(): ExportData {
  return {
    userProfile: null,
    seizureEvents: [],
    auraLogs: [],
    medications: [],
    medicationDoses: [],
    mealLogs: [],
    sleepEntries: [],
    routineTemplates: [],
    routineChecklistItems: [],
    triggerTags: [],
    rescueProtocol: null,
    emergencyContacts: [],
    insightRules: [],
    hydrationLogs: [],
    dailyCheckIns: [],
    dayPlans: [],
    voiceNotes: [],
  };
}

export function buildEnvelope(data: ExportData, exportedAt: string): ExportEnvelope {
  return {
    $schema: EXPORT_SCHEMA_URL,
    schemaVersion: SCHEMA_VERSION,
    exportedAt,
    appVersion: APP_VERSION,
    data,
  };
}

export function isEncryptedEnvelope(x: unknown): x is EncryptedEnvelope {
  return typeof x === 'object' && x !== null && (x as EncryptedEnvelope).format === 'steady-encrypted-export';
}

function major(v: string): number {
  return Number(String(v).split('.')[0]) || 0;
}

export type ParseResult =
  | { ok: true; envelope: ExportEnvelope; warnings: string[] }
  | { ok: false; error: string };

/** Validate and migrate an unknown object into the current envelope shape. */
export function parseEnvelope(raw: unknown): ParseResult {
  if (typeof raw !== 'object' || raw === null) return { ok: false, error: 'This file is not a Steady export.' };
  const env = raw as Partial<ExportEnvelope>;
  if (typeof env.schemaVersion !== 'string' || typeof env.data !== 'object' || env.data === null) {
    return { ok: false, error: 'This file is missing a schema version or data section, so it is not a Steady export.' };
  }
  if (major(env.schemaVersion) > major(SCHEMA_VERSION)) {
    return { ok: false, error: `This file was made by a newer version of Steady (schema ${env.schemaVersion}). Please update the app first.` };
  }
  const warnings: string[] = [];
  const data = { ...emptyExportData(), ...(env.data as Partial<ExportData>) } as ExportData;
  for (const key of COLLECTION_KEYS) {
    if (!Array.isArray(data[key])) {
      warnings.push(`"${key}" was not a list and was ignored.`);
      (data as unknown as Record<string, unknown[]>)[key] = [];
    }
  }
  // Migration 1.0.0 → 1.1.0: add fields introduced by extensions with safe defaults.
  data.medications = data.medications.map((m) => Object.assign({ unitsPerDose: 1, isRescue: false }, m));
  data.routineChecklistItems = data.routineChecklistItems.map((c) => Object.assign({ label: 'Routine item', category: 'custom', isOptional: false }, c));
  const requireId = <T extends { id?: unknown }>(arr: T[], name: string) => {
    const bad = arr.filter((x) => typeof x?.id !== 'string').length;
    if (bad) warnings.push(`${bad} ${name} without an id were skipped.`);
    return arr.filter((x) => typeof x?.id === 'string');
  };
  data.seizureEvents = requireId(data.seizureEvents, 'seizure events');
  data.medications = requireId(data.medications, 'medications');
  data.medicationDoses = requireId(data.medicationDoses, 'doses');
  return {
    ok: true,
    envelope: {
      $schema: env.$schema ?? EXPORT_SCHEMA_URL,
      schemaVersion: SCHEMA_VERSION,
      exportedAt: env.exportedAt ?? new Date().toISOString(),
      appVersion: env.appVersion ?? 'unknown',
      checksum: env.checksum,
      data,
    },
    warnings,
  };
}

export function summarizeData(data: ExportData): { label: string; count: number }[] {
  return [
    { label: 'seizure events', count: data.seizureEvents.length },
    { label: 'aura logs', count: data.auraLogs.length },
    { label: 'medications', count: data.medications.length },
    { label: 'dose records', count: data.medicationDoses.length },
    { label: 'sleep entries', count: data.sleepEntries.length },
    { label: 'meal logs', count: data.mealLogs.length },
    { label: 'water logs', count: data.hydrationLogs.length },
    { label: 'checklist records', count: data.routineChecklistItems.length },
    { label: 'daily check-ins', count: data.dailyCheckIns.length },
    { label: 'routines', count: data.routineTemplates.length },
    { label: 'emergency contacts', count: data.emergencyContacts.length },
    { label: 'voice notes', count: data.voiceNotes.length },
  ];
}

/** Categories always named in a restore confirmation, even when the count is 0, so "0 seizure events" is visible. */
const ALWAYS_NAMED = new Set(['seizure events', 'medications', 'dose records', 'sleep entries']);

function singular(label: string): string {
  return label.replace(/ies$/, 'y').replace(/s$/, '');
}

/** "0 seizure events, 1 medication, 9 dose records, …" — the plain-language summary shown after a restore. */
export function describeRestoredData(data: ExportData): string {
  return summarizeData(data)
    .filter((c) => c.count > 0 || ALWAYS_NAMED.has(c.label))
    .map((c) => `${c.count} ${c.count === 1 ? singular(c.label) : c.label}`)
    .join(', ');
}

/**
 * After an import, compare what the file held with what is now on the device.
 * Returns a list of problems; empty means every record from the file is present.
 * (The device may hold MORE than the file: merge keeps existing data, and today's checklist is generated after import.)
 */
export function checkRestore(file: ExportData, device: ExportData, mode: 'merge' | 'replace'): string[] {
  const problems: string[] = [];
  const have = new Map(summarizeData(device).map((c) => [c.label, c.count]));
  for (const c of summarizeData(file)) {
    const n = have.get(c.label) ?? 0;
    if (n < c.count) problems.push(`${c.label}: the backup has ${c.count} but this device has ${n}`);
  }
  if (mode === 'replace' && file.userProfile && device.userProfile?.id !== file.userProfile.id) {
    problems.push('your profile was not restored');
  }
  return problems;
}

/** CSV (tabular subset) — seizures, doses and sleep in one file each. */
function csvEscape(v: unknown): string {
  if (v === null || v === undefined) return '';
  const s = Array.isArray(v) ? v.join('; ') : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(rows: Record<string, unknown>[], columns: string[]): string {
  const lines = [columns.join(',')];
  for (const r of rows) lines.push(columns.map((c) => csvEscape(r[c])).join(','));
  return lines.join('\r\n');
}

export function seizuresCsv(data: ExportData): string {
  const tags = new Map(data.triggerTags.map((t) => [t.id, t.label]));
  const rows = data.seizureEvents
    .slice()
    .sort((a, b) => (a.timestamp < b.timestamp ? -1 : 1))
    .map((s) => ({ ...s, triggers: s.triggerTagIds.map((id) => tags.get(id) ?? id) }));
  return toCsv(rows, [
    'timestamp', 'type', 'severity', 'durationSeconds', 'triggers', 'postIctalSymptoms', 'location',
    'activityAtOnset', 'rescueMedicationUsed', 'observerPresent', 'observerNotes', 'notes', 'isQuickLog',
  ]);
}

export function dosesCsv(data: ExportData): string {
  const meds = new Map(data.medications.map((m) => [m.id, `${m.name} ${m.dosage}`]));
  const rows = data.medicationDoses
    .slice()
    .sort((a, b) => (a.scheduledTime < b.scheduledTime ? -1 : 1))
    .map((d) => ({ ...d, medication: meds.get(d.medicationId) ?? d.medicationId }));
  return toCsv(rows, ['scheduledTime', 'medication', 'status', 'actualTime', 'notes']);
}

export function sleepCsv(data: ExportData): string {
  return toCsv(
    data.sleepEntries.slice().sort((a, b) => (a.date < b.date ? -1 : 1)) as unknown as Record<string, unknown>[],
    ['date', 'actualBedtime', 'actualWakeTime', 'durationMinutes', 'qualityRating', 'interruptions', 'notes'],
  );
}
