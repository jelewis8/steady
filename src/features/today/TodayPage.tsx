import { useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarDays, CalendarRange, ChevronDown, History, Plus, ShieldAlert, Sparkles } from 'lucide-react';
import { selectTemplate } from '../../core/checklist';
import { addDays, formatDateLong, formatTimeKey, todayKey } from '../../core/time';
import { useDayPlan, useMeta, usePrefs, useProfile, useSeizures, useTemplates } from '../../data/hooks';
import { addAdHocItem, setDayTemplate } from '../../data/repo';
import { storage } from '../../data/storage';
import { toast } from '../../state/ui';
import { Button, Card, Field, Input, LinkButton, Progress, Sheet, cx } from '../../ui/kit';
import { PickDaySheet } from '../calendar/PickDaySheet';
import { isSafeMode, useNow } from '../../ui/hooks';
import { seizuresInRange, daysSinceLastSeizure } from '../../core/stats';
import { ChecklistRow } from './Checklist';
import { useConsistency, useDayView } from './useDayView';
import { MedCard, WaterCard, SleepCard, CheckInCard, WeekCard, InsightTeaser } from './TodayCards';
import { SafeModeToday } from '../safemode/SafeModeToday';

function greeting(d: Date) {
  const h = d.getHours();
  if (h < 5) return 'Hello';
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

export function TodayPage() {
  const now = useNow();
  const prefs = usePrefs();
  if (isSafeMode(prefs, now)) return <SafeModeToday now={now} />;
  return <RegularToday now={now} />;
}

function RegularToday({ now }: { now: Date }) {
  const today = todayKey(now);
  const profile = useProfile();
  const prefs = usePrefs();
  const { view, loading } = useDayView(today, now);
  const consistency = useConsistency(today);
  const seizures = useSeizures();
  const [showLater, setShowLater] = useState(false);
  const [showDone, setShowDone] = useState(false);
  const [adding, setAdding] = useState(false);
  const [pickDay, setPickDay] = useState(false);

  const weekCount = seizuresInRange(seizures, addDays(today, -6), today).length;
  const threshold = prefs?.seizureThresholdPerWeek;
  const since = daysSinceLastSeizure(seizures, today);
  const name = profile?.displayName?.trim();

  return (
    <div className="grid gap-4">
      <div>
        <h1 className="text-3xl font-bold">
          {greeting(now)}
          {name ? `, ${name}` : ''}
        </h1>
        <p className="text-lg text-ink-2">{formatDateLong(today)}</p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button variant="quiet" icon={<History aria-hidden size={20} />} onClick={() => setPickDay(true)}>
          Log from an earlier day
        </Button>
        <LinkButton to="/calendar" variant="quiet" icon={<CalendarRange aria-hidden size={20} />}>
          Calendar
        </LinkButton>
      </div>
      <PickDaySheet open={pickDay} onClose={() => setPickDay(false)} />

      {profile?.isSampleData && <SampleBanner />}
      <BackupNudge />

      {threshold != null && weekCount > threshold && (
        <Card tone="attn" labelledBy="thr">
          <h2 id="thr" className="flex items-center gap-2 font-bold">
            <ShieldAlert aria-hidden size={20} /> More seizures than usual this week
          </h2>
          <p className="mt-1">
            You’ve logged {weekCount} seizures in the last 7 days, which is above the {threshold} you set. Consider contacting your
            neurologist, and follow your rescue plan if you need to.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link to="/rescue" className="tap inline-flex items-center rounded-xl border-2 border-attn-line px-4 font-bold no-underline">
              Open rescue plan
            </Link>
          </div>
        </Card>
      )}

      <Card labelledBy="progress-h">
        <div className="flex items-baseline justify-between gap-2">
          <h2 id="progress-h" className="text-lg font-bold">
            Today’s routine
          </h2>
          <span className="text-lg font-bold tabular-nums">
            {view.doneCount} of {view.total}
          </span>
        </div>
        <div className="mt-2">
          <Progress value={view.percent} label={`${view.doneCount} of ${view.total} routine items done`} />
        </div>
        <p className="mt-2 text-ink-2">
          {view.total === 0
            ? 'Nothing scheduled yet — add items in Schedule.'
            : view.doneCount === view.total
              ? 'Everything done. Rest well.'
              : consistency.run >= 2
                ? `You’ve kept your routine ${consistency.run} days running. Nice and steady.`
                : consistency.pickBackUp
                  ? 'Let’s pick back up today — one item at a time.'
                  : 'One item at a time is plenty.'}
        </p>
        {prefs?.showSeizureFreeCount && since != null && (
          <p className="mt-1 font-bold">
            {since === 0 ? 'Seizure logged today — go gently.' : `${since} ${since === 1 ? 'day' : 'days'} since your last logged seizure.`}
          </p>
        )}
        <TemplateSwitcher date={today} />
      </Card>

      {loading ? (
        <p className="text-ink-2">Loading your checklist…</p>
      ) : (
        <>
          {view.stillOpen.length > 0 && (
            <section aria-labelledby="open-h">
              <h2 id="open-h" className="mb-1 text-lg font-bold">
                Still open from earlier
              </h2>
              <p className="mb-2 text-ink-2">No rush. Tick what you did, or skip what you didn’t — both are fine.</p>
              <ul className="grid gap-2">
                {view.stillOpen.map((e) => (
                  <ChecklistRow key={e.key} entry={e} date={today} />
                ))}
              </ul>
            </section>
          )}

          <section aria-labelledby="next-h">
            <div className="mb-2 flex items-center justify-between">
              <h2 id="next-h" className="text-lg font-bold">
                Up next
              </h2>
              <Button variant="ghost" icon={<Plus aria-hidden size={20} />} onClick={() => setAdding(true)}>
                Add for today
              </Button>
            </div>
            {view.upNext.length === 0 ? (
              <p className="rounded-2xl border-2 border-dashed border-line p-4 text-ink-2">Nothing else scheduled for today.</p>
            ) : (
              <ul className="grid gap-2">
                {view.upNext.map((e) => (
                  <ChecklistRow key={e.key} entry={e} date={today} />
                ))}
              </ul>
            )}
            {view.later.length > 0 && (
              <div className="mt-2">
                <Button variant="ghost" block aria-expanded={showLater} onClick={() => setShowLater((v) => !v)}>
                  <ChevronDown aria-hidden size={20} className={cx('ease-calm', showLater && 'rotate-180')} />
                  {showLater ? 'Hide' : 'Show'} later today ({view.later.length})
                </Button>
                {showLater && (
                  <ul className="mt-2 grid gap-2">
                    {view.later.map((e) => (
                      <ChecklistRow key={e.key} entry={e} date={today} />
                    ))}
                  </ul>
                )}
              </div>
            )}
          </section>

          {view.finished.length > 0 && (
            <section aria-labelledby="done-h">
              <Button variant="ghost" block aria-expanded={showDone} onClick={() => setShowDone((v) => !v)}>
                <ChevronDown aria-hidden size={20} className={cx('ease-calm', showDone && 'rotate-180')} />
                <span id="done-h">
                  {showDone ? 'Hide' : 'Show'} earlier today ({view.finished.length})
                </span>
              </Button>
              {showDone && (
                <ul className="mt-2 grid gap-2">
                  {view.finished.map((e) => (
                    <ChecklistRow key={e.key} entry={e} date={today} />
                  ))}
                </ul>
              )}
            </section>
          )}
        </>
      )}

      <MedCard now={now} />
      <WaterCard today={today} />
      <SleepCard today={today} now={now} />
      <CheckInCard today={today} now={now} />
      <WeekCard today={today} />
      <InsightTeaser today={today} />

      <AddForTodaySheet open={adding} onClose={() => setAdding(false)} date={today} now={now} />
    </div>
  );
}

function TemplateSwitcher({ date }: { date: string }) {
  const templates = useTemplates() ?? [];
  const plan = useDayPlan(date);
  const [open, setOpen] = useState(false);
  const current = selectTemplate(templates, date, plan);
  if (templates.length < 2 || !current) return null;
  return (
    <div className="mt-3 border-t border-line pt-3">
      <Button variant="quiet" icon={<CalendarDays aria-hidden size={20} />} onClick={() => setOpen(true)}>
        Using “{current.name}” · change for today
      </Button>
      <Sheet open={open} onClose={() => setOpen(false)} title="Which routine today?">
        <p className="mb-3 text-ink-2">Having a hard day? A lighter routine is a good choice. Items you’ve already finished are kept.</p>
        <div className="grid gap-2">
          {templates.map((t) => (
            <Button
              key={t.id}
              size="lg"
              block
              variant={t.id === current.id ? 'primary' : 'secondary'}
              aria-pressed={t.id === current.id}
              onClick={async () => {
                await setDayTemplate(date, t.id);
                setOpen(false);
                toast(`Today now uses “${t.name}”.`);
              }}
            >
              {t.id === current.id && '✓ '}
              {t.name} <span className="font-normal">· {t.items.length} items</span>
            </Button>
          ))}
        </div>
      </Sheet>
    </div>
  );
}

function AddForTodaySheet({ open, onClose, date, now }: { open: boolean; onClose: () => void; date: string; now: Date }) {
  const [label, setLabel] = useState('');
  const [time, setTime] = useState(formatTimeKey(Math.min(23, now.getHours() + 1), 0));
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Add something for today"
      footer={
        <Button
          variant="primary"
          size="lg"
          block
          disabled={!label.trim()}
          onClick={async () => {
            const undo = await addAdHocItem(date, time, label.trim());
            toast(`Added “${label.trim()}”.`, undo);
            setLabel('');
            onClose();
          }}
        >
          Add to today
        </Button>
      }
    >
      <div className="grid gap-4">
        <Field label="What is it?">
          {(id) => <Input id={id} value={label} onChange={(e) => setLabel(e.target.value)} placeholder="e.g. Call the pharmacy" autoComplete="off" />}
        </Field>
        <Field label="Time">{(id) => <Input id={id} type="time" value={time} onChange={(e) => setTime(e.target.value)} />}</Field>
        <p className="text-sm text-ink-2">To add something every day, use Schedule instead.</p>
      </div>
    </Sheet>
  );
}

function SampleBanner() {
  const [confirm, setConfirm] = useState(false);
  return (
    <Card tone="accent" labelledBy="sample-h">
      <h2 id="sample-h" className="flex items-center gap-2 font-bold">
        <Sparkles aria-hidden size={20} /> You’re exploring sample data
      </h2>
      <p className="mt-1">Everything here is made up so you can see how Steady works — including Insights.</p>
      <Button className="mt-3" variant="primary" onClick={() => setConfirm(true)}>
        Start fresh with my own data
      </Button>
      <Sheet open={confirm} onClose={() => setConfirm(false)} title="Start fresh?">
        <p>This removes all the sample data and takes you to setup.</p>
        <div className="mt-4 grid gap-2">
          <Button
            variant="primary"
            size="lg"
            onClick={async () => {
              await storage.eraseAll();
              window.location.assign('/welcome');
            }}
          >
            Yes, remove sample data
          </Button>
          <Button size="lg" onClick={() => setConfirm(false)}>
            Keep exploring
          </Button>
        </div>
      </Sheet>
    </Card>
  );
}

function BackupNudge() {
  const last = useMeta<string>('lastExportAt');
  const profile = useProfile();
  if (last === undefined || !profile || profile.isSampleData) return null;
  const since = last ? (Date.now() - new Date(last).getTime()) / 86_400_000 : (Date.now() - new Date(profile.createdAt).getTime()) / 86_400_000;
  if (since < 30) return null;
  return (
    <Card labelledBy="bk-h">
      <h2 id="bk-h" className="font-bold">
        Time for a backup
      </h2>
      <p className="mt-1 text-ink-2">
        {last ? 'It’s been a month since your last backup.' : 'You haven’t made a backup yet.'} Your data lives only on this device — a
        backup file keeps it safe if your phone is lost.
      </p>
      <Link to="/settings/data" className="tap mt-2 inline-flex items-center font-bold text-accent-text underline underline-offset-4">
        Back up now
      </Link>
    </Card>
  );
}
