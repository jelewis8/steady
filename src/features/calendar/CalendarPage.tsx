import { useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ChevronLeft, ChevronRight, CircleHelp, Droplet, Moon, Pill, Sparkles, Zap } from 'lucide-react';
import {
  buildMonthMarkers,
  daysOfMonth,
  describeMarkers,
  firstOfMonth,
  lastOfMonth,
  monthGrid,
  monthKeyOf,
  monthLabel,
  shiftMonth,
  weekdayLong,
  type DayMarkers,
} from '../../core/calendar';
import { addDays, formatDateLong, fromDateKey, todayKey } from '../../core/time';
import { useAuras, useCheckIns, useDoses, useSeizures, useSleepEntries } from '../../data/hooks';
import { Button, Card, cx, Disclaimer, IconButton, PageHeader, Segmented } from '../../ui/kit';

type View = 'grid' | 'list';

/** Legend and cell icons. Every marker has an icon AND words: colour is never the only signal. */
const MARKERS: { key: keyof Pick<DayMarkers, 'seizures' | 'auras' | 'dosesMissed' | 'dosesNotRecorded' | 'shortSleep' | 'period'>; label: string; Icon: typeof Zap }[] = [
  { key: 'seizures', label: 'Seizure', Icon: Zap },
  { key: 'auras', label: 'Warning sign', Icon: Sparkles },
  { key: 'dosesMissed', label: 'Dose skipped or not sure', Icon: Pill },
  { key: 'dosesNotRecorded', label: 'Dose not recorded', Icon: CircleHelp },
  { key: 'shortSleep', label: 'Short sleep the night before', Icon: Moon },
  { key: 'period', label: 'Period', Icon: Droplet },
];

const MONDAY = '2026-09-07';
const WEEKDAYS = Array.from({ length: 7 }, (_, i) => {
  const d = fromDateKey(addDays(MONDAY, i));
  return { short: d.toLocaleDateString(undefined, { weekday: 'short' }), long: d.toLocaleDateString(undefined, { weekday: 'long' }) };
});

function DayCell({ date, markers, today }: { date: string; markers: DayMarkers; today: string }) {
  const day = Number(date.slice(8));
  const isToday = date === today;
  const future = date > today;
  const words = describeMarkers(markers);
  if (future) {
    return (
      <div className="flex min-h-16 flex-col items-center rounded-xl border border-line p-1 text-ink-2">
        <span aria-hidden>{day}</span>
        <span className="sr-only">{weekdayLong(date)}: upcoming</span>
      </div>
    );
  }
  return (
    <Link
      to={isToday ? '/' : `/day/${date}`}
      aria-label={`${weekdayLong(date)}${isToday ? ', today' : ''}: ${words.length ? words.join(', ') : 'nothing recorded'}`}
      className={cx(
        'tap flex min-h-16 flex-col items-center gap-0.5 rounded-xl border-2 p-1 no-underline hover:bg-surface-2',
        isToday ? 'border-accent bg-accent-soft' : 'border-line bg-surface',
      )}
    >
      <span aria-hidden className={cx('tabular-nums', isToday && 'font-bold underline decoration-2 underline-offset-2')}>
        {day}
      </span>
      <span aria-hidden className="flex flex-wrap items-center justify-center gap-x-1 gap-y-0.5">
        {MARKERS.map(({ key, Icon }) => {
          const v = markers[key];
          if (!v) return null;
          return (
            <span key={key} className="inline-flex items-center text-xs font-bold">
              <Icon size={14} strokeWidth={2.5} />
              {typeof v === 'number' && v > 1 ? v : ''}
            </span>
          );
        })}
      </span>
    </Link>
  );
}

export function CalendarPage() {
  const [params, setParams] = useSearchParams();
  const today = todayKey();
  const thisMonth = monthKeyOf(today);
  const asked = params.get('m') ?? '';
  const month = /^\d{4}-\d{2}$/.test(asked) && asked <= thisMonth ? asked : thisMonth;
  const view: View = params.get('view') === 'list' ? 'list' : 'grid';
  const go = (m: string, v: View = view) => setParams({ m, ...(v === 'list' ? { view: 'list' } : {}) }, { replace: true });

  const first = firstOfMonth(month);
  const last = lastOfMonth(month);
  const seizures = useSeizures();
  const auras = useAuras();
  const doses = useDoses(first, last);
  const sleep = useSleepEntries();
  const checkIns = useCheckIns();
  const markers = useMemo(() => buildMonthMarkers({ month, seizures, auras, doses, sleep, checkIns }), [month, seizures, auras, doses, sleep, checkIns]);
  const rows = monthGrid(month);

  return (
    <div className="grid gap-4 pb-6">
      <PageHeader title="Calendar" back="/more" subtitle="Tap a day to see it, or to add something you forgot." />

      <div className="flex items-center justify-between gap-2">
        <IconButton label="Previous month" onClick={() => go(shiftMonth(month, -1))}>
          <ChevronLeft aria-hidden size={28} />
        </IconButton>
        <h2 className="text-xl font-bold" aria-live="polite">
          {monthLabel(month)}
        </h2>
        <IconButton label="Next month" disabled={month >= thisMonth} onClick={() => go(shiftMonth(month, 1))} className="disabled:opacity-40">
          <ChevronRight aria-hidden size={28} />
        </IconButton>
      </div>
      {month !== thisMonth && (
        <Button variant="quiet" onClick={() => go(thisMonth)}>
          Back to this month
        </Button>
      )}

      <Segmented<View>
        label="View"
        hideLabel
        value={view}
        onChange={(v) => go(month, v)}
        columns={2}
        options={[
          { value: 'grid', label: 'Calendar' },
          { value: 'list', label: 'List' },
        ]}
      />

      {view === 'grid' ? (
        <Card className="p-2 sm:p-3">
          <table className="w-full table-fixed border-separate border-spacing-0.5">
            <caption className="sr-only">{monthLabel(month)}. Each day is a link that opens that day.</caption>
            <thead>
              <tr>
                {WEEKDAYS.map((w) => (
                  <th key={w.long} scope="col" className="pb-1 text-center text-sm font-bold">
                    <span aria-hidden>{w.short}</span>
                    <span className="sr-only">{w.long}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={i}>
                  {row.map((d, j) => (
                    <td key={j} className="p-0 align-top">
                      {d ? <DayCell date={d} markers={markers.get(d)!} today={today} /> : null}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      ) : (
        <Card className="p-2 sm:p-3">
          <table className="w-full border-collapse text-left">
            <caption className="sr-only">{monthLabel(month)}: what was recorded on each day.</caption>
            <thead>
              <tr className="border-b-2 border-line">
                <th scope="col" className="py-1.5 pr-2">
                  Day
                </th>
                <th scope="col">What was recorded</th>
              </tr>
            </thead>
            <tbody>
              {daysOfMonth(month)
                .filter((d) => d <= today)
                .map((d) => {
                  const words = describeMarkers(markers.get(d)!);
                  return (
                    <tr key={d} className="border-b border-line align-top">
                      <th scope="row" className="py-2 pr-2 font-normal">
                        <Link to={d === today ? '/' : `/day/${d}`} className="tap inline-flex items-center font-bold text-accent-text underline underline-offset-4">
                          {formatDateLong(d)}
                          {d === today && ' (today)'}
                        </Link>
                      </th>
                      <td className="py-2">{words.length ? words.join(', ') : <span className="text-ink-2">Nothing recorded</span>}</td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </Card>
      )}

      <Card labelledBy="legend-h">
        <h2 id="legend-h" className="mb-2 font-bold">
          What the symbols mean
        </h2>
        <ul className="grid gap-1.5 sm:grid-cols-2">
          {MARKERS.map(({ key, label, Icon }) => (
            <li key={key} className="flex items-center gap-2">
              <Icon aria-hidden size={18} strokeWidth={2.5} className="shrink-0" />
              {label}
            </li>
          ))}
        </ul>
        <p className="mt-2 text-sm text-ink-2">A number next to a symbol means more than one. Days with nothing on them either had nothing to record, or haven’t been filled in yet.</p>
      </Card>

      <Disclaimer>The calendar only shows what you have logged. It is not a medical record or advice. Bring it to your neurologist along with your report.</Disclaimer>
    </div>
  );
}
