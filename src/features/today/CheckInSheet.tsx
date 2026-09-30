import { useEffect, useState } from 'react';
import { formatDateLong, todayKey } from '../../core/time';
import type { DailyCheckIn } from '../../core/types';
import { useCheckIn, usePrefs } from '../../data/hooks';
import { saveCheckIn } from '../../data/repo';
import { toast, useUI } from '../../state/ui';
import { Button, Rating, Segmented, Sheet, Stepper, TextArea, Field } from '../../ui/kit';

type Yn = 'yes' | 'no' | 'skip';
const yn = (v: boolean | null | undefined): Yn => (v == null ? 'skip' : v ? 'yes' : 'no');
const fromYn = (v: Yn) => (v === 'skip' ? null : v === 'yes');

export function CheckInSheet({ open, onClose, date }: { open: boolean; onClose: () => void; date: string }) {
  const existing = useCheckIn(date);
  const prefs = usePrefs();
  const setQuickLog = useUI((s) => s.setQuickLog);
  const [form, setForm] = useState<Partial<DailyCheckIn>>({});

  useEffect(() => {
    if (open) setForm(existing ?? {});
  }, [open, existing]);

  const set = <K extends keyof DailyCheckIn>(k: K, v: DailyCheckIn[K]) => setForm((f) => ({ ...f, [k]: v }));

  async function save() {
    await saveCheckIn(date, {
      stress: form.stress ?? null,
      mood: form.mood ?? null,
      onPeriod: form.onPeriod ?? null,
      illness: form.illness ?? null,
      alcoholDrinks: form.alcoholDrinks ?? null,
      seizureActivityReported: form.seizureActivityReported ?? null,
      notes: form.notes ?? null,
    });
    onClose();
    toast('Check-in saved. Thank you.');
    if (date === todayKey() && form.seizureActivityReported && !existing?.seizureActivityReported) setQuickLog(true);
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={date === todayKey() ? 'How was today?' : `How was ${formatDateLong(date)}?`}
      footer={
        <Button variant="primary" size="lg" block onClick={save}>
          Save check-in
        </Button>
      }
    >
      <div className="grid gap-5">
        <p className="text-ink-2">Every question is optional. Answer only what feels easy.</p>
        <Rating label="Stress" value={form.stress ?? null} onChange={(v) => set('stress', v)} low="1 · calm" high="5 · very stressed" />
        <Rating label="Mood" value={form.mood ?? null} onChange={(v) => set('mood', v)} low="1 · very low" high="5 · great" />
        <Segmented
          label="Feeling unwell or feverish?"
          value={yn(form.illness)}
          onChange={(v) => set('illness', fromYn(v))}
          options={[
            { value: 'no', label: 'No' },
            { value: 'yes', label: 'Yes' },
            { value: 'skip', label: 'Skip' },
          ]}
        />
        {prefs?.trackCycle && (
          <Segmented
            label="On your period today?"
            value={yn(form.onPeriod)}
            onChange={(v) => set('onPeriod', fromYn(v))}
            options={[
              { value: 'no', label: 'No' },
              { value: 'yes', label: 'Yes' },
              { value: 'skip', label: 'Skip' },
            ]}
          />
        )}
        <Stepper label="Alcoholic drinks today" value={form.alcoholDrinks ?? 0} onChange={(v) => set('alcoholDrinks', v)} max={20} />
        {prefs?.eveningCheckInEnabled !== false && (
          <Segmented
            label="Any seizure activity today?"
            value={yn(form.seizureActivityReported)}
            onChange={(v) => set('seizureActivityReported', fromYn(v))}
            options={[
              { value: 'no', label: 'No' },
              { value: 'yes', label: 'Yes', hint: 'opens the log' },
              { value: 'skip', label: 'Not sure' },
            ]}
          />
        )}
        <Field label="Anything else about today?">
          {(id) => <TextArea id={id} value={form.notes ?? ''} onChange={(e) => set('notes', e.target.value)} className="min-h-20" />}
        </Field>
      </div>
    </Sheet>
  );
}
