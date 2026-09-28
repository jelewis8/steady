/**
 * Pure reminder planning. Consolidates items due at the same minute into one
 * notification (blueprint §2.7 #3), respects the daily cap and safe mode, and
 * never uses shaming language ("Reminder: X is scheduled for 8:00").
 */
import type { ChecklistEntry } from '../../core/checklist';
import { formatClock, localDateTime, parseTime } from '../../core/time';
import type { ISODate, Medication, MedicationDose, RoutineTemplate, UserPreferences } from '../../core/types';
import type { ScheduledNotification } from '../../platform/interfaces';
import { supplyEstimate } from '../../core/stats';

export function planReminders(opts: {
  date: ISODate;
  now: Date;
  entries: ChecklistEntry[];
  doses: MedicationDose[];
  meds: Medication[];
  templates: RoutineTemplate[];
  prefs: UserPreferences;
  safeMode: boolean;
  routineItemTemplateIds: Map<string, string>;
}): ScheduledNotification[] {
  const { date, now, entries, doses, meds, templates, prefs, safeMode } = opts;
  if (!prefs.remindersEnabled) return [];
  const out: ScheduledNotification[] = [];
  const lead = prefs.reminderLeadMinutes;
  const reminderOn = new Map<string, boolean>();
  for (const t of templates) for (const i of t.items) reminderOn.set(i.id, i.reminderEnabled);

  // 1) Scheduled items, grouped by minute.
  const groups = new Map<number, ChecklistEntry[]>();
  for (const e of entries) {
    if (e.status !== 'pending' && e.status !== 'deferred') continue;
    if (e.kind === 'routine') {
      const templateItemId = opts.routineItemTemplateIds.get(e.id);
      if (e.status !== 'deferred' && templateItemId && reminderOn.get(templateItemId) === false) continue;
      if (safeMode) continue; // non-critical reminders are silenced in safe mode
    }
    const at = e.minutes - (e.kind === 'dose' ? lead : e.status === 'deferred' ? 0 : lead);
    groups.set(at, [...(groups.get(at) ?? []), e]);
  }
  for (const [minute, list] of groups) {
    const at = new Date(localDateTime(date, '00:00'));
    at.setMinutes(minute);
    const critical = list.some((e) => e.kind === 'dose');
    const names = list.map((e) => (e.kind === 'dose' ? `${e.label} ${e.detail ?? ''}`.trim() : e.label));
    const when = formatClock(Math.floor(list[0].minutes / 60), list[0].minutes % 60);
    const singleDose = list.length === 1 && list[0].kind === 'dose' ? list[0] : null;
    out.push({
      id: `due:${date}:${minute}:${list.map((e) => e.id).join(',')}`,
      title: `${when} · ${names.join(' + ')}`,
      body: critical ? `Reminder: ${names.join(' and ')} ${list.length > 1 ? 'are' : 'is'} scheduled for ${when}.` : 'A gentle reminder from your routine.',
      at,
      tag: `due-${date}-${minute}`,
      critical,
      url: '/',
      actions: singleDose ? [{ action: 'taken', title: 'Taken' }] : undefined,
      data: singleDose ? { doseId: singleDose.id } : undefined,
    });
  }

  // 2) Gentle follow-up for doses not recorded after the window. Medication reminders stay on in safe mode.
  const medById = new Map(meds.map((m) => [m.id, m]));
  for (const d of doses) {
    if (d.status !== 'pending') continue;
    const med = medById.get(d.medicationId);
    if (!med) continue;
    const at = new Date(new Date(d.scheduledTime).getTime() + prefs.missedDoseWindowMinutes * 60_000);
    const t = new Date(d.scheduledTime);
    out.push({
      id: `follow:${d.id}`,
      title: `${med.name} ${med.dosage}${med.unit}`,
      body: `Reminder: ${med.name} was scheduled for ${formatClock(t.getHours(), t.getMinutes())}. Tap to record it — taken, skipped, or not sure are all fine.`,
      at,
      tag: `follow-${d.id}`,
      critical: true,
      url: '/',
      actions: [{ action: 'taken', title: 'Taken' }],
      data: { doseId: d.id },
    });
  }

  if (!safeMode) {
    // 3) Wind-down
    if (prefs.windDownMinutes > 0) {
      const { hour, minute } = parseTime(prefs.targetBedtime);
      const at = new Date(localDateTime(date, '00:00'));
      at.setMinutes(hour * 60 + minute - prefs.windDownMinutes);
      out.push({ id: `wind:${date}`, title: 'Time to wind down', body: `Bedtime is ${formatClock(hour, minute)}. Lights low, screens away.`, at, tag: `wind-${date}`, critical: false });
    }
    // 4) Hydration nudges
    if (prefs.hydrationNudgeHours > 0) {
      const wake = parseTime(prefs.targetWakeTime).hour;
      const bed = parseTime(prefs.targetBedtime).hour || 24;
      for (let h = wake + prefs.hydrationNudgeHours; h < bed; h += prefs.hydrationNudgeHours) {
        const at = new Date(localDateTime(date, `${String(h).padStart(2, '0')}:15`));
        out.push({ id: `water:${date}:${h}`, title: 'A glass of water?', body: 'Steady sips through the day.', at, tag: `water-${date}-${h}`, critical: false });
      }
    }
    // 5) Refill
    for (const m of meds) {
      if (!m.isActive || m.isRescue) continue;
      const s = supplyEstimate(m, date);
      if (!s.needsRefill || s.daysLeft == null) continue;
      out.push({
        id: `refill:${date}:${m.id}`,
        title: `Refill ${m.name}`,
        body: `About ${s.daysLeft} ${s.daysLeft === 1 ? 'day' : 'days'} of ${m.name} left. Time to arrange a refill.`,
        at: new Date(localDateTime(date, '10:00')),
        tag: `refill-${m.id}`,
        critical: true,
        url: '/meds',
      });
    }
    // 6) End-of-day summary
    if (prefs.dailySummaryEnabled) {
      const done = entries.filter((e) => e.status === 'done').length;
      const total = entries.filter((e) => !e.isOptional || e.status === 'done').length;
      out.push({
        id: `summary:${date}`,
        title: 'Your day',
        body: total ? `${done} of ${total} items done today. Rest well.` : 'Rest well.',
        at: new Date(localDateTime(date, prefs.dailySummaryTime)),
        tag: `summary-${date}`,
        critical: false,
      });
    }
  }

  // Daily cap — critical (medication) reminders are never dropped.
  const sorted = out.filter((n) => n.at.getTime() >= now.getTime() - 60_000).sort((a, b) => a.at.getTime() - b.at.getTime());
  let budget = prefs.maxNotificationsPerDay;
  return sorted.filter((n) => {
    if (n.critical) return true;
    if (budget <= 0) return false;
    budget--;
    return true;
  });
}
