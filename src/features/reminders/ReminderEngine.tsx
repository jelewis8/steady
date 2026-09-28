import { useEffect, useMemo } from 'react';
import { buildChecklistView } from '../../core/checklist';
import { todayKey } from '../../core/time';
import { useChecklistItems, useDoses, useMedications, usePrefs, useTemplates } from '../../data/hooks';
import { createWebNotificationScheduler } from '../../platform/notifications';
import { useUI } from '../../state/ui';
import { isSafeMode, useNow } from '../../ui/hooks';
import { planReminders } from './planReminders';

/** App-wide notification scheduler (web implementation of NotificationScheduler). */
export const notifications = createWebNotificationScheduler((n) => {
  // Always echo reminders inside the app too — works even without notification permission.
  useUI.getState().pushToast({ message: n.title, tone: 'reminder' });
});

/** Recomputes the day's reminders whenever the checklist, doses or settings change. Renders nothing. */
export function ReminderEngine() {
  const now = useNow(60_000);
  const today = todayKey(now);
  const prefs = usePrefs();
  const items = useChecklistItems(today);
  const doses = useDoses(today, today);
  const meds = useMedications();
  const templates = useTemplates();

  const plan = useMemo(() => {
    if (!prefs || !items || !templates) return [];
    const view = buildChecklistView({ date: today, items, doses, meds, now, isToday: true, essentialsOnly: prefs.essentialsOnly });
    return planReminders({
      date: today,
      now,
      entries: view.entries,
      doses,
      meds,
      templates,
      prefs,
      safeMode: isSafeMode(prefs, now),
      routineItemTemplateIds: new Map(items.map((i) => [i.id, i.templateItemId])),
    });
  }, [prefs, items, templates, doses, meds, today, now]);

  useEffect(() => {
    void (async () => {
      await notifications.cancelAll();
      for (const n of plan) await notifications.schedule(n);
    })();
  }, [plan]);

  return null;
}
