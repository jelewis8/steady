import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { BedDouble, Droplet, HeartPulse, Lightbulb, Minus, Pill, Plus } from 'lucide-react';
import { computeInsights } from '../../core/insights';
import { adherence, averageSleepMinutes, seizuresInRange, supplyEstimate } from '../../core/stats';
import { addDays, dateKeyOf, formatHours, formatIsoClock, formatTimeKey, relativeDay, todayKey } from '../../core/time';
import {
  useCheckIn,
  useCheckIns,
  useChecklistRange,
  useDoses,
  useHydration,
  useMeals,
  useMedications,
  useMeta,
  usePrefs,
  useSeizures,
  useSleepEntries,
  useTriggerTags,
} from '../../data/hooks';
import { addWater, cancelSleepTimer, removeLatestWaterToday, startSleepTimer } from '../../data/repo';
import { toast } from '../../state/ui';
import { Button, Card, CardTitle, Stat } from '../../ui/kit';
import { SleepLogSheet } from '../sleep/SleepLogSheet';
import { CheckInSheet } from './CheckInSheet';

export function MedCard({ now }: { now: Date }) {
  const today = todayKey(now);
  const meds = useMedications().filter((m) => m.isActive && !m.isRescue);
  const doses = useDoses(addDays(today, -2), today);
  if (meds.length === 0) {
    return (
      <Card labelledBy="med-h">
        <CardTitle id="med-h" icon={<Pill aria-hidden size={20} />}>
          Medications
        </CardTitle>
        <p className="text-ink-2">Add your medications to get reminders and a simple “did I take it?” answer.</p>
        <Link to="/meds/new" className="tap mt-2 inline-flex items-center font-bold text-accent-text underline underline-offset-4">
          Add a medication
        </Link>
      </Card>
    );
  }
  return (
    <Card labelledBy="med-h">
      <CardTitle
        id="med-h"
        icon={<Pill aria-hidden size={20} />}
        action={
          <Link to="/meds" className="tap inline-flex items-center px-2 font-bold text-accent-text underline underline-offset-4">
            All meds
          </Link>
        }
      >
        Did I take it?
      </CardTitle>
      <ul className="grid gap-3">
        {meds.map((m) => {
          const mine = doses.filter((d) => d.medicationId === m.id);
          const lastTaken = mine
            .filter((d) => (d.status === 'taken' || d.status === 'taken_late') && d.actualTime)
            .sort((a, b) => (a.actualTime! < b.actualTime! ? 1 : -1))[0];
          const next = mine
            .filter((d) => d.status === 'pending' && new Date(d.scheduledTime) > now)
            .sort((a, b) => (a.scheduledTime < b.scheduledTime ? -1 : 1))[0];
          const supply = supplyEstimate(m, today);
          return (
            <li key={m.id} className="rounded-xl bg-surface-2 p-3">
              <div className="font-bold">
                {m.name} <span className="font-normal text-ink-2">{m.dosage} {m.unit}</span>
              </div>
              <div>
                {lastTaken ? (
                  <>
                    Last taken: <strong>{relativeDay(dateKeyOf(lastTaken.actualTime!), today)} at {formatIsoClock(lastTaken.actualTime!)}</strong>
                  </>
                ) : (
                  <span className="text-ink-2">No dose recorded in the last 2 days.</span>
                )}
              </div>
              {next && <div className="text-ink-2">Next: {formatIsoClock(next.scheduledTime)}</div>}
              {supply.needsRefill && supply.daysLeft != null && (
                <div className="mt-1 font-bold text-attn-ink">
                  ↻ About {supply.daysLeft} {supply.daysLeft === 1 ? 'day' : 'days'} left — time to arrange a refill.
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

export function WaterCard({ today }: { today: string }) {
  const prefs = usePrefs();
  const logs = useHydration(today, today);
  const meals = useMeals(today, today);
  const glass = prefs?.glassSizeMl ?? 250;
  const goal = prefs?.hydrationGoalMl ?? 2000;
  const total = logs.reduce((a, l) => a + l.amountMl, 0) + meals.reduce((a, m) => a + (m.hydrationMl || 0), 0);
  const glasses = Math.round(total / glass);
  const goalGlasses = Math.max(1, Math.round(goal / glass));
  if (prefs?.essentialsOnly) return null;
  return (
    <Card labelledBy="water-h">
      <CardTitle id="water-h" icon={<Droplet aria-hidden size={20} />}>
        Water
      </CardTitle>
      <p className="text-lg">
        <strong>{glasses}</strong> of {goalGlasses} glasses <span className="text-ink-2">({total} of {goal} ml)</span>
      </p>
      <div className="my-3 flex flex-wrap gap-1.5" aria-hidden>
        {Array.from({ length: Math.max(goalGlasses, glasses) }, (_, i) => (
          <span
            key={i}
            className={
              i < glasses
                ? 'flex h-8 w-6 items-end justify-center rounded-b-lg border-2 border-accent bg-accent text-xs text-accent-ink'
                : 'h-8 w-6 rounded-b-lg border-2 border-line-strong'
            }
          >
            {i < glasses ? '✓' : ''}
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        <Button
          variant="primary"
          size="lg"
          className="flex-1"
          icon={<Plus aria-hidden size={22} />}
          onClick={async () => {
            const undo = await addWater(glass);
            toast(`Added a glass (${glass} ml).`, undo);
          }}
        >
          Add a glass
        </Button>
        <Button size="lg" aria-label="Remove the last glass" disabled={logs.length === 0} onClick={() => removeLatestWaterToday()}>
          <Minus aria-hidden size={22} />
        </Button>
      </div>
      <p className="mt-2 text-sm text-ink-2">Aim for steady sips through the day. Some medications affect how much water is right for you — check with your care team.</p>
    </Card>
  );
}

export function SleepCard({ today, now }: { today: string; now: Date }) {
  const entries = useSleepEntries();
  const prefs = usePrefs();
  const inBedSince = useMeta<string>('sleep.inBedSince');
  const [open, setOpen] = useState(false);
  const [initial, setInitial] = useState<{ bed?: string; wake?: string }>({});
  const lastNight = entries.find((e) => e.date === addDays(today, -1));
  const evening = now.getHours() >= 20;

  async function wakeUp() {
    if (!inBedSince) return;
    const bed = new Date(inBedSince);
    await cancelSleepTimer();
    setInitial({ bed: formatTimeKey(bed.getHours(), bed.getMinutes()), wake: formatTimeKey(now.getHours(), now.getMinutes()) });
    setOpen(true);
  }

  // Which night are we logging? If in-bed timer started last evening, it's yesterday's date.
  const night = inBedSince ? dateKeyOf(new Date(new Date(inBedSince).getTime() - 12 * 3600_000).toISOString()) : addDays(today, -1);

  return (
    <Card labelledBy="sleep-h">
      <CardTitle id="sleep-h" icon={<BedDouble aria-hidden size={20} />} action={<Link to="/sleep" className="tap inline-flex items-center px-2 font-bold text-accent-text underline underline-offset-4">Sleep diary</Link>}>
        Sleep
      </CardTitle>
      {inBedSince ? (
        <>
          <p>In bed since {formatIsoClock(inBedSince)}.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button variant="primary" size="lg" onClick={wakeUp}>
              I’m awake
            </Button>
            <Button onClick={() => cancelSleepTimer()}>Cancel</Button>
          </div>
        </>
      ) : lastNight?.durationMinutes ? (
        <p className="text-lg">
          Last night: <strong>{formatHours(lastNight.durationMinutes)}</strong>
          {lastNight.qualityRating && <span className="text-ink-2"> · quality {lastNight.qualityRating} of 5</span>}
        </p>
      ) : (
        <>
          <p className="text-ink-2">How did you sleep last night? Sleep is one of the most important things to track.</p>
          <Button className="mt-3" variant="primary" size="lg" onClick={() => { setInitial({}); setOpen(true); }}>
            Log last night
          </Button>
        </>
      )}
      {!inBedSince && evening && (
        <div className="mt-3 border-t border-line pt-3">
          <p className="mb-2 text-ink-2">Target bedtime {prefs?.targetBedtime}. Screens away and lights low helps.</p>
          <Button onClick={() => startSleepTimer().then(() => toast('Good night. Tap “I’m awake” in the morning.'))}>Going to bed now</Button>
        </div>
      )}
      <SleepLogSheet open={open} onClose={() => setOpen(false)} night={night} initialBed={initial.bed} initialWake={initial.wake} />
    </Card>
  );
}

export function CheckInCard({ today, now }: { today: string; now: Date }) {
  const checkIn = useCheckIn(today);
  const [open, setOpen] = useState(false);
  if (now.getHours() < 17 && !checkIn) return null;
  return (
    <Card labelledBy="ci-h">
      <CardTitle id="ci-h" icon={<HeartPulse aria-hidden size={20} />}>
        Evening check-in
      </CardTitle>
      {checkIn ? (
        <p>
          {checkIn.stress != null && <>Stress {checkIn.stress}/5. </>}
          {checkIn.mood != null && <>Mood {checkIn.mood}/5. </>}
          {checkIn.seizureActivityReported === false && 'No seizure activity. '}
          <button type="button" className="tap font-bold text-accent-text underline underline-offset-4" onClick={() => setOpen(true)}>
            Edit
          </button>
        </p>
      ) : (
        <>
          <p className="text-ink-2">Two quick questions about stress and mood help find patterns over time.</p>
          <Button className="mt-3" variant="primary" size="lg" onClick={() => setOpen(true)}>
            Check in
          </Button>
        </>
      )}
      <CheckInSheet open={open} onClose={() => setOpen(false)} date={today} />
    </Card>
  );
}

export function WeekCard({ today }: { today: string }) {
  const from = addDays(today, -6);
  const seizures = useSeizures();
  const doses = useDoses(from, today);
  const sleep = useSleepEntries();
  const prefs = usePrefs();
  const water = useHydration(from, today);
  const count = seizuresInRange(seizures, from, today).length;
  const adh = adherence(doses, from, today);
  const avgSleep = averageSleepMinutes(sleep, addDays(from, -1), addDays(today, -1));
  const waterAvg = Math.round(water.reduce((a, w) => a + w.amountMl, 0) / 7);
  const goal = prefs?.hydrationGoalMl ?? 2000;
  return (
    <Card labelledBy="week-h">
      <CardTitle id="week-h" action={<Link to="/insights" className="tap inline-flex items-center px-2 font-bold text-accent-text underline underline-offset-4">Insights</Link>}>
        Last 7 days
      </CardTitle>
      <div className="grid grid-cols-2 gap-2">
        <Stat label="Seizures logged" value={count} />
        <Stat label="Doses taken" value={adh.percent == null ? '—' : `${adh.percent}%`} />
        <Stat label="Average sleep" value={avgSleep == null ? '—' : formatHours(avgSleep)} />
        <Stat label="Water per day" value={waterAvg ? `${waterAvg} ml` : '—'} sub={waterAvg ? (waterAvg >= goal * 0.8 ? 'Close to goal' : `Goal ${goal} ml`) : undefined} />
      </div>
    </Card>
  );
}

export function InsightTeaser({ today }: { today: string }) {
  const from = addDays(today, -89);
  const seizures = useSeizures();
  const doses = useDoses(from, today);
  const sleep = useSleepEntries();
  const hydration = useHydration(from, today);
  const meals = useMeals(from, today);
  const checkIns = useCheckIns();
  const checklist = useChecklistRange(from, today);
  const triggers = useTriggerTags();
  const prefs = usePrefs();
  const top = useMemo(
    () =>
      computeInsights({
        end: today, days: 90, seizures, doses, sleep, hydration, meals, checkIns, checklist, triggers,
        hydrationGoalMl: prefs?.hydrationGoalMl ?? 2000,
      })[0],
    [today, seizures, doses, sleep, hydration, meals, checkIns, checklist, triggers, prefs?.hydrationGoalMl],
  );
  if (!top || prefs?.essentialsOnly) return null;
  return (
    <Card labelledBy="ins-h" tone="accent">
      <CardTitle id="ins-h" icon={<Lightbulb aria-hidden size={20} />}>
        A pattern in your records
      </CardTitle>
      <p className="text-lg">{top.summary}</p>
      <p className="mt-1 text-sm text-ink-2">Confidence: {top.confidence}. An association, not a cause.</p>
      <Link to="/insights" className="tap mt-1 inline-flex items-center font-bold text-accent-text underline underline-offset-4">
        See all insights
      </Link>
    </Card>
  );
}
