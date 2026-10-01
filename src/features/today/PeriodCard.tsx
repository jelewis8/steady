import { Droplet } from 'lucide-react';
import { formatDateLong, todayKey } from '../../core/time';
import { useCheckIn, usePrefs } from '../../data/hooks';
import { saveCheckIn } from '../../data/repo';
import { Card, CardTitle, Segmented } from '../../ui/kit';

type Answer = 'yes' | 'no';

/**
 * One-tap period question for a day (B-013). Shown only when she has turned on cycle tracking.
 * It writes the same field as the check-in sheet (`onPeriod`), so the calendar marker and the
 * cycle insight read it, and it is available at any hour instead of only after 17:00.
 */
export function PeriodCard({ date }: { date: string }) {
  const prefs = usePrefs();
  const checkIn = useCheckIn(date);
  if (!prefs?.trackCycle) return null;
  const isToday = date === todayKey();
  const value: Answer | null = checkIn?.onPeriod == null ? null : checkIn.onPeriod ? 'yes' : 'no';
  const question = isToday ? 'Period today?' : `Period on ${formatDateLong(date)}?`;

  return (
    <Card labelledBy={`period-h-${date}`}>
      <CardTitle id={`period-h-${date}`} icon={<Droplet aria-hidden size={20} />}>
        Period
      </CardTitle>
      <Segmented
        label={question}
        value={value}
        onChange={(v: Answer) => void saveCheckIn(date, { onPeriod: v === 'yes' })}
        options={[
          { value: 'yes', label: 'Yes' },
          { value: 'no', label: 'No' },
        ]}
      />
      <p className="mt-2 text-sm text-ink-2" aria-live="polite">
        {value === null ? 'Not recorded yet. You can skip it any day.' : 'Saved. Tap the other answer to change it.'}
      </p>
    </Card>
  );
}
