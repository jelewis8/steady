import { useEffect, useState } from 'react';
import { BOWEL_HOW_LABELS } from '../../core/bathroom';
import { formatDateLong, todayKey } from '../../core/time';
import type { BowelHow } from '../../core/types';
import { useBathroomLog } from '../../data/hooks';
import { saveBathroomLog } from '../../data/repo';
import { toast } from '../../state/ui';
import { Button, Field, Segmented, Sheet, Stepper, TextArea } from '../../ui/kit';

type Yn = 'yes' | 'no' | 'skip';
type How = BowelHow | 'skip';

/**
 * Bowel and bladder for one day. Plain words, every question optional. Private: it never leaves the device.
 */
export function BathroomSheet({ date, open, onClose }: { date: string; open: boolean; onClose: () => void }) {
  const existing = useBathroomLog(date);
  const [bowel, setBowel] = useState<Yn>('skip');
  const [how, setHow] = useState<How>('skip');
  const [notes, setNotes] = useState('');
  const [count, setCount] = useState(0);
  const isToday = date === todayKey();

  useEffect(() => {
    if (!open || existing === undefined) return;
    setBowel(existing?.bowel == null ? 'skip' : existing.bowel ? 'yes' : 'no');
    setHow(existing?.bowelHow ?? 'skip');
    setNotes(existing?.bowelNotes ?? '');
    setCount(existing?.urinationCount ?? 0);
    // load once per opening, so typing is never overwritten
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, existing === undefined]);

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={isToday ? 'Bowel and bladder today' : `Bowel and bladder: ${formatDateLong(date)}`}
      footer={
        <Button
          variant="primary"
          size="lg"
          block
          onClick={async () => {
            const undo = await saveBathroomLog(date, {
              bowel: bowel === 'skip' ? null : bowel === 'yes',
              bowelHow: bowel === 'yes' && how !== 'skip' ? how : null,
              bowelNotes: notes.trim() || null,
              urinationCount: count,
            });
            toast('Saved.', undo);
            onClose();
          }}
        >
          Save
        </Button>
      }
    >
      <div className="grid gap-5">
        <p className="text-ink-2">Only what you want to record. It stays on this device.</p>
        <Segmented<Yn>
          label={isToday ? 'Did you have a bowel movement today?' : 'Did you have a bowel movement that day?'}
          value={bowel}
          onChange={setBowel}
          columns={3}
          options={[
            { value: 'yes', label: 'Yes' },
            { value: 'no', label: 'No' },
            { value: 'skip', label: 'Skip' },
          ]}
        />
        {bowel === 'yes' && (
          <Segmented<How>
            label="How was it?"
            value={how}
            onChange={setHow}
            columns={2}
            options={[
              { value: 'hard', label: BOWEL_HOW_LABELS.hard },
              { value: 'normal', label: BOWEL_HOW_LABELS.normal },
              { value: 'loose', label: BOWEL_HOW_LABELS.loose },
              { value: 'skip', label: 'Not sure' },
            ]}
          />
        )}
        {bowel !== 'skip' && (
          <Field label="What did you eat or drink beforehand? (optional)">
            {(id) => <TextArea id={id} value={notes} onChange={(e) => setNotes(e.target.value)} className="min-h-20" placeholder="Anything you want to remember" />}
          </Field>
        )}
        <Stepper label="Times you urinated" value={count} onChange={setCount} max={40} />
      </div>
    </Sheet>
  );
}
