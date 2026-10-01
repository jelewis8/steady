import { useState } from 'react';
import { Plus } from 'lucide-react';
import { describeChange, newDoseChange, sortDoseChanges } from '../../core/doseChanges';
import { formatDateShort, todayKey } from '../../core/time';
import type { DoseChange, Medication } from '../../core/types';
import { useDoseChanges } from '../../data/hooks';
import { deleteDoseChange, saveDoseChange } from '../../data/repo';
import { toast } from '../../state/ui';
import { Button, Field, Sheet, TextArea, TextField } from '../../ui/kit';

/** Add or edit one dose change. Mounted only while open (the Sheet does that). */
function DoseChangeSheet({ initial, isNew, onClose }: { initial: DoseChange; isNew: boolean; onClose: () => void }) {
  const [d, setD] = useState<DoseChange>(initial);
  const [tried, setTried] = useState(false);
  const set = (p: Partial<DoseChange>) => setD({ ...d, ...p });
  const dateMissing = !d.date;
  const toMissing = !d.to.trim();

  async function save() {
    setTried(true);
    if (dateMissing || toMissing) return;
    const undo = await saveDoseChange(d);
    toast(isNew ? 'Dose change added.' : 'Dose change saved.', undo);
    onClose();
  }

  return (
    <Sheet open onClose={onClose} title={isNew ? 'Add a dose change' : 'Edit dose change'}>
      <form
        className="grid gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <p className="text-ink-2">A record of what happened, for you and your care team. Only change a dose when your prescriber says to.</p>
        <TextField
          label="From which day?"
          type="date"
          value={d.date}
          onChange={(v) => set({ date: v })}
          aria-invalid={tried && dateMissing}
          hint={tried && dateMissing ? 'Choose the day the new dose started.' : undefined}
        />
        <TextField label="Dose before (optional)" value={d.from} onChange={(v) => set({ from: v })} placeholder="e.g. 100 mg" autoComplete="off" />
        <TextField
          label="Dose after"
          value={d.to}
          onChange={(v) => set({ to: v })}
          placeholder="e.g. 150 mg"
          autoComplete="off"
          aria-invalid={tried && toMissing}
          hint={tried && toMissing ? 'Add the new dose, for example 150 mg.' : undefined}
        />
        <Field label="Notes (optional)">{(id) => <TextArea id={id} value={d.note ?? ''} onChange={(e) => set({ note: e.target.value || null })} className="min-h-20" />}</Field>
        <div className="grid gap-2">
          <Button type="submit" variant="primary" size="lg">
            Save
          </Button>
          {!isNew && (
            <Button
              variant="ghost"
              onClick={async () => {
                const undo = await deleteDoseChange(d.id);
                toast('Dose change removed.', undo);
                onClose();
              }}
            >
              Remove this entry
            </Button>
          )}
          <Button onClick={onClose}>Cancel</Button>
        </div>
      </form>
    </Sheet>
  );
}

/** The dated dose changes for one medication, newest first, with a way to add one from the past. */
export function DoseHistory({ med }: { med: Medication }) {
  const all = useDoseChanges();
  const changes = sortDoseChanges(all.filter((c) => c.medicationId === med.id));
  const [editing, setEditing] = useState<{ change: DoseChange; isNew: boolean } | null>(null);
  return (
    <>
      {changes.length === 0 ? (
        <p className="text-ink-2">No dose changes recorded. When you change the dose above, Steady asks from which day and keeps the history here.</p>
      ) : (
        <ul className="grid gap-2">
          {changes.map((c) => (
            <li key={c.id} className="flex items-start gap-2 rounded-xl bg-surface-2 p-3">
              <div className="min-w-0 flex-1">
                <div className="font-bold">{describeChange(c)}</div>
                <div className="text-sm text-ink-2">From {formatDateShort(c.date)}</div>
                {c.note && <div className="mt-1 text-sm">{c.note}</div>}
              </div>
              <Button variant="quiet" aria-label={`Edit the dose change from ${formatDateShort(c.date)}`} onClick={() => setEditing({ change: c, isNew: false })}>
                Edit
              </Button>
            </li>
          ))}
        </ul>
      )}
      <Button className="mt-3" icon={<Plus aria-hidden size={20} />} onClick={() => setEditing({ change: newDoseChange(med.id, todayKey(), '', ''), isNew: true })}>
        Add a dose change
      </Button>
      {editing && <DoseChangeSheet initial={editing.change} isNew={editing.isNew} onClose={() => setEditing(null)} />}
    </>
  );
}
