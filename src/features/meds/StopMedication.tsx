import { useState } from 'react';
import { STOP_REASON_LABELS } from '../../core/sideEffects';
import { STOP_REASONS, type Medication, type StopReason } from '../../core/types';
import { todayKey } from '../../core/time';
import { Button, Disclaimer, Field, Segmented, Sheet, TextArea, TextField } from '../../ui/kit';

type Choice = StopReason | 'skip';

export interface StopValues {
  endDate: string;
  reason: StopReason | null;
  note: string | null;
}

const REASON_OPTIONS: { value: Choice; label: string }[] = [
  ...STOP_REASONS.map((r) => ({ value: r as Choice, label: STOP_REASON_LABELS[r] })),
  { value: 'skip', label: 'I’d rather not say' },
];

/**
 * Asked when she says "I no longer take this", and reused to fill in the reason for a medication that was stopped earlier.
 * Every question is optional: stopping is never blocked by it.
 */
export function StopMedicationSheet({
  med,
  mode,
  onClose,
  onSave,
}: {
  med: Medication;
  /** stopping now, or adding the reason to a medication that was already stopped */
  mode: 'stop' | 'edit';
  onClose: () => void;
  onSave: (v: StopValues) => Promise<void>;
}) {
  const [endDate, setEndDate] = useState(mode === 'edit' ? (med.endDate ?? '') : todayKey());
  const [choice, setChoice] = useState<Choice>(med.stopReason ?? 'skip');
  const [note, setNote] = useState(med.stopReasonNote ?? '');
  const [busy, setBusy] = useState(false);

  return (
    <Sheet open onClose={onClose} title={mode === 'stop' ? `Stopping ${med.name}` : `${med.name}: why it was stopped`}>
      <form
        className="grid gap-4"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          await onSave({ endDate: endDate || todayKey(), reason: choice === 'skip' ? null : choice, note: note.trim() || null });
          setBusy(false);
        }}
      >
        <p className="text-ink-2">
          {mode === 'stop'
            ? 'It moves to your past medications and its history is kept. Noting why is optional. It helps your doctor later, for example so they know what has and hasn’t worked for you.'
            : 'Noting why is optional. It helps your doctor know what has and hasn’t worked for you.'}
        </p>
        <TextField label={mode === 'stop' ? 'When did you stop?' : 'When did you stop taking it?'} type="date" value={endDate} max={todayKey()} onChange={setEndDate} />
        <Segmented<Choice> label="Why did you stop?" value={choice} onChange={setChoice} columns={1} options={REASON_OPTIONS} />
        <Field label="Anything you’d like to add? (optional)">
          {(id) => <TextArea id={id} value={note} onChange={(e) => setNote(e.target.value)} className="min-h-20" placeholder="e.g. what happened, or what your doctor said" />}
        </Field>
        <Disclaimer>Steady only records what happened. It doesn’t tell you to stop or change any medication. Never stop an anti-seizure medication without talking to your doctor.</Disclaimer>
        <div className="grid gap-2">
          <Button type="submit" variant="primary" size="lg" disabled={busy}>
            {mode === 'stop' ? 'Save and move to past medications' : 'Save'}
          </Button>
          <Button onClick={onClose}>Cancel</Button>
        </div>
      </form>
    </Sheet>
  );
}
