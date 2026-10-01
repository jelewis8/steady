/**
 * Entity types — mirror app-blueprint.md §2.3.
 * Extensions beyond the blueprint are marked "EXT" and documented in docs/DATA-MODEL.md.
 * This module is pure TypeScript: no DOM, no framework, no platform APIs.
 */

export type UUID = string;
/** ISO 8601 date-time, UTC ("2026-09-27T12:00:00.000Z") */
export type ISODateTime = string;
/** Local calendar date "YYYY-MM-DD" */
export type ISODate = string;
/** Local wall-clock time "HH:mm" */
export type ISOTime = string;

export type ThemePref = 'light' | 'dark' | 'system' | 'contrast';
export type DietMode = 'none' | 'keto' | 'mad' | 'lgit';

export interface UserPreferences {
  theme: ThemePref;
  reducedMotion: boolean;
  /** EXT: text scale, 1 = 100% */
  textScale: number;
  reminderLeadMinutes: number;
  remindersEnabled: boolean;
  /** EXT: maximum notifications per day (blueprint §2.7 #3) */
  maxNotificationsPerDay: number;
  /** EXT: minutes after a scheduled dose before it counts as "late" */
  missedDoseWindowMinutes: number;
  dailySummaryEnabled: boolean;
  dailySummaryTime: ISOTime;
  eveningCheckInEnabled: boolean;
  seizureThresholdPerWeek: number | null;
  showSeizureFreeCount: boolean;
  dietMode: DietMode;
  passcodeEnabled: boolean;
  autoLockMinutes: number;
  /** EXT: show rescue plan on the lock screen (caregiver story, Module 6) */
  emergencyInfoOnLockScreen: boolean;
  /** EXT: sleep targets */
  targetBedtime: ISOTime;
  targetWakeTime: ISOTime;
  windDownMinutes: number;
  /** EXT: hydration */
  hydrationGoalMl: number;
  glassSizeMl: number;
  hydrationNudgeHours: number;
  /** EXT: post-ictal safe mode */
  safeModeDurationHours: number;
  safeModeUntil: ISODateTime | null;
  /** EXT: challenge #1 mitigation — medications + sleep only */
  essentialsOnly: boolean;
  /** EXT: local emergency number */
  emergencyNumber: string;
  /** EXT: minutes after which a running seizure should be treated as an emergency */
  emergencyAfterMinutes: number;
  /** EXT: optional catamenial tracking */
  trackCycle: boolean;
  /** EXT: user-defined trigger foods */
  triggerFoods: string[];
  /** EXT (1.2.0, F-002): ISO country code chosen for crisis lines; null until chosen */
  country: string | null;
  /** EXT (1.2.0, F-002): crisis numbers she added herself */
  customSupportLines: CustomSupportLine[];
  /** EXT (1.2.0, F-002): the main person to reach out to (an EmergencyContact id) */
  defaultSupportContactId: string | null;
  /** EXT (1.4.0, F-006): show the bowel and bladder card, calendar marker and report section */
  trackBathroom: boolean;
}

/** A crisis or support number the user added for her own country or situation. */
export interface CustomSupportLine {
  id: UUID;
  name: string;
  phone: string;
  /** Optional number to text instead of (or as well as) calling */
  textNumber: string | null;
}

/**
 * EXT (1.2.0, F-002): a personal safety plan, in the standard safety-planning sections.
 * Free text written by the user. Stored only on the device; never scored or analysed.
 */
export interface SafetyPlan {
  warningSigns: string;
  copingStrategies: string;
  distractions: string;
  helpers: string;
  professionals: string;
  makingSafe: string;
  reasonsForLiving: string;
  /** The text prefilled when reaching out to a trusted person */
  message: string;
  /** Off by default: show this plan on the lock screen without unlocking */
  showOnLockScreen: boolean;
  updatedAt: ISODateTime;
}

export interface UserProfile {
  id: UUID;
  displayName: string;
  dateOfBirth: ISODate | null;
  epilepsyType: 'focal' | 'generalized' | 'combined' | 'unknown';
  seizureFocus: string | null;
  diagnosisDate: ISODate | null;
  timezone: string;
  preferences: UserPreferences;
  /** EXT: onboarding finished */
  onboarded: boolean;
  /** EXT: true while the database holds generated sample data */
  isSampleData: boolean;
  /** EXT (1.2.0, F-002): personal safety plan; null until she writes one */
  safetyPlan: SafetyPlan | null;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export const SEIZURE_TYPES = [
  'focal_aware',
  'focal_impaired_awareness',
  'focal_to_bilateral_tonic_clonic',
  'unknown',
] as const;
export type SeizureType = (typeof SEIZURE_TYPES)[number];

export interface SeizureEvent {
  id: UUID;
  timestamp: ISODateTime;
  endTimestamp: ISODateTime | null;
  type: SeizureType;
  durationSeconds: number | null;
  severity: 1 | 2 | 3 | 4 | 5;
  auraIds: UUID[];
  postIctalSymptoms: string[];
  triggerTagIds: UUID[];
  location: string | null;
  activityAtOnset: string | null;
  rescueMedicationUsed: boolean;
  rescueMedicationDetails: string | null;
  observerPresent: boolean | null;
  observerNotes: string | null;
  voiceNoteUri: string | null;
  notes: string | null;
  isQuickLog: boolean;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export interface AuraLog {
  id: UUID;
  seizureEventId: UUID | null;
  timestamp: ISODateTime;
  symptoms: string[];
  durationSeconds: number | null;
  progressedToSeizure: boolean;
  notes: string | null;
  createdAt: ISODateTime;
}

export interface Medication {
  id: UUID;
  name: string;
  genericName: string | null;
  dosage: string;
  unit: string;
  frequency: string;
  scheduledTimes: ISOTime[];
  prescriber: string | null;
  pharmacy: string | null;
  remainingCount: number | null;
  /** EXT: units consumed per scheduled dose, for the refill countdown */
  unitsPerDose: number;
  refillDate: ISODate | null;
  refillReminderDays: number;
  isActive: boolean;
  /** EXT: rescue medication — never scheduled, listed in the action plan */
  isRescue: boolean;
  startDate: ISODate;
  endDate: ISODate | null;
  /** Legacy (before 1.3.0): undated side-effect names. Kept so old releases still work; the side-effect log (SideEffectLog) replaces it. */
  sideEffectsNoted: string[];
  notes: string | null;
  /** EXT (1.3.0, F-007): why it was stopped, if she said; null = not recorded */
  stopReason: StopReason | null;
  stopReasonNote: string | null;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export const STOP_REASONS = ['not_controlling', 'side_effects', 'allergic_reaction', 'cost_or_access', 'other'] as const;
export type StopReason = (typeof STOP_REASONS)[number];

export type SideEffectSeverity = 'mild' | 'moderate' | 'severe';

/** EXT (1.3.0, F-001): one side effect, with when it started and stopped. */
/** EXT (1.6.0, F-011): a dated change of dose on one medication. Kept apart from Medication, which only holds the current dose. */
export interface DoseChange {
  id: UUID;
  medicationId: UUID;
  /** the day the new dose started */
  date: ISODate;
  /** the dose before and after, as text, e.g. "100 mg" or "50 mg × 2" */
  from: string;
  to: string;
  note: string | null;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export interface SideEffectLog {
  id: UUID;
  /** null = "not sure which medication" */
  medicationId: UUID | null;
  name: string;
  /** null = "date unknown" (including everything migrated from the old undated list) */
  startDate: ISODate | null;
  /** null = still happening or not known */
  endDate: ISODate | null;
  severity: SideEffectSeverity | null;
  notes: string | null;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export type DoseStatus = 'pending' | 'taken' | 'taken_late' | 'skipped' | 'unsure';

export interface MedicationDose {
  id: UUID;
  medicationId: UUID;
  scheduledTime: ISODateTime;
  actualTime: ISODateTime | null;
  status: DoseStatus;
  sideEffects: string[];
  notes: string | null;
  createdAt: ISODateTime;
}

export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';

export interface MealLog {
  id: UUID;
  timestamp: ISODateTime;
  mealType: MealType;
  foods: string | null;
  triggerFoodsFlagged: string[];
  hydrationMl: number;
  carbsGrams: number | null;
  notes: string | null;
  createdAt: ISODateTime;
}

/** EXT: single water intake event (tap-to-add widget). */
export interface HydrationLog {
  id: UUID;
  timestamp: ISODateTime;
  amountMl: number;
  createdAt: ISODateTime;
}

export interface SleepEntry {
  id: UUID;
  /** The night of — e.g. 2026-09-26 for the night of Sep 26–27 */
  date: ISODate;
  targetBedtime: ISOTime;
  actualBedtime: ISOTime | null;
  targetWakeTime: ISOTime;
  actualWakeTime: ISOTime | null;
  durationMinutes: number | null;
  qualityRating: 1 | 2 | 3 | 4 | 5 | null;
  interruptions: number;
  windDownCompleted: boolean;
  notes: string | null;
  createdAt: ISODateTime;
}

export const ROUTINE_CATEGORIES = [
  'medication',
  'meal',
  'hydration',
  'sleep',
  'exercise',
  'stress_check',
  'mood',
  'bowel',
  'bathroom',
  'custom',
] as const;
export type RoutineCategory = (typeof ROUTINE_CATEGORIES)[number];

export interface RoutineTemplateItem {
  id: UUID;
  hour: number;
  minute: number;
  label: string;
  category: RoutineCategory;
  linkedEntityId: UUID | null;
  reminderEnabled: boolean;
  reminderOffsetMinutes: number;
  isOptional: boolean;
  /** EXT: kept even in essentials-only mode */
  isEssential?: boolean;
  /** EXT: for meal items — which meal this is */
  mealType?: MealType;
}

export type DoseShiftWhich = 'all' | 'morning';

export interface RoutineTemplate {
  id: UUID;
  name: string;
  isDefault: boolean;
  /** 0=Sunday … 6=Saturday. Empty = manually selected only. */
  applicableDays: number[];
  /** EXT (1.4.0, F-008): use this routine every N days (N >= 2), counting from repeatStartDate, instead of by weekday. null/absent = by weekday. */
  repeatEveryDays?: number | null;
  repeatStartDate?: ISODate | null;
  /** EXT (1.4.0, F-008): on days this routine is used, scheduled medication times move LATER by this many minutes (0 = no change). Only ever set by her, never suggested. */
  doseShiftMinutes?: number;
  doseShiftWhich?: DoseShiftWhich;
  items: RoutineTemplateItem[];
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export type BowelHow = 'hard' | 'normal' | 'loose';

/** EXT (1.4.0, F-006): one record per day for bowel and bladder. Private, plain-language, never scored. */
export interface BathroomLog {
  id: UUID;
  /** unique per day */
  date: ISODate;
  /** "Did you have a bowel movement today?" null = not answered */
  bowel: boolean | null;
  bowelHow: BowelHow | null;
  /** what she ate or drank beforehand, or anything else she wants to note */
  bowelNotes: string | null;
  /** how many times she urinated (a one-tap counter) */
  urinationCount: number;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export type ChecklistStatus = 'pending' | 'done' | 'skipped' | 'deferred';

export interface RoutineChecklistItem {
  id: UUID;
  templateItemId: UUID;
  templateId: UUID;
  date: ISODate;
  scheduledHour: number;
  scheduledMinute: number;
  status: ChecklistStatus;
  completedAt: ISODateTime | null;
  notes: string | null;
  /** EXT: snapshot so history survives template edits */
  label: string;
  category: RoutineCategory;
  isOptional: boolean;
  isEssential?: boolean;
  mealType?: MealType;
  /** EXT: when deferred, show again at this time */
  deferredUntil?: ISODateTime | null;
  /** EXT: ad-hoc item added just for today */
  isAdHoc?: boolean;
  createdAt: ISODateTime;
}

export const TRIGGER_CATEGORIES = [
  'sleep',
  'medication',
  'diet',
  'stress',
  'substance',
  'hormonal',
  'illness',
  'environmental',
  'other',
] as const;
export type TriggerCategory = (typeof TRIGGER_CATEGORIES)[number];

export interface TriggerTag {
  id: UUID;
  label: string;
  category: TriggerCategory;
  isBuiltIn: boolean;
  createdAt: ISODateTime;
}

export interface RescueProtocol {
  id: UUID;
  seizureDescription: string;
  rescueMedicationInstructions: string | null;
  whenToCall911: string;
  allergies: string[];
  currentMedications: string;
  neurologistName: string | null;
  neurologistPhone: string | null;
  additionalNotes: string | null;
  /** EXT: plain-language "what helps me" list for bystanders */
  howToHelp: string | null;
  lastReviewedAt: ISODateTime | null;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

export interface EmergencyContact {
  id: UUID;
  name: string;
  relationship: string;
  phone: string;
  email: string | null;
  notifyOnEmergency: boolean;
  canViewRescueProtocol: boolean;
  /** EXT (1.2.0, F-002): someone she can reach out to when she isn't feeling safe */
  supportPerson: boolean;
  sortOrder: number;
  createdAt: ISODateTime;
}

export const CORRELATION_TYPES = [
  'sleep_duration_vs_seizures',
  'adherence_vs_seizures',
  'meal_regularity_vs_seizures',
  'hydration_vs_seizures',
  'trigger_frequency',
  'time_of_day_pattern',
  'day_of_week_pattern',
  'custom',
] as const;
export type CorrelationType = (typeof CORRELATION_TYPES)[number];
export type Confidence = 'low' | 'moderate' | 'high';

export interface InsightRule {
  id: UUID;
  correlationType: CorrelationType;
  timeRangeDays: number;
  variables: Record<string, unknown>;
  confidenceLevel: Confidence;
  plainLanguageSummary: string;
  generatedAt: ISODateTime;
  dismissedByUser: boolean;
}

/** EXT: optional daily check-in (stress, mood, cycle) feeding the insight engine. */
export interface DailyCheckIn {
  id: UUID;
  date: ISODate;
  stress: 1 | 2 | 3 | 4 | 5 | null;
  mood: 1 | 2 | 3 | 4 | 5 | null;
  /** EXT (1.5.0, F-009): "how low or depressed have you felt?" 1 (not at all) to 5 (very). Self-rated, never scored or interpreted. */
  depression?: 1 | 2 | 3 | 4 | 5 | null;
  /** EXT (1.5.0, F-009): "how anxious have you felt?" 1 to 5 */
  anxiety?: 1 | 2 | 3 | 4 | 5 | null;
  /** EXT (1.5.0, F-009): the "why?" diary note. Private to her; only goes in the report if she chooses. */
  feelingsNote?: string | null;
  onPeriod: boolean | null;
  illness: boolean | null;
  alcoholDrinks: number | null;
  /** answer to "Any seizure activity today?" */
  seizureActivityReported: boolean | null;
  notes: string | null;
  createdAt: ISODateTime;
  updatedAt: ISODateTime;
}

/** EXT: which template to use on a given day (e.g. "Sick day"). */
export interface DayPlan {
  date: ISODate;
  templateId: UUID;
}

/** EXT: voice recording stored locally. */
export interface VoiceNote {
  id: UUID;
  seizureEventId: UUID | null;
  blob: Blob;
  mimeType: string;
  durationMs: number;
  createdAt: ISODateTime;
}
