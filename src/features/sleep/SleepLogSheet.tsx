import { useEffect, useState } from 'react';
import { formatHours, sleepDurationMinutes } from '../../core/time';
import { usePrefs, useSleepEntries } from '../../data/hooks';
import { saveSleep } from '../../data/repo';
import { toast } from '../../state/ui';
import { Button, Field, Input, Rating, Sheet, Stepper, TextArea, Toggle } from '../../ui/kit';

/** Log (or edit) the sleep for the night of `night` (e.g. yesterday's date for last night). */
export function SleepLogSheet({
  open,
  onClose,
  night,
  initialBed,
  initialWake,
}: {
  open: boolean;
  onClose: () => void;
  night: string;
  initialBed?: string;
  initialWake?: string;
}) {
  const prefs = usePrefs();
  const entries = useSleepEntries();
  const existing = entries.find((e) => e.date === night);
  const [bed, setBed] = useState('22:30');
  const [wake, setWake] = useState('07:00');
  const [quality, setQuality] = useState<1 | 2 | 3 | 4 | 5 | null>(null);
  const [interruptions, setInterruptions] = useState(0);
  const [windDown, setWindDown] = useState(false);
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (!open) return;
    setBed(initialBed ?? existing?.actualBedtime ?? prefs?.targetBedtime ?? '22:30');
    setWake(initialWake ?? existing?.actualWakeTime ?? prefs?.targetWakeTime ?? '07:00');
    setQuality(existing?.qualityRating ?? null);
    setInterruptions(existing?.interruptions ?? 0);
    setWindDown(existing?.windDownCompleted ?? false);
    setNotes(existing?.notes ?? '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const duration = bed && wake ? sleepDurationMinutes(bed, wake) : null;

  async function save() {
    await saveSleep({
      date: night,
      targetBedtime: prefs?.targetBedtime ?? '22:30',
      targetWakeTime: prefs?.targetWakeTime ?? '07:00',
      actualBedtime: bed,
      actualWakeTime: wake,
      qualityRating: quality,
      interruptions,
      windDownCompleted: windDown,
      notes: notes || null,
    });
    toast(`Sleep saved${duration ? ` — ${formatHours(duration)}` : ''}.`);
    onClose();
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="How did you sleep?"
      footer={
        <Button variant="primary" size="lg" block onClick={save}>
          Save sleep
        </Button>
      }
    >
      <div className="grid gap-5">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Went to sleep">{(id) => <Input id={id} type="time" value={bed} onChange={(e) => setBed(e.target.value)} />}</Field>
          <Field label="Woke up">{(id) => <Input id={id} type="time" value={wake} onChange={(e) => setWake(e.target.value)} />}</Field>
        </div>
        {duration != null && (
          <p className="text-lg" aria-live="polite">
            That’s about <strong>{formatHours(duration)}</strong> of sleep.
          </p>
        )}
        <Rating
          label="How well did you sleep?"
          value={quality}
          onChange={setQuality}
          low="1 · badly"
          high="5 · very well"
        />
        <Stepper label="Times you woke up in the night" value={interruptions} onChange={setInterruptions} max={20} />
        <Toggle label="I did my wind-down routine" checked={windDown} onChange={setWindDown} />
        <Field label="Notes (optional)">{(id) => <TextArea id={id} value={notes} onChange={(e) => setNotes(e.target.value)} className="min-h-20" />}</Field>
      </div>
    </Sheet>
  );
}
