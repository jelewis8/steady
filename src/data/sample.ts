/**
 * Sample data — lets someone explore Steady (including Insights) before entering real data.
 * Clearly flagged via profile.isSampleData and removable with one tap.
 */
import { missingDosesForDay, selectTemplate, syncDayItems } from '../core/checklist';
import { buildDefaultTemplates, builtInTriggerTags, defaultProfile, defaultRescueProtocol } from '../core/defaults';
import { uuid } from '../core/ids';
import { addDays, localDateTime, sleepDurationMinutes, todayKey } from '../core/time';
import type {
  DailyCheckIn,
  EmergencyContact,
  HydrationLog,
  MealLog,
  Medication,
  MedicationDose,
  RoutineChecklistItem,
  SeizureEvent,
  SleepEntry,
} from '../core/types';
import { db } from './db';
import { storage } from './storage';

function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const fmt = (mins: number) => {
  const m = ((Math.round(mins) % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
};

export async function loadSampleData(days = 90): Promise<void> {
  const r = rng(20260927);
  const nowIso = new Date().toISOString();
  const today = todayKey();
  const start = addDays(today, -(days - 1));

  await storage.eraseAll();

  const profile = defaultProfile(nowIso);
  profile.displayName = 'Sam';
  profile.onboarded = true;
  profile.isSampleData = true;
  profile.seizureFocus = 'Left temporal';
  profile.preferences.seizureThresholdPerWeek = 3;
  profile.preferences.trackCycle = true;
  profile.preferences.triggerFoods = ['energy drink', 'wine'];

  const triggers = builtInTriggerTags(nowIso);
  const tag = (label: string) => triggers.find((t) => t.label === label)!.id;
  const templates = buildDefaultTemplates(nowIso);

  const meds: Medication[] = [
    {
      id: uuid(), name: 'Lamotrigine', genericName: 'lamotrigine', dosage: '100', unit: 'mg', frequency: 'twice daily',
      scheduledTimes: ['08:00', '20:00'], prescriber: 'Dr. Rivera', pharmacy: 'Main St Pharmacy', remainingCount: 18,
      unitsPerDose: 1, refillDate: null, refillReminderDays: 10, isActive: true, isRescue: false, startDate: addDays(start, -200),
      endDate: null, sideEffectsNoted: ['Mild dizziness'], notes: null, createdAt: nowIso, updatedAt: nowIso,
    },
    {
      id: uuid(), name: 'Levetiracetam', genericName: 'levetiracetam', dosage: '500', unit: 'mg', frequency: 'twice daily',
      scheduledTimes: ['08:00', '20:00'], prescriber: 'Dr. Rivera', pharmacy: 'Main St Pharmacy', remainingCount: 96,
      unitsPerDose: 1, refillDate: null, refillReminderDays: 7, isActive: true, isRescue: false, startDate: addDays(start, -400),
      endDate: null, sideEffectsNoted: ['Irritability (first month)'], notes: 'Take with food', createdAt: nowIso, updatedAt: nowIso,
    },
    {
      id: uuid(), name: 'Midazolam nasal spray', genericName: 'midazolam', dosage: '5', unit: 'mg', frequency: 'as needed',
      scheduledTimes: [], prescriber: 'Dr. Rivera', pharmacy: null, remainingCount: 2, unitsPerDose: 1, refillDate: null,
      refillReminderDays: 0, isActive: true, isRescue: true, startDate: addDays(start, -100), endDate: null,
      sideEffectsNoted: [], notes: 'Rescue only — see action plan', createdAt: nowIso, updatedAt: nowIso,
    },
  ];

  const sleep: SleepEntry[] = [];
  const doses: MedicationDose[] = [];
  const items: RoutineChecklistItem[] = [];
  const water: HydrationLog[] = [];
  const meals: MealLog[] = [];
  const checkIns: DailyCheckIn[] = [];
  const seizures: SeizureEvent[] = [];

  let cycleDay = Math.floor(r() * 28);
  const shortNights = new Set<string>();
  const missedDays = new Set<string>();

  for (let i = 0; i < days; i++) {
    const date = addDays(start, i);
    const isToday = date === today;
    const dow = new Date(localDateTime(date, '12:00')).getDay();
    const weekend = dow === 0 || dow === 6;

    // Last night's sleep (the night of the previous date)
    const night = addDays(date, -1);
    const short = r() < (weekend ? 0.22 : 0.12);
    const bedMin = 22 * 60 + 30 + (r() - 0.3) * 70 + (short ? 110 : 0) + (weekend ? 40 : 0);
    const sleepLen = short ? 280 + r() * 70 : 410 + r() * 80;
    const bed = fmt(bedMin);
    const wake = fmt(bedMin + sleepLen);
    if (short) shortNights.add(date);
    sleep.push({
      id: uuid(), date: night, targetBedtime: '22:30', actualBedtime: bed, targetWakeTime: '07:00', actualWakeTime: wake,
      durationMinutes: sleepDurationMinutes(bed, wake), qualityRating: (short ? 2 : 3 + Math.round(r() * 2)) as 2 | 3 | 4 | 5,
      interruptions: Math.round(r() * (short ? 3 : 1.5)), windDownCompleted: !short && r() > 0.3, notes: null, createdAt: nowIso,
    });

    // Doses
    const dayDoses = missingDosesForDay(meds, date, [], nowIso);
    for (const d of dayDoses) {
      const sched = new Date(d.scheduledTime);
      if (isToday && sched > new Date()) { doses.push(d); continue; }
      const roll = r();
      const missChance = short ? 0.1 : 0.03;
      if (roll < missChance) {
        d.status = r() < 0.5 ? 'skipped' : 'pending';
        missedDays.add(date);
      } else if (roll < missChance + 0.08) {
        d.status = 'taken_late';
        d.actualTime = new Date(sched.getTime() + (70 + r() * 90) * 60000).toISOString();
      } else if (roll < missChance + 0.1) {
        d.status = 'unsure';
      } else {
        d.status = 'taken';
        d.actualTime = new Date(sched.getTime() + (r() * 25 - 5) * 60000).toISOString();
      }
      doses.push(d);
    }

    // Checklist
    const template = selectTemplate(templates, date, null)!;
    const { toAdd } = syncDayItems(template, date, [], nowIso);
    for (const it of toAdd) {
      const at = new Date(localDateTime(date, fmt(it.scheduledHour * 60 + it.scheduledMinute)));
      if (isToday && at > new Date()) { items.push(it); continue; }
      const p = it.isOptional ? 0.7 : 0.9;
      const roll = r();
      if (roll < p) {
        it.status = 'done';
        it.completedAt = new Date(at.getTime() + r() * 40 * 60000).toISOString();
        if (it.category === 'meal') {
          meals.push({
            id: it.id, timestamp: it.completedAt, mealType: it.mealType ?? 'snack', foods: null, triggerFoodsFlagged: [],
            hydrationMl: 0, carbsGrams: null, notes: null, createdAt: nowIso,
          });
        }
        if (it.category === 'hydration') {
          water.push({ id: it.id, timestamp: it.completedAt, amountMl: 250, createdAt: nowIso });
        }
      } else if (roll < p + 0.05) {
        it.status = 'skipped';
      }
      items.push(it);
    }
    // Extra water through the day
    const extra = isToday ? 2 : Math.round(3 + r() * 4);
    for (let g = 0; g < extra; g++) {
      const t = localDateTime(date, fmt(8 * 60 + g * 110 + r() * 40));
      if (new Date(t) > new Date()) break;
      water.push({ id: uuid(), timestamp: t, amountMl: 250, createdAt: nowIso });
    }

    // Check-in
    cycleDay = (cycleDay + 1) % 28;
    const onPeriod = cycleDay < 5;
    const stressy = r() < 0.2;
    if (!isToday && r() < 0.8) {
      checkIns.push({
        id: uuid(), date, stress: (stressy ? 4 + Math.round(r()) : 1 + Math.round(r() * 2)) as 1 | 2 | 3 | 4 | 5,
        mood: (2 + Math.round(r() * 3)) as 2 | 3 | 4 | 5, onPeriod, illness: false, alcoholDrinks: r() < 0.1 ? 2 : 0,
        seizureActivityReported: null, notes: null, createdAt: nowIso, updatedAt: nowIso,
      });
    }

    // Seizures — risk rises with short sleep, missed doses, stress and period (for a realistic demo)
    const prevMissed = missedDays.has(addDays(date, -1)) || missedDays.has(date);
    let risk = 0.025;
    if (short) risk *= 4;
    if (prevMissed) risk *= 3;
    if (stressy) risk *= 1.8;
    if (onPeriod) risk *= 1.6;
    if (!isToday && r() < risk) {
      const hour = r() < 0.55 ? 5 + Math.floor(r() * 4) : 9 + Math.floor(r() * 13);
      const ts = localDateTime(date, fmt(hour * 60 + r() * 59));
      const type = r() < 0.55 ? 'focal_aware' : r() < 0.85 ? 'focal_impaired_awareness' : 'focal_to_bilateral_tonic_clonic';
      const triggerIds: string[] = [];
      if (short) triggerIds.push(tag('Poor sleep'));
      if (prevMissed) triggerIds.push(tag('Missed medication'));
      if (stressy) triggerIds.push(tag('Stress'));
      if (onPeriod && r() < 0.6) triggerIds.push(tag('Period / cycle'));
      const id = uuid();
      const aura = r() < 0.6;
      const auraId = uuid();
      seizures.push({
        id, timestamp: ts, endTimestamp: null, type, durationSeconds: Math.round(30 + r() * (type === 'focal_to_bilateral_tonic_clonic' ? 150 : 90)),
        severity: (type === 'focal_aware' ? 2 : type === 'focal_impaired_awareness' ? 3 : 4 + Math.round(r())) as 1 | 2 | 3 | 4 | 5,
        auraIds: aura ? [auraId] : [], postIctalSymptoms: type === 'focal_aware' ? ['fatigue'] : ['confusion', 'fatigue', 'headache'],
        triggerTagIds: triggerIds, location: r() < 0.7 ? 'Home' : 'Work', activityAtOnset: hour < 9 ? 'Waking up' : 'Resting',
        rescueMedicationUsed: false, rescueMedicationDetails: null, observerPresent: r() < 0.5, observerNotes: null,
        voiceNoteUri: null, notes: null, isQuickLog: r() < 0.3, createdAt: ts, updatedAt: ts,
      });
      if (aura) {
        await db.auraLogs.add({
          id: auraId, seizureEventId: id, timestamp: ts, symptoms: r() < 0.5 ? ['deja_vu', 'epigastric_rising'] : ['fear', 'epigastric_rising'],
          durationSeconds: 20, progressedToSeizure: true, notes: null, createdAt: ts,
        });
      }
    }
  }
  // A couple of standalone auras
  for (let k = 0; k < 4; k++) {
    const ts = localDateTime(addDays(today, -Math.floor(r() * 60) - 1), fmt(10 * 60 + r() * 600));
    await db.auraLogs.add({ id: uuid(), seizureEventId: null, timestamp: ts, symptoms: ['deja_vu'], durationSeconds: 15, progressedToSeizure: false, notes: null, createdAt: ts });
  }

  const contacts: EmergencyContact[] = [
    { id: uuid(), name: 'Jordan', relationship: 'Partner', phone: '+1 555 0100', email: null, notifyOnEmergency: true, canViewRescueProtocol: true, supportPerson: false, sortOrder: 0, createdAt: nowIso },
    { id: uuid(), name: 'Mom', relationship: 'Mother', phone: '+1 555 0101', email: null, notifyOnEmergency: true, canViewRescueProtocol: true, supportPerson: false, sortOrder: 1, createdAt: nowIso },
  ];
  const rescue = defaultRescueProtocol(nowIso);
  rescue.seizureDescription =
    'Usually starts with déjà vu and a rising feeling in my stomach. I may stare, stop responding, and smack my lips or fiddle with my hands for about a minute. Afterwards I am confused and very tired.';
  rescue.rescueMedicationInstructions =
    'If a seizure lasts more than 5 minutes, or I have 3 in an hour: give one spray of midazolam (5 mg) into one nostril. It is in the front pocket of my bag.';
  rescue.allergies = ['Penicillin'];
  rescue.neurologistName = 'Dr. Rivera';
  rescue.neurologistPhone = '+1 555 0199';
  rescue.lastReviewedAt = nowIso;

  await db.transaction('rw', db.tables, async () => {
    await db.profile.put(profile);
    await db.triggerTags.bulkPut(triggers);
    await db.routineTemplates.bulkPut(templates);
    await db.medications.bulkPut(meds);
    await db.medicationDoses.bulkPut(doses);
    await db.routineChecklistItems.bulkPut(items);
    await db.sleepEntries.bulkPut(sleep);
    await db.hydrationLogs.bulkPut(water);
    await db.mealLogs.bulkPut(meals);
    await db.dailyCheckIns.bulkPut(checkIns);
    await db.seizureEvents.bulkPut(seizures);
    await db.emergencyContacts.bulkPut(contacts);
    await db.rescueProtocol.put(rescue);
  });
}
