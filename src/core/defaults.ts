import { uuid } from './ids';
import { parseTime } from './time';
import type {
  ISOTime,
  MealType,
  RescueProtocol,
  RoutineCategory,
  RoutineTemplate,
  RoutineTemplateItem,
  SeizureType,
  TriggerCategory,
  TriggerTag,
  UserPreferences,
  UserProfile,
} from './types';

export const APP_NAME = 'Steady';
export const APP_VERSION = '1.0.0';
export const SCHEMA_VERSION = '1.4.0';

export const SEIZURE_TYPE_LABELS: Record<SeizureType, { label: string; hint: string }> = {
  focal_aware: { label: 'Focal aware', hint: 'I stayed aware — I remember it' },
  focal_impaired_awareness: { label: 'Focal impaired awareness', hint: 'I lost awareness or have a gap' },
  focal_to_bilateral_tonic_clonic: { label: 'Focal to bilateral tonic-clonic (formerly grand mal)', hint: 'Spread to a convulsive seizure' },
  unknown: { label: "I don't know", hint: 'That is completely fine' },
};

export const SEVERITY_LABELS = ['', 'Very mild', 'Mild', 'Moderate', 'Strong', 'Severe'] as const;

/** Aura options — knowledge-base.md §1.4 (by lobe), in plain language. */
export const AURA_SYMPTOMS: { key: string; label: string }[] = [
  { key: 'deja_vu', label: 'Déjà vu' },
  { key: 'jamais_vu', label: 'Jamais vu' },
  { key: 'epigastric_rising', label: 'Rising feeling in stomach' },
  { key: 'fear', label: 'Fear or anxiety' },
  { key: 'olfactory', label: 'Strange smell' },
  { key: 'gustatory', label: 'Strange taste' },
  { key: 'visual', label: 'Visual changes' },
  { key: 'auditory', label: 'Sounds changed' },
  { key: 'tingling', label: 'Tingling' },
  { key: 'numbness', label: 'Numbness' },
  { key: 'dizziness', label: 'Dizziness' },
  { key: 'forced_thinking', label: 'Forced thoughts' },
  { key: 'speech_arrest', label: "Couldn't speak" },
  { key: 'throat_tightness', label: 'Throat or chest tightness' },
  { key: 'detachment', label: 'Feeling detached' },
  { key: 'other', label: 'Something else' },
];

/** Post-ictal options — knowledge-base.md §1.4. */
export const POST_ICTAL_SYMPTOMS: { key: string; label: string }[] = [
  { key: 'confusion', label: 'Confusion' },
  { key: 'fatigue', label: 'Tiredness' },
  { key: 'headache', label: 'Headache' },
  { key: 'todds_paresis', label: 'Weakness on one side' },
  { key: 'aphasia', label: 'Trouble finding words' },
  { key: 'mood_change', label: 'Low or anxious mood' },
  { key: 'memory_gap', label: 'Memory gap' },
  { key: 'muscle_ache', label: 'Sore muscles' },
  { key: 'tongue_bite', label: 'Bitten tongue' },
];

/** Built-in triggers — knowledge-base.md §1.5, ordered roughly by evidence strength. */
export const BUILT_IN_TRIGGERS: { label: string; category: TriggerCategory }[] = [
  { label: 'Poor sleep', category: 'sleep' },
  { label: 'Missed medication', category: 'medication' },
  { label: 'Stress', category: 'stress' },
  { label: 'Alcohol', category: 'substance' },
  { label: 'Illness or fever', category: 'illness' },
  { label: 'Period / cycle', category: 'hormonal' },
  { label: 'Dehydration', category: 'diet' },
  { label: 'Skipped meal', category: 'diet' },
  { label: 'Flashing lights', category: 'environmental' },
  { label: 'Overheated', category: 'environmental' },
  { label: 'New medication', category: 'medication' },
  { label: 'Recreational drugs', category: 'substance' },
];

export const LOCATIONS = ['Home', 'Work', 'Outside', 'In a vehicle', 'In bed / asleep', 'Somewhere else'];
export const ACTIVITIES = ['Sleeping', 'Waking up', 'Resting', 'Working', 'Eating', 'Exercising', 'Screens', 'Talking'];

export const CATEGORY_LABELS: Record<RoutineCategory, string> = {
  medication: 'Medication',
  meal: 'Meal',
  hydration: 'Water',
  sleep: 'Sleep',
  exercise: 'Movement',
  stress_check: 'Check-in',
  mood: 'Mood',
  bowel: 'Bowel movement',
  bathroom: 'Bathroom break',
  custom: 'Other',
};

export const MEAL_LABELS: Record<MealType, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
  snack: 'Snack',
};

export const DEFAULT_PREFERENCES: UserPreferences = {
  theme: 'system',
  reducedMotion: false,
  textScale: 1,
  reminderLeadMinutes: 0,
  remindersEnabled: true,
  maxNotificationsPerDay: 12,
  missedDoseWindowMinutes: 60,
  dailySummaryEnabled: false,
  dailySummaryTime: '21:00',
  eveningCheckInEnabled: true,
  seizureThresholdPerWeek: null,
  showSeizureFreeCount: false,
  dietMode: 'none',
  passcodeEnabled: false,
  autoLockMinutes: 5,
  emergencyInfoOnLockScreen: true,
  targetBedtime: '22:30',
  targetWakeTime: '07:00',
  windDownMinutes: 30,
  hydrationGoalMl: 2000,
  glassSizeMl: 250,
  hydrationNudgeHours: 0,
  safeModeDurationHours: 4,
  safeModeUntil: null,
  essentialsOnly: false,
  emergencyNumber: '911',
  emergencyAfterMinutes: 5,
  trackCycle: false,
  triggerFoods: [],
  country: null,
  customSupportLines: [],
  defaultSupportContactId: null,
  trackBathroom: false,
};

export const DEFAULT_SUPPORT_MESSAGE = 'I’m not feeling safe right now. Can you call me or come be with me?';

export function defaultProfile(now: string): UserProfile {
  return {
    id: uuid(),
    displayName: '',
    dateOfBirth: null,
    epilepsyType: 'focal',
    seizureFocus: null,
    diagnosisDate: null,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
    preferences: { ...DEFAULT_PREFERENCES },
    onboarded: false,
    isSampleData: false,
    safetyPlan: null,
    createdAt: now,
    updatedAt: now,
  };
}

export function builtInTriggerTags(now: string): TriggerTag[] {
  return BUILT_IN_TRIGGERS.map((t) => ({ id: uuid(), ...t, isBuiltIn: true, createdAt: now }));
}

export function defaultRescueProtocol(now: string): RescueProtocol {
  return {
    id: uuid(),
    seizureDescription: '',
    rescueMedicationInstructions: null,
    whenToCall911:
      'Call emergency services if a seizure lasts longer than 5 minutes, if seizures happen back to back without recovery in between, if I am injured, if I have trouble breathing, or if it happens in water.',
    allergies: [],
    currentMedications: '',
    neurologistName: null,
    neurologistPhone: null,
    additionalNotes: null,
    howToHelp:
      'Stay calm and stay with me. Time the seizure. Move sharp or hard things away. Do not hold me down. Do not put anything in my mouth. If I fall, cushion my head and turn me on my side when the jerking stops. Speak calmly — I may be confused for a while afterwards.',
    lastReviewedAt: null,
    createdAt: now,
    updatedAt: now,
  };
}

export interface RoutineSetup {
  wakeTime: ISOTime;
  bedTime: ISOTime;
  meals: { type: MealType; time: ISOTime }[];
  water: boolean;
  windDown: boolean;
  movement: ISOTime | null;
  checkIn: boolean;
}

export const DEFAULT_ROUTINE_SETUP: RoutineSetup = {
  wakeTime: '07:00',
  bedTime: '22:30',
  meals: [
    { type: 'breakfast', time: '07:30' },
    { type: 'lunch', time: '12:30' },
    { type: 'dinner', time: '18:30' },
  ],
  water: true,
  windDown: true,
  movement: '16:00',
  checkIn: true,
};

function item(
  time: ISOTime,
  label: string,
  category: RoutineCategory,
  extra: Partial<RoutineTemplateItem> = {},
): RoutineTemplateItem {
  const { hour, minute } = parseTime(time);
  return {
    id: uuid(),
    hour,
    minute,
    label,
    category,
    linkedEntityId: null,
    reminderEnabled: true,
    reminderOffsetMinutes: 0,
    isOptional: false,
    ...extra,
  };
}

function shift(time: ISOTime, deltaMinutes: number): ISOTime {
  const { hour, minute } = parseTime(time);
  const total = (((hour * 60 + minute + deltaMinutes) % 1440) + 1440) % 1440;
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

/** Build the day's routine items from a simple wake/bed/meal setup. */
export function buildRoutineItems(s: RoutineSetup): RoutineTemplateItem[] {
  const items: RoutineTemplateItem[] = [];
  items.push(item(s.wakeTime, 'Wake up & log how I slept', 'sleep', { isEssential: true, reminderEnabled: false }));
  for (const m of s.meals) {
    items.push(item(m.time, MEAL_LABELS[m.type], 'meal', { mealType: m.type, reminderEnabled: true }));
  }
  if (s.water) {
    const wake = parseTime(s.wakeTime).hour;
    const bed = parseTime(s.bedTime).hour || 24;
    for (let h = wake + 2; h < bed - 1; h += 3) {
      items.push(item(`${String(h).padStart(2, '0')}:00`, 'Glass of water', 'hydration', { isOptional: true, reminderEnabled: false }));
    }
  }
  if (s.movement) items.push(item(s.movement, 'Short walk or stretch', 'exercise', { isOptional: true, reminderEnabled: false }));
  if (s.checkIn) items.push(item('20:00', 'How was today? (stress & mood)', 'stress_check', { isOptional: true, reminderEnabled: false }));
  if (s.windDown) {
    items.push(item(shift(s.bedTime, -45), 'Wind down: dim lights, screens away', 'sleep', { isOptional: true }));
  }
  items.push(item(s.bedTime, 'Bedtime', 'sleep', { isEssential: true }));
  return items.sort((a, b) => a.hour * 60 + a.minute - (b.hour * 60 + b.minute));
}

export function buildDefaultTemplates(now: string, setup: RoutineSetup = DEFAULT_ROUTINE_SETUP): RoutineTemplate[] {
  const weekday: RoutineTemplate = {
    id: uuid(),
    name: 'Everyday',
    isDefault: true,
    applicableDays: [0, 1, 2, 3, 4, 5, 6],
    items: buildRoutineItems(setup),
    createdAt: now,
    updatedAt: now,
  };
  const sick: RoutineTemplate = {
    id: uuid(),
    name: 'Rest day',
    isDefault: false,
    applicableDays: [],
    items: [
      item(setup.wakeTime, 'Wake up gently', 'sleep', { isEssential: true, reminderEnabled: false }),
      item(shift(setup.wakeTime, 60), 'Something small to eat', 'meal', { mealType: 'breakfast' }),
      item('11:00', 'Glass of water', 'hydration', { reminderEnabled: false }),
      item('13:00', 'Something small to eat', 'meal', { mealType: 'lunch' }),
      item('15:00', 'Glass of water', 'hydration', { reminderEnabled: false }),
      item('18:30', 'Something small to eat', 'meal', { mealType: 'dinner' }),
      item(setup.bedTime, 'Bedtime', 'sleep', { isEssential: true }),
    ],
    createdAt: now,
    updatedAt: now,
  };
  return [weekday, sick];
}
