import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { addDays, formatDateLong, todayKey } from '../../core/time';
import { Button, Sheet, TextField } from '../../ui/kit';

/** "Log from an earlier day": pick any past day and open it. */
export function PickDaySheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const nav = useNavigate();
  const yesterday = addDays(todayKey(), -1);
  const [date, setDate] = useState(yesterday);
  const go = (d: string) => {
    onClose();
    nav(`/day/${d}`);
  };
  return (
    <Sheet open={open} onClose={onClose} title="Log from an earlier day">
      <p className="mb-4 text-ink-2">Forgot to tick something off, or want to add a seizure or a night’s sleep from a past day? Pick the day. Only record what you remember. Blanks are fine.</p>
      <div className="grid gap-3">
        <Button size="lg" onClick={() => go(yesterday)}>
          Yesterday ({formatDateLong(yesterday)})
        </Button>
        <Button size="lg" onClick={() => go(addDays(todayKey(), -2))}>
          The day before ({formatDateLong(addDays(todayKey(), -2))})
        </Button>
        <form
          className="grid gap-3 rounded-xl border border-line p-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (date && date < todayKey()) go(date);
          }}
        >
          <TextField label="Another day" type="date" value={date} max={yesterday} onChange={setDate} />
          <Button type="submit" variant="primary" size="lg" disabled={!date || date >= todayKey()}>
            Open that day
          </Button>
        </form>
      </div>
    </Sheet>
  );
}
