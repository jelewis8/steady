import { Link } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { adherence, supplyEstimate } from '../../core/stats';
import { addDays, formatClock, parseTime, todayKey } from '../../core/time';
import type { Medication } from '../../core/types';
import { useDoses, useMedications } from '../../data/hooks';
import { Card, CardTitle, Disclaimer, Empty, LinkButton, PageHeader, Stat } from '../../ui/kit';

function MedRow({ m }: { m: Medication }) {
  const supply = supplyEstimate(m, todayKey());
  return (
    <li>
      <Link to={`/meds/${m.id}`} className="tap block rounded-2xl border-2 border-line bg-surface p-3 no-underline hover:border-accent">
        <div className="text-lg font-bold">
          {m.name} <span className="font-normal text-ink-2">{m.dosage} {m.unit}</span>
        </div>
        <div className="text-ink-2">
          {m.isRescue
            ? 'Rescue medication — used as your plan says'
            : m.scheduledTimes.length
              ? `Daily at ${m.scheduledTimes.map((t) => formatClock(parseTime(t).hour, parseTime(t).minute)).join(', ')}`
              : 'No times set'}
        </div>
        {supply.daysLeft != null && (
          <div className={supply.needsRefill ? 'font-bold text-attn-ink' : 'text-ink-2'}>
            {supply.needsRefill ? '↻ ' : ''}About {supply.daysLeft} {supply.daysLeft === 1 ? 'day' : 'days'} of supply left
            {supply.needsRefill ? ' — time to arrange a refill' : ''}
          </div>
        )}
      </Link>
    </li>
  );
}

export function MedsPage() {
  const meds = useMedications();
  const today = todayKey();
  const doses = useDoses(addDays(today, -89), today);
  const a7 = adherence(doses, addDays(today, -6), today);
  const a30 = adherence(doses, addDays(today, -29), today);
  const a90 = adherence(doses, addDays(today, -89), today);
  const scheduled = meds.filter((m) => m.isActive && !m.isRescue);
  const rescue = meds.filter((m) => m.isActive && m.isRescue);
  const past = meds.filter((m) => !m.isActive);
  const pct = (p: number | null) => (p == null ? '—' : `${p}%`);

  return (
    <div className="grid gap-4">
      <PageHeader
        title="Medications"
        back="/more"
        action={
          <LinkButton to="/meds/new" variant="primary" icon={<Plus aria-hidden size={20} />}>
            Add
          </LinkButton>
        }
      />
      {scheduled.length > 0 && (
        <Card labelledBy="adh-h">
          <CardTitle id="adh-h">Doses recorded as taken</CardTitle>
          <div className="grid grid-cols-3 gap-2">
            <Stat label="7 days" value={pct(a7.percent)} />
            <Stat label="30 days" value={pct(a30.percent)} />
            <Stat label="90 days" value={pct(a90.percent)} />
          </div>
          {a30.scheduled > 0 && (
            <p className="mt-2 text-sm text-ink-2">
              Last 30 days: {a30.taken} on time, {a30.late} late, {a30.skipped} skipped, {a30.unsure} not sure, {a30.notRecorded} not recorded.
            </p>
          )}
        </Card>
      )}
      <section aria-labelledby="daily-h">
        <h2 id="daily-h" className="mb-2 text-lg font-bold">
          Daily medications
        </h2>
        {scheduled.length === 0 ? (
          <Empty title="No daily medications yet">Add one to get reminders and a clear record of each dose.</Empty>
        ) : (
          <ul className="grid gap-2">
            {scheduled.map((m) => (
              <MedRow key={m.id} m={m} />
            ))}
          </ul>
        )}
      </section>
      {rescue.length > 0 && (
        <section aria-labelledby="resc-h">
          <h2 id="resc-h" className="mb-2 text-lg font-bold">
            Rescue medication
          </h2>
          <ul className="grid gap-2">
            {rescue.map((m) => (
              <MedRow key={m.id} m={m} />
            ))}
          </ul>
        </section>
      )}
      {past.length > 0 && (
        <details>
          <summary className="tap flex cursor-pointer items-center font-bold">Past medications ({past.length})</summary>
          <ul className="mt-2 grid gap-2">
            {past.map((m) => (
              <MedRow key={m.id} m={m} />
            ))}
          </ul>
        </details>
      )}
      <Disclaimer>
        Steady reminds and records — it never tells you to change a dose. Never stop or change an anti-seizure medication without talking to your
        doctor; stopping suddenly can be dangerous.
      </Disclaimer>
    </div>
  );
}
