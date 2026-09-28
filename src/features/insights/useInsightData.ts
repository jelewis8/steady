import { useMemo } from 'react';
import { buildDayFeatures, computeInsights, dataReadiness, triggerRanking, timeOfDayCounts, SHORT_SLEEP_MINUTES } from '../../core/insights';
import { adherence, adherenceByDay, averageSleepMinutes, seizureBuckets, seizuresInRange } from '../../core/stats';
import { addDays, dateKeyOf, todayKey } from '../../core/time';
import {
  useAuras,
  useCheckIns,
  useChecklistRange,
  useDoses,
  useHydration,
  useMeals,
  useMedications,
  usePrefs,
  useSeizures,
  useSleepEntries,
  useTriggerTags,
} from '../../data/hooks';

export function useInsightData(days: number) {
  const end = todayKey();
  const start = addDays(end, -(days - 1));
  const seizures = useSeizures();
  const auras = useAuras();
  const doses = useDoses(addDays(start, -1), end);
  const sleep = useSleepEntries();
  const hydration = useHydration(addDays(start, -1), end);
  const meals = useMeals(addDays(start, -1), end);
  const checkIns = useCheckIns();
  const checklist = useChecklistRange(addDays(start, -1), end);
  const triggers = useTriggerTags();
  const meds = useMedications();
  const prefs = usePrefs();
  const goal = prefs?.hydrationGoalMl ?? 2000;

  return useMemo(() => {
    const input = { end, days, seizures, doses, sleep, hydration, meals, checkIns, checklist, triggers, hydrationGoalMl: goal };
    const features = buildDayFeatures(input);
    const inRange = seizuresInRange(seizures, start, end);
    const aurasInRange = auras.filter((a) => {
      const k = dateKeyOf(a.timestamp);
      return k >= start && k <= end;
    });

    // Seizure rate by sleep band the night before
    const bands = [
      { label: 'Under 6 h', test: (m: number) => m < SHORT_SLEEP_MINUTES },
      { label: '6–7 h', test: (m: number) => m >= 360 && m < 420 },
      { label: '7–8 h', test: (m: number) => m >= 420 && m < 480 },
      { label: '8 h or more', test: (m: number) => m >= 480 },
    ].map((b) => {
      const ds = features.filter((f) => f.sleepMinutes != null && b.test(f.sleepMinutes));
      const s = ds.reduce((a, f) => a + f.seizures, 0);
      return { label: b.label, nights: ds.length, seizures: s, per30: ds.length ? Math.round((s / ds.length) * 30 * 10) / 10 : 0 };
    });

    return {
      start,
      end,
      features,
      readiness: dataReadiness(features),
      insights: computeInsights(input),
      seizures: inRange,
      auras: aurasInRange,
      buckets: seizureBuckets(seizures, start, end),
      adherence: adherence(doses, start, end),
      adherenceByDay: adherenceByDay(doses, start, end),
      avgSleep: averageSleepMinutes(sleep, addDays(start, -1), addDays(end, -1)),
      sleepBands: bands,
      triggers: triggerRanking(inRange, triggers),
      timeOfDay: timeOfDayCounts(inRange),
      meds,
      sleep,
      checkIns,
    };
  }, [end, start, days, seizures, auras, doses, sleep, hydration, meals, checkIns, checklist, triggers, meds, goal]);
}
