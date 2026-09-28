import { useMemo } from 'react';
import { buildChecklistView, routineConsistency } from '../../core/checklist';
import { addDays, dateKeyOf, dateRange, todayKey } from '../../core/time';
import { useChecklistItems, useChecklistRange, useDoses, useMedications, usePrefs } from '../../data/hooks';

export function useDayView(date: string, now: Date) {
  const prefs = usePrefs();
  const items = useChecklistItems(date);
  const doses = useDoses(date, date);
  const meds = useMedications();
  const view = useMemo(
    () =>
      buildChecklistView({
        date,
        items: items ?? [],
        doses,
        meds,
        now,
        isToday: date === todayKey(now),
        essentialsOnly: prefs?.essentialsOnly,
      }),
    [date, items, doses, meds, now, prefs?.essentialsOnly],
  );
  return { view, loading: items === undefined, meds, doses };
}

/** Last two weeks of completion, for gentle consistency messages. */
export function useConsistency(today: string) {
  const from = addDays(today, -14);
  const to = addDays(today, -1);
  const items = useChecklistRange(from, to);
  const doses = useDoses(from, to);
  const meds = useMedications();
  return useMemo(() => {
    const days = dateRange(from, to).map((date) => {
      const v = buildChecklistView({
        date,
        items: items.filter((i) => i.date === date),
        doses: doses.filter((d) => dateKeyOf(d.scheduledTime) === date),
        meds,
        now: new Date(),
        isToday: false,
      });
      return { date, percent: v.percent, total: v.total };
    });
    return routineConsistency(days, today);
  }, [items, doses, meds, from, to, today]);
}
