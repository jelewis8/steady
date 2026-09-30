import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Plus, Trash2 } from 'lucide-react';
import { sortTimes } from '../../core/checklist';
import { parseUnitsPerDose } from '../../core/stats';
import { addDays, dateKeyOf, formatIsoClock, relativeDay, todayKey } from '../../core/time';
import type { DoseStatus, Medication } from '../../core/types';
import { db } from '../../data/db';
import { useDoses } from '../../data/hooks';
import { deleteMedication, newMedication, saveMedication } from '../../data/repo';
import { toast } from '../../state/ui';
import { Button, Card, Disclaimer, Field, IconButton, Input, PageHeader, TextArea, TextField, Toggle } from '../../ui/kit';

const STATUS_TEXT: Record<DoseStatus, string> = {
  pending: 'Not recorded',
  taken: '✓ Taken',
  taken_late: '✓ Taken late',
  skipped: '— Skipped',
  unsure: '? Not sure',
};

export function MedEditorPage() {
  const { id } = useParams();
  const isNew = id === 'new';
  const nav = useNavigate();
  const [m, setM] = useState<Medication | null>(null);
  const [effect, setEffect] = useState('');
  // Keep what she types as text while editing (so the field can be cleared and retyped); check it on save.
  const [unitsText, setUnitsText] = useState('1');
  const today = todayKey();
  const doses = useDoses(addDays(today, -13), today).filter((d) => d.medicationId === id);

  useEffect(() => {
    (async () => {
      if (isNew) setM(newMedication());
      else if (id) {
        const found = await db.medications.get(id);
        if (!found) nav('/meds', { replace: true });
        else {
          setM(found);
          setUnitsText(String(found.unitsPerDose ?? 1));
        }
      }
    })();
  }, [id, isNew, nav]);

  if (!m) return <p className="text-ink-2">Loading…</p>;
  const set = (p: Partial<Medication>) => setM({ ...m, ...p });
  const unitsPerDose = parseUnitsPerDose(unitsText);
  const valid = m.name.trim() && m.dosage.trim() && unitsPerDose != null && (m.isRescue || m.scheduledTimes.length > 0);

  async function save() {
    if (!m || !valid || unitsPerDose == null) return;
    await saveMedication({
      ...m,
      unitsPerDose,
      name: m.name.trim(),
      dosage: m.dosage.trim(),
      scheduledTimes: m.isRescue ? [] : sortTimes(m.scheduledTimes),
      frequency: m.isRescue ? 'as needed' : m.scheduledTimes.length === 1 ? 'once daily' : m.scheduledTimes.length === 2 ? 'twice daily' : `${m.scheduledTimes.length} times daily`,
    });
    toast(isNew ? `${m.name} added. It’s now on your daily checklist.` : 'Medication saved.');
    nav('/meds');
  }

  return (
    <div className="grid gap-4 pb-6">
      <PageHeader title={isNew ? 'Add medication' : m.name || 'Medication'} back="/meds" />
      <Card>
        <form
          className="grid gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            void save();
          }}
        >
          <TextField label="Name" value={m.name} onChange={(v) => set({ name: v })} placeholder="e.g. Lamotrigine" required autoComplete="off" />
          <div className="grid grid-cols-2 gap-3">
            <TextField label="Dose" value={m.dosage} onChange={(v) => set({ dosage: v })} placeholder="e.g. 100" required inputMode="decimal" />
            <TextField label="Unit" value={m.unit} onChange={(v) => set({ unit: v })} placeholder="mg, mL, tablet" />
          </div>
          <Toggle
            label="This is a rescue medication"
            hint="Used only in an emergency, as your plan says. It won’t be scheduled."
            checked={m.isRescue}
            onChange={(v) => set({ isRescue: v })}
          />
          {!m.isRescue && (
            <fieldset>
              <legend className="mb-1.5 font-bold">Times each day</legend>
              <div className="grid gap-2">
                {m.scheduledTimes.map((t, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <Input
                      type="time"
                      aria-label={`Dose time ${i + 1}`}
                      value={t}
                      onChange={(e) => set({ scheduledTimes: m.scheduledTimes.map((x, j) => (j === i ? e.target.value : x)) })}
                    />
                    <IconButton label={`Remove dose time ${i + 1}`} onClick={() => set({ scheduledTimes: m.scheduledTimes.filter((_, j) => j !== i) })}>
                      <Trash2 aria-hidden size={22} />
                    </IconButton>
                  </div>
                ))}
                <Button icon={<Plus aria-hidden size={20} />} onClick={() => set({ scheduledTimes: [...m.scheduledTimes, '12:00'] })}>
                  Add a time
                </Button>
              </div>
              <p className="mt-2 text-sm text-ink-2">Tip: tying doses to something you already do (breakfast, brushing teeth) makes them easier to remember.</p>
            </fieldset>
          )}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Pills/doses left" hint="Optional — for refill reminders">
              {(fid, d) => (
                <Input
                  id={fid}
                  aria-describedby={d}
                  type="number"
                  inputMode="numeric"
                  min={0}
                  value={m.remainingCount ?? ''}
                  onChange={(e) => set({ remainingCount: e.target.value === '' ? null : Math.max(0, Number(e.target.value)) })}
                />
              )}
            </Field>
            <Field label="Used per dose" hint="e.g. 2 tablets">
              {(fid, d) => (
                <Input id={fid} aria-describedby={d} inputMode="decimal" value={unitsText} onChange={(e) => setUnitsText(e.target.value)} />
              )}
            </Field>
          </div>
          {unitsPerDose == null && <p className="text-sm text-attn-ink">Enter how many you take each time, for example 1 or 2 (or 0.5 for half).</p>}
          {!isNew && unitsPerDose != null && unitsPerDose !== m.unitsPerDose && (
            <p className="text-sm text-ink-2">If you change this, check that “Pills/doses left” still matches what you have, so the refill reminder stays right.</p>
          )}
          <Field label="Remind me to refill when this many days are left">
            {(fid) => <Input id={fid} type="number" inputMode="numeric" min={0} value={m.refillReminderDays} onChange={(e) => set({ refillReminderDays: Math.max(0, Number(e.target.value) || 0) })} />}
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <TextField label="Prescriber" value={m.prescriber ?? ''} onChange={(v) => set({ prescriber: v || null })} />
            <TextField label="Pharmacy" value={m.pharmacy ?? ''} onChange={(v) => set({ pharmacy: v || null })} />
          </div>
          <TextField label="Started on" type="date" value={m.startDate} onChange={(v) => set({ startDate: v || todayKey() })} />
          <div>
            <span className="font-bold">Side effects I’ve noticed</span>
            <ul className="my-2 flex flex-wrap gap-2">
              {m.sideEffectsNoted.map((s) => (
                <li key={s}>
                  <Button variant="quiet" aria-label={`Remove side effect ${s}`} onClick={() => set({ sideEffectsNoted: m.sideEffectsNoted.filter((x) => x !== s) })}>
                    {s} ✕
                  </Button>
                </li>
              ))}
            </ul>
            <div className="flex gap-2">
              <Input aria-label="Add a side effect" placeholder="e.g. Dizziness" value={effect} onChange={(e) => setEffect(e.target.value)} />
              <Button
                onClick={() => {
                  if (effect.trim()) set({ sideEffectsNoted: [...new Set([...m.sideEffectsNoted, effect.trim()])] });
                  setEffect('');
                }}
              >
                Add
              </Button>
            </div>
          </div>
          <Field label="Notes">{(fid) => <TextArea id={fid} value={m.notes ?? ''} onChange={(e) => set({ notes: e.target.value || null })} className="min-h-20" />}</Field>
          <Button type="submit" variant="primary" size="lg" disabled={!valid}>
            {isNew ? 'Add medication' : 'Save changes'}
          </Button>
          {!valid && <p className="text-sm text-ink-2">Add a name, a dose{m.isRescue ? '' : ' and at least one time'}, and how many you take each time, to save.</p>}
        </form>
      </Card>

      {!isNew && doses.length > 0 && (
        <Card labelledBy="hist-h">
          <h2 id="hist-h" className="mb-2 text-lg font-bold">
            Last 14 days
          </h2>
          <ul className="grid gap-1">
            {[...doses]
              .filter((d) => new Date(d.scheduledTime) <= new Date() || d.status !== 'pending')
              .sort((a, b) => (a.scheduledTime < b.scheduledTime ? 1 : -1))
              .map((d) => (
                <li key={d.id} className="flex justify-between gap-2 border-b border-line py-1.5">
                  <span>
                    {relativeDay(dateKeyOf(d.scheduledTime))} · {formatIsoClock(d.scheduledTime)}
                  </span>
                  <span className="font-bold">
                    {STATUS_TEXT[d.status]}
                    {d.actualTime && d.status !== 'pending' ? ` ${formatIsoClock(d.actualTime)}` : ''}
                  </span>
                </li>
              ))}
          </ul>
        </Card>
      )}

      {!isNew && m.isActive && (
        <Button
          variant="ghost"
          icon={<Trash2 aria-hidden size={20} />}
          onClick={async () => {
            const undo = await deleteMedication(m.id);
            toast(`${m.name} moved to past medications. Dose history is kept.`, undo);
            nav('/meds');
          }}
        >
          I no longer take this
        </Button>
      )}
      <Disclaimer>Only change doses or times when your prescriber tells you to. Steady just keeps the record.</Disclaimer>
    </div>
  );
}
