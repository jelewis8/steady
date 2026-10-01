import { useMemo } from 'react';
import { BOWEL_BLADDER_NOTE, COMPARE_MIN_DAYS, COMPARE_WINDOW_DAYS, compareAroundMedicationDates, comparisonRows, comparisonTitle, medicationDateEvents } from '../../core/bathroom';
import { addDays, dateRange, formatDateShort, fromDateKey, todayKey } from '../../core/time';
import type { BathroomLog, DoseChange, ISODate, Medication } from '../../core/types';
import { ChartFrame } from '../../ui/charts';
import { Card, CardTitle, cx } from '../../ui/kit';

/** Day grid: bowel movement answered yes / no / nothing, with a ▲ on days a medication was started or stopped. */
function DayGrid({ logs, meds, doseChanges, start, end }: { logs: BathroomLog[]; meds: Medication[]; doseChanges: DoseChange[]; start: ISODate; end: ISODate }) {
  const from = addDays(end, -83) > start ? addDays(end, -83) : start;
  const days = dateRange(from, end);
  const byDate = new Map(logs.map((l) => [l.date, l]));
  const events = medicationDateEvents(meds, from, end, doseChanges);
  const eventsByDate = new Map<ISODate, string[]>();
  for (const e of events) eventsByDate.set(e.date, [...(eventsByDate.get(e.date) ?? []), `${e.medication} ${e.event}${e.detail ? ` (${e.detail})` : ''}`]);
  const lead = (fromDateKey(from).getDay() + 6) % 7;
  const word = (l: BathroomLog | undefined) => (l?.bowel === true ? 'bowel movement' : l?.bowel === false ? 'no bowel movement' : 'nothing recorded');
  const symbol = (l: BathroomLog | undefined) => (l?.bowel === true ? '✓' : l?.bowel === false ? '○' : '');
  return (
    <ChartFrame
      title="Bowel movement by day, with medication start, stop and dose-change dates"
      description="Tick means a bowel movement was recorded, open circle means recorded as none, blank means nothing recorded. A triangle marks a day a medication was started, stopped or had its dose changed."
      table={{
        columns: ['Date', 'Bowel movement', 'Urinations', 'Medication started, stopped or dose changed'],
        rows: [...days]
          .reverse()
          .filter((d) => byDate.has(d) || eventsByDate.has(d))
          .map((d) => {
            const l = byDate.get(d);
            return [formatDateShort(d), word(l), l?.urinationCount ? l.urinationCount : '', (eventsByDate.get(d) ?? []).join(', ')];
          }),
      }}
    >
      <div className="grid grid-cols-7 gap-1">
        {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
          <div key={i} className="text-center text-xs font-bold text-ink-2">
            {d}
          </div>
        ))}
        {Array.from({ length: lead }, (_, i) => (
          <div key={`e${i}`} />
        ))}
        {days.map((d) => {
          const l = byDate.get(d);
          const ev = eventsByDate.get(d);
          const cls = l?.bowel === true ? 'border-accent bg-accent text-accent-ink' : l?.bowel === false ? 'border-line-strong bg-surface-2' : 'border-line bg-surface';
          return (
            <div
              key={d}
              className={cx('flex aspect-square flex-col items-center justify-center rounded-md border-2 text-sm font-bold leading-none', cls)}
              title={`${formatDateShort(d)}: ${word(l)}${ev ? `; ${ev.join(', ')}` : ''}`}
            >
              <span>{symbol(l)}</span>
              {ev && <span aria-hidden>▲</span>}
            </div>
          );
        })}
      </div>
      <p className="mt-2 text-sm text-ink-2">✓ bowel movement · ○ recorded as none · blank: nothing recorded · ▲ a medication was started, stopped or had its dose changed</p>
    </ChartFrame>
  );
}

/**
 * Bowel and bladder next to the dates medications were started or stopped (F-010).
 * The user’s own counts, side by side. Deliberately says nothing about what any drug does.
 */
export function BathroomMedCard({ logs, meds, doseChanges, start, end }: { logs: BathroomLog[]; meds: Medication[]; doseChanges: DoseChange[]; start: ISODate; end: ISODate }) {
  const today = todayKey();
  const comparisons = useMemo(() => compareAroundMedicationDates(logs, meds, start, end, today, doseChanges), [logs, meds, doseChanges, start, end, today]);
  const anyRecord = logs.some((l) => l.date >= start && l.date <= end && (l.bowel !== null || l.urinationCount > 0));
  if (!anyRecord) return null;
  return (
    <Card labelledBy="bm-h">
      <CardTitle id="bm-h">Bowel and bladder, and medication dates</CardTitle>
      <p className="mb-3 text-ink-2">
        Your records for the {COMPARE_WINDOW_DAYS} days before, and from, the day a medication was started, stopped or had its dose changed, using the dates you saved.
      </p>
      <DayGrid logs={logs} meds={meds} doseChanges={doseChanges} start={start} end={end} />
      <div className="mt-4 grid gap-4">
        {comparisons.length === 0 && <p>No medication was started, stopped or had its dose changed in this time range.</p>}
        {comparisons.map((c) => (
          <section key={`${c.medicationId}-${c.event}-${c.date}`} aria-label={comparisonTitle(c, formatDateShort)}>
            <h3 className="font-bold">
              {comparisonTitle(c, formatDateShort)}
            </h3>
            {c.enough ? (
              <table className="mt-1 w-full border-collapse text-left text-sm">
                <caption className="sr-only">
                  {comparisonTitle(c, formatDateShort)}: your records before and after
                </caption>
                <thead>
                  <tr className="border-b border-line">
                    <th scope="col" className="py-1 pr-2">
                      &nbsp;
                    </th>
                    <th scope="col" className="py-1 pr-2">
                      Before ({formatDateShort(c.before.from)} to {formatDateShort(c.before.to)})
                    </th>
                    <th scope="col" className="py-1">
                      From that day ({formatDateShort(c.after.from)} to {formatDateShort(c.after.to)})
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {comparisonRows(c).map(([label, b, a]) => (
                    <tr key={label} className="border-b border-line align-top">
                      <th scope="row" className="py-1 pr-2 font-normal">
                        {label}
                      </th>
                      <td className="py-1 pr-2 tabular-nums">{b}</td>
                      <td className="py-1 tabular-nums">{a}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="text-ink-2">Not enough records on both sides to compare yet. It needs at least {COMPARE_MIN_DAYS} days with something recorded before and after.</p>
            )}
            {c.otherChanges.length > 0 && <p className="mt-1 text-sm text-ink-2">In the same weeks: {c.otherChanges.join(', ')}.</p>}
          </section>
        ))}
      </div>
      <p className="mt-3 text-sm text-ink-2">{BOWEL_BLADDER_NOTE}</p>
    </Card>
  );
}
