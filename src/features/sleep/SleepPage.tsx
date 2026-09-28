import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { averageSleepMinutes } from '../../core/stats';
import { addDays, dateRange, formatDateShort, formatHours, todayKey } from '../../core/time';
import { usePrefs, useSleepEntries } from '../../data/hooks';
import { deleteSleep, updatePreferences } from '../../data/repo';
import { toast } from '../../state/ui';
import { BarChart, ChartFrame } from '../../ui/charts';
import { Button, Card, CardTitle, Disclaimer, Field, IconButton, Input, PageHeader, Stat } from '../../ui/kit';
import { SleepLogSheet } from './SleepLogSheet';

export function SleepPage() {
  const entries = useSleepEntries();
  const prefs = usePrefs();
  const today = todayKey();
  const [night, setNight] = useState<string | null>(null);
  const nights = dateRange(addDays(today, -14), addDays(today, -1));
  const byDate = new Map(entries.map((e) => [e.date, e]));
  const avg7 = averageSleepMinutes(entries, addDays(today, -7), addDays(today, -1));
  const avg30 = averageSleepMinutes(entries, addDays(today, -30), addDays(today, -1));
  const data = nights.map((d) => ({
    label: formatDateShort(addDays(d, 1)),
    value: Math.round(((byDate.get(d)?.durationMinutes ?? 0) / 60) * 10) / 10,
    highlight: (byDate.get(d)?.durationMinutes ?? 999) < 360,
  }));

  return (
    <div className="grid gap-4">
      <PageHeader title="Sleep" back="/more" subtitle="Regular sleep is one of the most reliable ways to lower seizure risk." />
      <Button variant="primary" size="lg" onClick={() => setNight(addDays(today, -1))}>
        {byDate.has(addDays(today, -1)) ? 'Edit last night' : 'Log last night'}
      </Button>

      <Card labelledBy="avg-h">
        <CardTitle id="avg-h">Averages</CardTitle>
        <div className="grid grid-cols-2 gap-2">
          <Stat label="Last 7 nights" value={avg7 == null ? '—' : formatHours(avg7)} />
          <Stat label="Last 30 nights" value={avg30 == null ? '—' : formatHours(avg30)} />
        </div>
      </Card>

      <Card labelledBy="chart-h">
        <CardTitle id="chart-h">Last 14 nights</CardTitle>
        <ChartFrame
          title="Hours of sleep, last 14 nights"
          description={`Striped bars are nights under 6 hours. Dashed line is 7 hours.`}
          table={{ columns: ['Morning of', 'Hours'], rows: data.map((d) => [d.label, d.value || '—']) }}
        >
          <BarChart data={data} valueLabel={(v) => v.toFixed(1)} target={{ value: 7, label: '7 h' }} />
        </ChartFrame>
        <p className="mt-1 text-sm text-ink-2">Striped bars: less than 6 hours.</p>
      </Card>

      <Card labelledBy="tgt-h">
        <CardTitle id="tgt-h">My sleep targets</CardTitle>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Bedtime">
            {(id) => <Input id={id} type="time" value={prefs?.targetBedtime ?? '22:30'} onChange={(e) => updatePreferences({ targetBedtime: e.target.value })} />}
          </Field>
          <Field label="Wake time">
            {(id) => <Input id={id} type="time" value={prefs?.targetWakeTime ?? '07:00'} onChange={(e) => updatePreferences({ targetWakeTime: e.target.value })} />}
          </Field>
        </div>
        <p className="mt-2 text-sm text-ink-2">A fixed bedtime and wake time — even at weekends — helps most. Change your routine’s bedtime items in Schedule.</p>
      </Card>

      <section aria-labelledby="hist-h">
        <h2 id="hist-h" className="mb-2 text-lg font-bold">
          Diary
        </h2>
        <ul className="grid gap-2">
          {entries.slice(0, 30).map((e) => (
            <li key={e.id} className="flex items-center gap-2 rounded-2xl border-2 border-line bg-surface p-3">
              <button type="button" className="tap min-w-0 flex-1 text-left" onClick={() => setNight(e.date)}>
                <span className="block font-bold">Night of {formatDateShort(e.date)}</span>
                <span className="block text-ink-2">
                  {e.actualBedtime}–{e.actualWakeTime} · {e.durationMinutes != null ? formatHours(e.durationMinutes) : '—'}
                  {e.qualityRating ? ` · quality ${e.qualityRating}/5` : ''}
                  {e.interruptions ? ` · woke ${e.interruptions}×` : ''}
                </span>
              </button>
              <IconButton
                label={`Delete sleep entry for ${formatDateShort(e.date)}`}
                onClick={async () => {
                  const undo = await deleteSleep(e.id);
                  toast('Sleep entry deleted.', undo);
                }}
              >
                <Trash2 aria-hidden size={22} />
              </IconButton>
            </li>
          ))}
        </ul>
      </section>
      <Disclaimer>If you often sleep badly, snore, or wake gasping, mention it to your doctor — sleep problems can affect seizures.</Disclaimer>
      {night && <SleepLogSheet open={!!night} onClose={() => setNight(null)} night={night} />}
    </div>
  );
}
