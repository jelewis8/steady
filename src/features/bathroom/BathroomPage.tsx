import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Trash2 } from 'lucide-react';
import { BOWEL_HOW_LABELS } from '../../core/bathroom';
import { addDays, dateRange, formatClock, formatDateLong, parseTime, todayKey } from '../../core/time';
import { useBathroomLogs, usePrefs, useTemplates } from '../../data/hooks';
import { addBowelItemToRoutines, setBathroomBreaks, updatePreferences } from '../../data/repo';
import { toast } from '../../state/ui';
import { Button, Card, CardTitle, Disclaimer, Field, Input, PageHeader, Toggle } from '../../ui/kit';
import { BathroomSheet } from './BathroomSheet';

const pad = (n: number) => String(n).padStart(2, '0');
const hhmm = (mins: number) => `${pad(Math.floor(mins / 60))}:${pad(mins % 60)}`;
const minutesOf = (t: string) => {
  const p = parseTime(t);
  return p.hour * 60 + p.minute;
};

/** Bowel and bladder: switch it on, add the daily question, choose bathroom-break times, and fill in recent days. */
export function BathroomPage() {
  const prefs = usePrefs();
  const templatesRaw = useTemplates();
  const templates = useMemo(() => templatesRaw ?? [], [templatesRaw]);
  const logs = useBathroomLogs();
  const [day, setDay] = useState<string | null>(null);
  const [newTime, setNewTime] = useState('09:00');
  const enabled = !!prefs?.trackBathroom;
  const today = todayKey();

  const hasBowelItem = templates.length > 0 && templates.every((t) => t.items.some((i) => i.category === 'bowel'));
  const breaks = useMemo(() => {
    const set = new Set<string>();
    for (const t of templates) for (const i of t.items) if (i.category === 'bathroom') set.add(`${pad(i.hour)}:${pad(i.minute)}`);
    return [...set].sort();
  }, [templates]);

  const wake = minutesOf(prefs?.targetWakeTime ?? '07:00');
  const bed = minutesOf(prefs?.targetBedtime ?? '22:30');

  async function applyBreaks(times: string[], message: string) {
    const undo = await setBathroomBreaks(times);
    toast(message, undo);
  }

  const recent = dateRange(addDays(today, -13), today).reverse();
  const byDate = new Map(logs.map((l) => [l.date, l]));

  return (
    <div className="grid gap-4 pb-6">
      <PageHeader title="Bowel & bladder" back="/more" subtitle="Private, and only on this device. It can go into your report for your neurologist." />

      <Card>
        <Toggle
          label="Keep track of bowel and bladder"
          hint="Shows a small card on Today, a marker on the calendar, and a section in your report."
          checked={enabled}
          onChange={(v) => updatePreferences({ trackBathroom: v })}
        />
      </Card>

      {enabled && (
        <>
          <Card labelledBy="q-h">
            <CardTitle id="q-h">A daily question in my routine</CardTitle>
            <p className="mb-3 text-ink-2">Adds “Bowel movement today?” to your routine each evening, so it’s asked for you. You can change its time in Schedule.</p>
            {hasBowelItem ? (
              <p>
                <strong>It’s in your routine.</strong>{' '}
                <Link to="/schedule" className="font-bold text-accent-text underline underline-offset-4">
                  Change the time
                </Link>
              </p>
            ) : (
              <Button
                variant="primary"
                onClick={async () => {
                  const undo = await addBowelItemToRoutines('20:00');
                  toast('Added “Bowel movement today?” to your routine at 8:00 PM.', undo);
                }}
              >
                Add it to my routine
              </Button>
            )}
          </Card>

          <Card labelledBy="br-h">
            <CardTitle id="br-h">Bathroom break reminders</CardTitle>
            <p className="mb-3 text-ink-2">Times you’d like to be reminded, for example if you don’t always notice you need to go. They appear in your routine with a reminder.</p>
            {breaks.length > 0 ? (
              <ul className="mb-3 flex flex-wrap gap-2">
                {breaks.map((t) => (
                  <li key={t}>
                    <Button
                      variant="quiet"
                      aria-label={`Remove the ${formatClock(parseTime(t).hour, parseTime(t).minute)} reminder`}
                      icon={<Trash2 aria-hidden size={16} />}
                      onClick={() =>
                        applyBreaks(
                          breaks.filter((x) => x !== t),
                          `Removed the ${formatClock(parseTime(t).hour, parseTime(t).minute)} reminder.`,
                        )
                      }
                    >
                      {formatClock(parseTime(t).hour, parseTime(t).minute)}
                    </Button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mb-3">No bathroom break reminders yet.</p>
            )}
            <form
              className="flex items-end gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (newTime) void applyBreaks([...breaks, newTime], `Added a reminder at ${formatClock(parseTime(newTime).hour, parseTime(newTime).minute)}.`);
              }}
            >
              <div className="flex-1">
                <Field label="Add a time">{(id) => <Input id={id} type="time" value={newTime} onChange={(e) => setNewTime(e.target.value)} />}</Field>
              </div>
              <Button type="submit" icon={<Plus aria-hidden size={20} />}>
                Add
              </Button>
            </form>
            <div className="mt-4">
              <p className="mb-2 font-bold">Quick fill</p>
              <div className="flex flex-wrap gap-2">
                <Button onClick={() => applyBreaks([...breaks, hhmm(wake + 15)], 'Added a reminder just after you wake up.')}>After I wake up</Button>
                <Button onClick={() => applyBreaks([...breaks, hhmm(Math.max(0, bed - 15))], 'Added a reminder before bed.')}>Before bed</Button>
                <Button
                  onClick={() => {
                    const times: string[] = [];
                    for (let m = wake + 120; m < bed - 30; m += 180) times.push(hhmm(m));
                    void applyBreaks([...breaks, ...times], 'Added a reminder every 3 hours while you’re up.');
                  }}
                >
                  Every 3 hours
                </Button>
                {breaks.length > 0 && (
                  <Button variant="ghost" onClick={() => applyBreaks([], 'Removed all bathroom break reminders.')}>
                    Clear all
                  </Button>
                )}
              </div>
              <p className="mt-2 text-sm text-ink-2">Quick fill uses your wake time and bedtime from Sleep. Adjust any of them after.</p>
            </div>
          </Card>

          <Card labelledBy="rec-h">
            <CardTitle id="rec-h">Recent days</CardTitle>
            <ul className="grid gap-1.5">
              {recent.map((d) => {
                const l = byDate.get(d);
                const text = l
                  ? [
                      l.bowel === true ? `bowel movement${l.bowelHow ? ` (${BOWEL_HOW_LABELS[l.bowelHow].toLowerCase()})` : ''}` : l.bowel === false ? 'no bowel movement' : null,
                      l.urinationCount ? `urinated ${l.urinationCount} ${l.urinationCount === 1 ? 'time' : 'times'}` : null,
                    ]
                      .filter(Boolean)
                      .join(' · ') || 'nothing recorded'
                  : 'nothing recorded';
                return (
                  <li key={d} className="flex items-center gap-2 border-b border-line py-1.5">
                    <span className="min-w-0 flex-1">
                      <span className="block font-bold">{d === today ? 'Today' : formatDateLong(d)}</span>
                      <span className="block text-sm text-ink-2">{text}</span>
                    </span>
                    <Button variant="quiet" aria-label={`Edit ${d === today ? 'today' : formatDateLong(d)}`} onClick={() => setDay(d)}>
                      Edit
                    </Button>
                  </li>
                );
              })}
            </ul>
          </Card>
        </>
      )}

      <Disclaimer>Steady keeps the record. It can’t tell you whether anything is a problem. If you have ongoing constipation or other worries, tell your doctor or pharmacist.</Disclaimer>
      {day && <BathroomSheet key={day} date={day} open onClose={() => setDay(null)} />}
    </div>
  );
}
