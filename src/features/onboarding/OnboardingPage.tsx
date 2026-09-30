import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, Lock, Plus, Sparkles, Trash2 } from 'lucide-react';
import { DEFAULT_ROUTINE_SETUP, type RoutineSetup } from '../../core/defaults';
import { sortTimes } from '../../core/checklist';
import { parseUnitsPerDose } from '../../core/stats';
import { formatClock, parseTime, todayKey } from '../../core/time';
import type { Medication } from '../../core/types';
import { usePrefs } from '../../data/hooks';
import { ensureDay, initDatabase, newContact, newMedication, replaceRoutineFromSetup, saveContact, saveMedication, updatePreferences, updateProfile } from '../../data/repo';
import { loadSampleData } from '../../data/sample';
import { notifications } from '../reminders/ReminderEngine';
import { COUNTRIES, emergencyNumberFor } from '../../core/crisisLines';
import { Button, Card, Chip, Disclaimer, Field, IconButton, Input, Progress, Select, TextField } from '../../ui/kit';
import { RoutineSetupForm } from '../routine/RoutineSetupForm';
import { ImportCard } from '../settings/DataPage';

type QuickMed = { name: string; dosage: string; unit: string; perDose: string; times: string[] };
const STEPS = ['About you', 'Your day', 'Medications', 'Safety', 'Reminders'];

export function OnboardingPage() {
  const nav = useNavigate();
  const prefs = usePrefs();
  const [step, setStep] = useState(-1);
  const [name, setName] = useState('');
  const [setup, setSetup] = useState<RoutineSetup>(DEFAULT_ROUTINE_SETUP);
  const [meds, setMeds] = useState<QuickMed[]>([]);
  const [contact, setContact] = useState({ name: '', phone: '' });
  const [number, setNumber] = useState('911');
  const [country, setCountry] = useState('');
  const [restoring, setRestoring] = useState(false);
  const [loadingSample, setLoadingSample] = useState(false);

  const next = () => setStep((s) => s + 1);
  const back = () => setStep((s) => s - 1);

  async function finish() {
    await updateProfile({ displayName: name.trim(), onboarded: true });
    await updatePreferences({ targetWakeTime: setup.wakeTime, targetBedtime: setup.bedTime, emergencyNumber: number.trim() || '911', country: country || null });
    await replaceRoutineFromSetup(setup);
    for (const q of meds.filter((m) => m.name.trim() && m.dosage.trim())) {
      const m: Medication = { ...newMedication(), name: q.name.trim(), dosage: q.dosage.trim(), unit: q.unit.trim(), scheduledTimes: sortTimes(q.times), unitsPerDose: parseUnitsPerDose(q.perDose) ?? 1 };
      await saveMedication(m);
    }
    if (contact.name.trim() && contact.phone.trim()) {
      await saveContact({ ...newContact(0), name: contact.name.trim(), phone: contact.phone.trim() });
    }
    await ensureDay(todayKey());
    nav('/', { replace: true });
  }

  if (step === -1) {
    return (
      <main className="mx-auto grid max-w-xl gap-5 p-5 pt-[max(2rem,env(safe-area-inset-top))]">
        <img src="/favicon.svg" alt="" width={72} height={72} className="rounded-2xl" />
        <h1 className="text-4xl font-bold">Welcome to Steady</h1>
        <p className="text-xl">A calm daily companion for living with epilepsy: your routine, your medications, a simple seizure log, and help when you need it.</p>
        <Card tone="ok">
          <p className="flex gap-2 font-bold">
            <Lock aria-hidden size={22} className="shrink-0" /> Everything stays on this device.
          </p>
          <p className="mt-1">No account, no cloud, no tracking. Only you decide if anything is shared.</p>
        </Card>
        <Button variant="primary" size="xl" onClick={next}>
          Set up (about 3 minutes)
        </Button>
        <Button
          size="lg"
          icon={<Sparkles aria-hidden size={22} />}
          disabled={loadingSample}
          onClick={async () => {
            setLoadingSample(true);
            await loadSampleData();
            window.location.assign('/');
          }}
        >
          {loadingSample ? 'Creating sample data…' : 'Just look around with sample data'}
        </Button>
        <Button variant="ghost" aria-expanded={restoring} onClick={() => setRestoring((v) => !v)}>
          I have a backup file to restore
        </Button>
        {restoring && (
          <ImportCard
            onImported={async () => {
              await initDatabase();
              await updateProfile({ onboarded: true });
            }}
            onContinue={() => window.location.assign('/')}
            continueLabel="Open Steady"
          />
        )}
        <Disclaimer />
      </main>
    );
  }

  const isLast = step === STEPS.length - 1;
  return (
    <main className="mx-auto grid max-w-xl gap-5 p-5 pt-[max(1.5rem,env(safe-area-inset-top))] pb-10">
      <div>
        <p className="mb-2 text-ink-2">
          Step {step + 1} of {STEPS.length}
        </p>
        <Progress value={((step + 1) / STEPS.length) * 100} label={`Setup step ${step + 1} of ${STEPS.length}`} />
      </div>

      {step === 0 && (
        <section className="grid gap-4">
          <h1 className="text-3xl font-bold">What should we call you?</h1>
          <TextField label="First name or nickname (optional)" value={name} onChange={setName} autoComplete="given-name" />
          <p className="text-ink-2">Used for greetings and on your action plan. You can leave it blank.</p>
        </section>
      )}

      {step === 1 && (
        <section className="grid gap-4">
          <h1 className="text-3xl font-bold">Your usual day</h1>
          <p className="text-ink-2">Steady builds a gentle routine from this. Regular sleep and meals are two of the most helpful habits. You can change anything later.</p>
          <RoutineSetupForm value={setup} onChange={setSetup} />
        </section>
      )}

      {step === 2 && (
        <section className="grid gap-4">
          <h1 className="text-3xl font-bold">Daily medications</h1>
          <p className="text-ink-2">Add them now for reminders and a clear “did I take it?” record — or skip and add them later.</p>
          {meds.map((m, i) => (
            <Card key={i}>
              <div className="grid gap-3">
                <div className="flex items-end gap-2">
                  <div className="flex-1">
                    <TextField label="Name" value={m.name} onChange={(v) => setMeds(meds.map((x, j) => (j === i ? { ...x, name: v } : x)))} autoComplete="off" />
                  </div>
                  <IconButton label={`Remove medication ${i + 1}`} onClick={() => setMeds(meds.filter((_, j) => j !== i))}>
                    <Trash2 aria-hidden size={22} />
                  </IconButton>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <TextField label="Dose" value={m.dosage} onChange={(v) => setMeds(meds.map((x, j) => (j === i ? { ...x, dosage: v } : x)))} inputMode="decimal" />
                  <TextField label="Unit" value={m.unit} onChange={(v) => setMeds(meds.map((x, j) => (j === i ? { ...x, unit: v } : x)))} placeholder="mg" />
                  <TextField label="Used per dose" value={m.perDose} onChange={(v) => setMeds(meds.map((x, j) => (j === i ? { ...x, perDose: v } : x)))} inputMode="decimal" />
                </div>
                <p className="-mt-1 text-sm text-ink-2">“Used per dose” is how many pills you take each time, for example 2.</p>
                <fieldset>
                  <legend className="mb-1.5 font-bold">When</legend>
                  <div className="flex flex-wrap gap-2">
                    {['08:00', '12:00', '14:00', '20:00', '22:00'].map((t) => (
                      <Chip
                        key={t}
                        pressed={m.times.includes(t)}
                        onClick={() => setMeds(meds.map((x, j) => (j === i ? { ...x, times: x.times.includes(t) ? x.times.filter((y) => y !== t) : [...x.times, t] } : x)))}
                      >
                        {formatClock(parseTime(t).hour, 0)}
                      </Chip>
                    ))}
                  </div>
                  <p className="mt-1 text-sm text-ink-2">Exact times can be set later in Medications.</p>
                </fieldset>
              </div>
            </Card>
          ))}
          <Button icon={<Plus aria-hidden size={20} />} onClick={() => setMeds([...meds, { name: '', dosage: '', unit: 'mg', perDose: '1', times: ['08:00', '20:00'] }])}>
            Add a medication
          </Button>
        </section>
      )}

      {step === 3 && (
        <section className="grid gap-4">
          <h1 className="text-3xl font-bold">If you need help</h1>
          <p className="text-ink-2">Who should be easy to reach? This person appears on your SOS screen. You can add more, and fill in your action plan, later.</p>
          <TextField label="Their name" value={contact.name} onChange={(v) => setContact({ ...contact, name: v })} autoComplete="off" />
          <TextField label="Their phone number" type="tel" value={contact.phone} onChange={(v) => setContact({ ...contact, phone: v })} autoComplete="off" />
          <Field label="Country" hint="So Steady can show the right emergency number and crisis lines. You can skip this and choose later.">
            {(id, d) => (
              <Select
                id={id}
                aria-describedby={d}
                value={country}
                onChange={(e) => {
                  setCountry(e.target.value);
                  if (e.target.value && e.target.value !== 'other') setNumber(emergencyNumberFor(e.target.value));
                }}
              >
                <option value="">Choose a country…</option>
                {COUNTRIES.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.name}
                  </option>
                ))}
                <option value="other">Somewhere else</option>
              </Select>
            )}
          </Field>
          <Field label="Emergency number where you live" hint="Filled in from your country. Change it if yours is different.">
            {(id, d) => <Input id={id} aria-describedby={d} inputMode="tel" value={number} onChange={(e) => setNumber(e.target.value)} />}
          </Field>
        </section>
      )}

      {step === 4 && (
        <section className="grid gap-4">
          <h1 className="text-3xl font-bold">Reminders</h1>
          <p>Steady can remind you about medications and your routine. Reminders are gentle and never nag.</p>
          {notifications.permission() === 'granted' ? (
            <p className="font-bold">✓ Notifications are allowed.</p>
          ) : notifications.permission() === 'unsupported' ? (
            <p>This browser can’t show notifications. Reminders will appear inside Steady instead.</p>
          ) : (
            <Button variant="primary" size="lg" icon={<Bell aria-hidden size={22} />} onClick={() => notifications.requestPermission().then(() => setStep(4))}>
              Allow notifications
            </Button>
          )}
          <Card>
            <p className="font-bold">Tip: add Steady to your home screen</p>
            <p className="mt-1 text-ink-2">
              It then opens like an app, works offline, and reminders are more reliable. On iPhone: Share → Add to Home Screen. On Android: menu → Install
              app.
            </p>
          </Card>
          <p className="text-sm text-ink-2">Theme {prefs?.theme === 'system' ? 'follows your device' : prefs?.theme}. Text size and high-contrast mode are in Settings.</p>
        </section>
      )}

      <div className="grid grid-cols-2 gap-2">
        <Button size="lg" onClick={back}>
          Back
        </Button>
        <Button variant="primary" size="lg" onClick={isLast ? finish : next}>
          {isLast ? 'Finish' : 'Next'}
        </Button>
      </div>
      {!isLast && (
        <Button variant="ghost" onClick={next}>
          Skip this step
        </Button>
      )}
    </main>
  );
}
