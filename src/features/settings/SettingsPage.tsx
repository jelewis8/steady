import { useEffect, useState } from 'react';
import { usePrefs, useProfile } from '../../data/hooks';
import { updatePreferences, updateProfile } from '../../data/repo';
import { notifications } from '../reminders/ReminderEngine';
import type { DietMode, ThemePref, UserProfile } from '../../core/types';
import { Button, Card, CardTitle, Disclaimer, Field, Input, PageHeader, Segmented, Select, Toggle } from '../../ui/kit';

/** Text input that keeps local state while typing and saves after a pause. */
function SavedInput({ label, value, onSave, type = 'text', hint, ...rest }: { label: string; value: string; onSave: (v: string) => void; type?: string; hint?: string } & Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'>) {
  const [v, setV] = useState(value);
  useEffect(() => setV(value), [value]);
  useEffect(() => {
    if (v === value) return;
    const t = setTimeout(() => onSave(v), 600);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [v]);
  return (
    <Field label={label} hint={hint}>
      {(id, d) => <Input id={id} aria-describedby={d} type={type} value={v} onChange={(e) => setV(e.target.value)} {...rest} />}
    </Field>
  );
}

function NumberSelect({ label, value, options, onChange, hint }: { label: string; value: number; options: { value: number; label: string }[]; onChange: (v: number) => void; hint?: string }) {
  return (
    <Field label={label} hint={hint}>
      {(id, d) => (
        <Select id={id} aria-describedby={d} value={value} onChange={(e) => onChange(Number(e.target.value))}>
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </Select>
      )}
    </Field>
  );
}

export function SettingsPage() {
  const prefs = usePrefs();
  const profile = useProfile();
  const [perm, setPerm] = useState(notifications.permission());
  if (!prefs || !profile) return null;
  const up = updatePreferences;

  return (
    <div className="grid gap-4 pb-6">
      <PageHeader title="Settings" back="/more" subtitle="Changes save straight away." />

      <Card labelledBy="look-h">
        <CardTitle id="look-h">Appearance</CardTitle>
        <div className="grid gap-4">
          <Segmented<ThemePref>
            label="Theme"
            value={prefs.theme}
            onChange={(theme) => up({ theme })}
            columns={2}
            options={[
              { value: 'system', label: 'Match device' },
              { value: 'light', label: 'Light' },
              { value: 'dark', label: 'Dark' },
              { value: 'contrast', label: 'High contrast' },
            ]}
          />
          <Segmented
            label="Text size"
            value={prefs.textScale}
            onChange={(textScale) => up({ textScale })}
            columns={4}
            options={[
              { value: 1, label: 'A', hint: 'Standard' },
              { value: 1.15, label: 'A+', hint: 'Larger' },
              { value: 1.3, label: 'A++', hint: 'Large' },
              { value: 1.5, label: 'A+++', hint: 'Largest' },
            ]}
          />
          <Toggle
            label="Reduce motion"
            hint="Turns off all movement. Steady already has no flashing and only slow fades."
            checked={prefs.reducedMotion}
            onChange={(reducedMotion) => up({ reducedMotion })}
          />
        </div>
      </Card>

      <Card labelledBy="rem-h">
        <CardTitle id="rem-h">Reminders</CardTitle>
        <div className="grid gap-4">
          <Toggle label="Reminders" checked={prefs.remindersEnabled} onChange={(remindersEnabled) => up({ remindersEnabled })} />
          <div className="rounded-xl bg-surface-2 p-3">
            <p>
              Notifications:{' '}
              <strong>
                {perm === 'granted' ? 'allowed' : perm === 'denied' ? 'blocked in browser settings' : perm === 'unsupported' ? 'not supported here' : 'not asked yet'}
              </strong>
            </p>
            {perm === 'default' && (
              <Button
                className="mt-2"
                variant="primary"
                onClick={async () => {
                  await notifications.requestPermission();
                  setPerm(notifications.permission());
                }}
              >
                Allow notifications
              </Button>
            )}
            {perm === 'granted' && (
              <Button className="mt-2" onClick={() => notifications.show({ title: 'Steady', body: 'This is how reminders will look.', tag: 'test', critical: false })}>
                Send a test reminder
              </Button>
            )}
            <p className="mt-2 text-sm text-ink-2">
              Web apps can only remind you while Steady is open or running in the background. For the most reliable reminders, install Steady to
              your home screen and keep it open. Reminders also appear inside the app.
            </p>
          </div>
          <NumberSelect
            label="Remind me"
            value={prefs.reminderLeadMinutes}
            onChange={(reminderLeadMinutes) => up({ reminderLeadMinutes })}
            options={[
              { value: 0, label: 'At the scheduled time' },
              { value: 5, label: '5 minutes before' },
              { value: 15, label: '15 minutes before' },
              { value: 30, label: '30 minutes before' },
            ]}
          />
          <NumberSelect
            label="Gentle follow-up if a dose isn’t recorded"
            value={prefs.missedDoseWindowMinutes}
            onChange={(missedDoseWindowMinutes) => up({ missedDoseWindowMinutes })}
            hint="Also decides when a dose counts as “taken late”."
            options={[30, 60, 90, 120].map((v) => ({ value: v, label: `${v} minutes after` }))}
          />
          <NumberSelect
            label="Water nudges"
            value={prefs.hydrationNudgeHours}
            onChange={(hydrationNudgeHours) => up({ hydrationNudgeHours })}
            options={[
              { value: 0, label: 'Off' },
              { value: 2, label: 'Every 2 hours' },
              { value: 3, label: 'Every 3 hours' },
            ]}
          />
          <NumberSelect
            label="Wind-down reminder"
            value={prefs.windDownMinutes}
            onChange={(windDownMinutes) => up({ windDownMinutes })}
            options={[
              { value: 0, label: 'Off' },
              { value: 30, label: '30 minutes before bed' },
              { value: 60, label: '1 hour before bed' },
            ]}
          />
          <NumberSelect
            label="Most reminders per day"
            value={prefs.maxNotificationsPerDay}
            onChange={(maxNotificationsPerDay) => up({ maxNotificationsPerDay })}
            hint="Medication reminders are always sent."
            options={[6, 8, 12, 20].map((v) => ({ value: v, label: String(v) }))}
          />
          <Toggle label="End-of-day summary" checked={prefs.dailySummaryEnabled} onChange={(dailySummaryEnabled) => up({ dailySummaryEnabled })} />
          {prefs.dailySummaryEnabled && (
            <Field label="Summary time">{(id) => <Input id={id} type="time" value={prefs.dailySummaryTime} onChange={(e) => up({ dailySummaryTime: e.target.value })} />}</Field>
          )}
        </div>
      </Card>

      <Card labelledBy="today-h">
        <CardTitle id="today-h">Today screen</CardTitle>
        <div className="grid gap-4">
          <Toggle
            label="Show days since last seizure"
            hint="Some people find a count motivating, others find it stressful. Your choice."
            checked={prefs.showSeizureFreeCount}
            onChange={(showSeizureFreeCount) => up({ showSeizureFreeCount })}
          />
          <Toggle label="Ask “Any seizure activity today?” in the evening check-in" checked={prefs.eveningCheckInEnabled} onChange={(eveningCheckInEnabled) => up({ eveningCheckInEnabled })} />
          <NumberSelect
            label="Let me know if seizures in a week go above"
            value={prefs.seizureThresholdPerWeek ?? 0}
            onChange={(v) => up({ seizureThresholdPerWeek: v === 0 ? null : v })}
            hint="Agree a number with your neurologist."
            options={[{ value: 0, label: 'Off' }, ...[1, 2, 3, 4, 5, 7, 10].map((v) => ({ value: v, label: String(v) }))]}
          />
        </div>
      </Card>

      <Card labelledBy="safe-h">
        <CardTitle id="safe-h">Safety</CardTitle>
        <div className="grid gap-4">
          <SavedInput label="Emergency number" value={prefs.emergencyNumber} onSave={(v) => up({ emergencyNumber: v.trim() || '911' })} inputMode="tel" hint="911 in the US, 999 in the UK, 112 in the EU." />
          <NumberSelect
            label="Seizure timer alert after"
            value={prefs.emergencyAfterMinutes}
            onChange={(emergencyAfterMinutes) => up({ emergencyAfterMinutes })}
            hint="Usually 5 minutes. Use what your action plan says."
            options={[2, 3, 4, 5, 10].map((v) => ({ value: v, label: `${v} minutes` }))}
          />
          <NumberSelect
            label="Safe mode lasts"
            value={prefs.safeModeDurationHours}
            onChange={(safeModeDurationHours) => up({ safeModeDurationHours })}
            options={[1, 2, 4, 8, 12, 24].map((v) => ({ value: v, label: `${v} hours` }))}
          />
        </div>
      </Card>

      <Card labelledBy="prof-h">
        <CardTitle id="prof-h">About me</CardTitle>
        <div className="grid gap-4">
          <SavedInput label="Name" value={profile.displayName} onSave={(displayName) => updateProfile({ displayName })} autoComplete="given-name" />
          <Field label="Epilepsy type">
            {(id) => (
              <Select id={id} value={profile.epilepsyType} onChange={(e) => updateProfile({ epilepsyType: e.target.value as UserProfile['epilepsyType'] })}>
                <option value="focal">Focal</option>
                <option value="generalized">Generalized</option>
                <option value="combined">Combined</option>
                <option value="unknown">Not sure</option>
              </Select>
            )}
          </Field>
          <SavedInput label="Where seizures start (if known)" value={profile.seizureFocus ?? ''} onSave={(v) => updateProfile({ seizureFocus: v || null })} placeholder="e.g. Left temporal" />
          <div className="grid gap-3 sm:grid-cols-2">
            <SavedInput label="Date of birth (optional)" type="date" value={profile.dateOfBirth ?? ''} onSave={(v) => updateProfile({ dateOfBirth: v || null })} />
            <SavedInput label="Diagnosed (optional)" type="date" value={profile.diagnosisDate ?? ''} onSave={(v) => updateProfile({ diagnosisDate: v || null })} />
          </div>
          <Toggle
            label="Track my menstrual cycle"
            hint="Adds one question to the evening check-in. About a third of women with epilepsy notice a cycle pattern."
            checked={prefs.trackCycle}
            onChange={(trackCycle) => up({ trackCycle })}
          />
          <Field label="Diet mode" hint="Adds a carb field to meals. Only follow these diets with your epilepsy team.">
            {(id, d) => (
              <Select id={id} aria-describedby={d} value={prefs.dietMode} onChange={(e) => up({ dietMode: e.target.value as DietMode })}>
                <option value="none">None</option>
                <option value="keto">Ketogenic</option>
                <option value="mad">Modified Atkins (MAD)</option>
                <option value="lgit">Low glycemic index (LGIT)</option>
              </Select>
            )}
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <NumberSelect label="Daily water goal" value={prefs.hydrationGoalMl} onChange={(hydrationGoalMl) => up({ hydrationGoalMl })} options={[1500, 1750, 2000, 2250, 2500, 3000].map((v) => ({ value: v, label: `${v} ml` }))} />
            <NumberSelect label="Glass size" value={prefs.glassSizeMl} onChange={(glassSizeMl) => up({ glassSizeMl })} options={[150, 200, 250, 300, 330, 500].map((v) => ({ value: v, label: `${v} ml` }))} />
          </div>
        </div>
      </Card>
      <Disclaimer />
    </div>
  );
}
