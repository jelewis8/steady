import { useEffect, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { SEIZURE_TYPE_LABELS } from '../../core/defaults';
import { addDays, dateKeyOf, formatDateLong, formatHours, formatIsoClock, todayKey } from '../../core/time';
import { BOWEL_HOW_LABELS } from '../../core/bathroom';
import { useBathroomLog, useCheckIn, useChecklistItems, useMedications, usePrefs, useSeizures, useSleepEntries } from '../../data/hooks';
import { ensureDay } from '../../data/repo';
import { useNow } from '../../ui/hooks';
import { Button, Card, CardTitle, LinkButton, PageHeader, Progress } from '../../ui/kit';
import { BathroomSheet } from '../bathroom/BathroomSheet';
import { SleepLogSheet } from '../sleep/SleepLogSheet';
import { CheckInSheet } from '../today/CheckInSheet';
import { ChecklistRow } from '../today/Checklist';
import { useDayView } from '../today/useDayView';

/** A past day: tick off doses and routine items, add a seizure, sleep, and a check-in. */
export function DayPage() {
  const { date = '' } = useParams();
  const valid = /^\d{4}-\d{2}-\d{2}$/.test(date);
  if (!valid || date >= todayKey()) return <Navigate to="/" replace />;
  return <DayContent key={date} date={date} />;
}

function DayContent({ date }: { date: string }) {
  const now = useNow();
  const today = todayKey(now);
  const { view, loading, doses } = useDayView(date, now);
  const items = useChecklistItems(date);
  const seizures = useSeizures().filter((s) => dateKeyOf(s.timestamp) === date);
  const nightBefore = addDays(date, -1);
  const sleep = useSleepEntries().find((e) => e.date === nightBefore);
  const checkIn = useCheckIn(date);
  const trackBathroom = !!usePrefs()?.trackBathroom;
  const bathroom = useBathroomLog(date);
  const [bathroomOpen, setBathroomOpen] = useState(false);
  const [sleepOpen, setSleepOpen] = useState(false);
  const [checkInOpen, setCheckInOpen] = useState(false);
  const [adding, setAdding] = useState(false);

  const hasRows = (items?.length ?? 0) > 0 || doses.length > 0;
  // A day she has already opened keeps up with changes (for example a medication whose start date she moved earlier).
  useEffect(() => {
    if (hasRows) void ensureDay(date);
  }, [date, hasRows]);
  // Medications added to Steady later than this day aren't scheduled on it. Say so, instead of leaving her to wonder.
  const laterMeds = useMedications().filter((m) => m.isActive && !m.isRescue && m.scheduledTimes.length > 0 && m.startDate > date);
  const open = view.entries.filter((e) => e.status === 'pending' || e.status === 'deferred');
  const recorded = view.entries.filter((e) => !(e.status === 'pending' || e.status === 'deferred'));
  const next = addDays(date, 1);

  return (
    <div className="grid gap-4 pb-6">
      <PageHeader title={formatDateLong(date)} back={true} subtitle="A day from the past. Only record what you remember. Blanks are fine." />

      <nav aria-label="Move between days" className="flex items-center justify-between gap-2">
        <LinkButton to={`/day/${addDays(date, -1)}`} icon={<ChevronLeft aria-hidden size={20} />}>
          Day before
        </LinkButton>
        <LinkButton to={next >= today ? '/' : `/day/${next}`}>
          {next >= today ? 'Back to today' : 'Day after'}
          <ChevronRight aria-hidden size={20} />
        </LinkButton>
      </nav>

      {laterMeds.length > 0 && (
        <Card labelledBy="later-h">
          <h2 id="later-h" className="font-bold">
            Some medications start after this day
          </h2>
          <p className="mt-1 text-ink-2">
            {laterMeds.map((m) => m.name).join(', ')} {laterMeds.length === 1 ? 'was' : 'were'} added to Steady on a later date, so {laterMeds.length === 1 ? 'its doses aren’t' : 'their doses aren’t'} listed here. If you were already taking{' '}
            {laterMeds.length === 1 ? 'it' : 'them'}, open the medication and set “Started on” to an earlier date.
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {laterMeds.map((m) => (
              <LinkButton key={m.id} to={`/meds/${m.id}`}>
                Open {m.name}
              </LinkButton>
            ))}
          </div>
        </Card>
      )}

      {loading ? (
        <p className="text-ink-2">Loading…</p>
      ) : !hasRows ? (
        <Card labelledBy="empty-h">
          <h2 id="empty-h" className="text-lg font-bold">
            Nothing is recorded for this day yet
          </h2>
          <p className="mt-1 text-ink-2">Add that day’s routine and medications to tick off what you did. You can also add a seizure, sleep, or a check-in below without it.</p>
          <Button
            className="mt-3"
            variant="primary"
            size="lg"
            disabled={adding}
            onClick={async () => {
              setAdding(true);
              await ensureDay(date);
              setAdding(false);
            }}
          >
            {adding ? 'Adding…' : 'Add this day’s routine and medications'}
          </Button>
        </Card>
      ) : (
        <>
          <Card labelledBy="dp-h">
            <div className="flex items-baseline justify-between gap-2">
              <h2 id="dp-h" className="text-lg font-bold">
                Recorded for this day
              </h2>
              <span className="text-lg font-bold tabular-nums">
                {view.doneCount} of {view.total}
              </span>
            </div>
            <div className="mt-2">
              <Progress value={view.percent} label={`${view.doneCount} of ${view.total} items recorded as done`} />
            </div>
          </Card>

          {open.length > 0 && (
            <section aria-labelledby="dp-open">
              <h2 id="dp-open" className="mb-1 text-lg font-bold">
                Not recorded yet
              </h2>
              <p className="mb-2 text-ink-2">Tick what you did, skip what you didn’t, or leave it. All are fine.</p>
              <ul className="grid gap-2">
                {open.map((e) => (
                  <ChecklistRow key={e.key} entry={e} date={date} />
                ))}
              </ul>
            </section>
          )}

          {recorded.length > 0 && (
            <section aria-labelledby="dp-done">
              <h2 id="dp-done" className="mb-2 text-lg font-bold">
                Recorded
              </h2>
              <ul className="grid gap-2">
                {[...recorded].sort((a, b) => a.minutes - b.minutes).map((e) => (
                  <ChecklistRow key={e.key} entry={e} date={date} />
                ))}
              </ul>
            </section>
          )}
        </>
      )}

      <Card labelledBy="dp-sz">
        <CardTitle id="dp-sz">Seizures and warning signs</CardTitle>
        {seizures.length === 0 ? (
          <p className="text-ink-2">No seizures logged for this day.</p>
        ) : (
          <ul className="grid gap-2">
            {seizures.map((s) => (
              <li key={s.id}>
                <Link to={`/seizures/${s.id}`} className="tap flex items-center justify-between gap-2 rounded-xl bg-surface-2 p-3 no-underline">
                  <span className="font-bold">{SEIZURE_TYPE_LABELS[s.type].label}</span>
                  <span className="text-ink-2">{formatIsoClock(s.timestamp)}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
        <LinkButton className="mt-3" to={`/seizures/new?date=${date}`} icon={<Plus aria-hidden size={20} />}>
          Log a seizure on this day
        </LinkButton>
      </Card>

      <Card labelledBy="dp-sl">
        <CardTitle id="dp-sl">Sleep the night before</CardTitle>
        <p className="text-ink-2">
          {sleep
            ? `${sleep.actualBedtime} to ${sleep.actualWakeTime}${sleep.durationMinutes != null ? ` · ${formatHours(sleep.durationMinutes)}` : ''}`
            : `Not logged for the night of ${formatDateLong(nightBefore)}.`}
        </p>
        <Button className="mt-3" onClick={() => setSleepOpen(true)}>
          {sleep ? 'Edit sleep' : 'Log sleep'}
        </Button>
      </Card>

      <Card labelledBy="dp-ci">
        <CardTitle id="dp-ci">How the day was</CardTitle>
        <p className="text-ink-2">
          {checkIn
            ? [checkIn.mood != null && `mood ${checkIn.mood}/5`, checkIn.stress != null && `stress ${checkIn.stress}/5`, checkIn.onPeriod && 'period'].filter(Boolean).join(' · ') || 'Check-in saved.'
            : 'No check-in for this day.'}
        </p>
        <Button className="mt-3" onClick={() => setCheckInOpen(true)}>
          {checkIn ? 'Edit check-in' : 'Add a check-in'}
        </Button>
      </Card>

      {trackBathroom && (
        <Card labelledBy="dp-bt">
          <CardTitle id="dp-bt">Bowel and bladder</CardTitle>
          <p className="text-ink-2">
            {bathroom
              ? [
                  bathroom.bowel === true ? `bowel movement${bathroom.bowelHow ? ` (${BOWEL_HOW_LABELS[bathroom.bowelHow].toLowerCase()})` : ''}` : bathroom.bowel === false ? 'no bowel movement' : null,
                  bathroom.urinationCount ? `urinated ${bathroom.urinationCount} ${bathroom.urinationCount === 1 ? 'time' : 'times'}` : null,
                ]
                  .filter(Boolean)
                  .join(' · ') || 'Nothing recorded.'
              : 'Nothing recorded for this day.'}
          </p>
          <Button className="mt-3" onClick={() => setBathroomOpen(true)}>
            {bathroom ? 'Edit' : 'Add'}
          </Button>
        </Card>
      )}

      {bathroomOpen && <BathroomSheet date={date} open onClose={() => setBathroomOpen(false)} />}
      {sleepOpen && <SleepLogSheet open onClose={() => setSleepOpen(false)} night={nightBefore} />}
      <CheckInSheet open={checkInOpen} onClose={() => setCheckInOpen(false)} date={date} />
    </div>
  );
}
