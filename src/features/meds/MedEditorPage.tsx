import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Plus, Trash2 } from 'lucide-react';
import { doseDiffers, doseText, newDoseChange } from '../../core/doseChanges';
import { compactTimeUnits, isMedDueOn, pillsAt, repeatOf, WEEKDAY_LONG, WEEKDAY_ORDER, WEEKDAY_SHORT } from '../../core/medSchedule';
import { parseUnitsPerDose } from '../../core/stats';
import { STOP_REASON_SHORT } from '../../core/sideEffects';
import { addDays, dateKeyOf, formatDateLong, formatDateShort, formatIsoClock, relativeDay, todayKey } from '../../core/time';
import type { DoseStatus, MedRepeat, Medication } from '../../core/types';
import { db } from '../../data/db';
import { useDoses } from '../../data/hooks';
import { deleteMedication, newMedication, saveMedicationWithDoseChange, saveStopDetails } from '../../data/repo';
import { toast } from '../../state/ui';
import { DoseHistory } from './DoseHistory';
import { SideEffectsList } from './SideEffects';
import { StopMedicationSheet } from './StopMedication';
import { Button, Card, cx, Disclaimer, Field, IconButton, Input, PageHeader, Segmented, TextArea, TextField, Toggle } from '../../ui/kit';

const STATUS_TEXT: Record<DoseStatus, string> = {
  pending: 'Not recorded',
  taken: '✓ Taken',
  taken_late: '✓ Taken late',
  skipped: '— Skipped',
  unsure: '? Not sure',
};

type WeekdaysRepeat = Extract<MedRepeat, { kind: 'weekdays' }>;

export function MedEditorPage() {
  const { id } = useParams();
  const isNew = id === 'new';
  const nav = useNavigate();
  const [m, setM] = useState<Medication | null>(null);
  // the medication as it was saved, to notice when the dose is changed (F-011)
  const [saved, setSaved] = useState<Medication | null>(null);
  const [changeKind, setChangeKind] = useState<'change' | 'fix'>('change');
  const [changeDate, setChangeDate] = useState(todayKey());
  const [stopSheet, setStopSheet] = useState<'stop' | 'edit' | null>(null);
  // Keep what the user types as text while editing (so a field can be cleared and retyped); check it on save.
  // Rescue medications have no times, so they keep one "used per dose" field.
  const [unitsText, setUnitsText] = useState('1');
  // F-013: pills at each time, in the same order as the times on screen
  const [pills, setPills] = useState<string[]>([]);
  // F-014: "every how many days"
  const [everyText, setEveryText] = useState('2');
  const today = todayKey();
  const doses = useDoses(addDays(today, -13), today).filter((d) => d.medicationId === id);

  useEffect(() => {
    (async () => {
      if (isNew) {
        const fresh = newMedication();
        setM(fresh);
        setPills(fresh.scheduledTimes.map(() => '1'));
      } else if (id) {
        const found = await db.medications.get(id);
        if (!found) nav('/meds', { replace: true });
        else {
          setM(found);
          setSaved(found);
          setUnitsText(String(found.unitsPerDose ?? 1));
          setPills(found.scheduledTimes.map((t) => String(pillsAt(found, t))));
          const r = repeatOf(found);
          if (r.kind === 'everyN') setEveryText(String(r.n));
        }
      }
    })();
  }, [id, isNew, nav]);

  if (!m) return <p className="text-ink-2">Loading…</p>;
  const set = (p: Partial<Medication>) => setM({ ...m, ...p });

  const parsedPills = pills.map(parseUnitsPerDose);
  const pillsOk = m.isRescue ? parseUnitsPerDose(unitsText) != null : parsedPills.length === m.scheduledTimes.length && parsedPills.every((p) => p != null);
  const duplicateTimes = !m.isRescue && new Set(m.scheduledTimes).size !== m.scheduledTimes.length;
  const mode: 'daily' | 'weekdays' | 'every' = m.repeat?.kind === 'weekdays' ? 'weekdays' : m.repeat?.kind === 'everyN' ? 'every' : 'daily';
  const everyN = Number(everyText);
  const everyOk = Number.isInteger(everyN) && everyN >= 2 && everyN <= 60;
  const repeatOk = m.repeat?.kind === 'weekdays' ? m.repeat.days.length > 0 : m.repeat?.kind === 'everyN' ? everyOk && !!m.repeat.from : true;

  /** The medication as it would be saved, or null while a pill count is not filled in properly. */
  function draft(med: Medication): Medication | null {
    if (!pillsOk) return null;
    if (med.isRescue) return { ...med, unitsPerDose: parseUnitsPerDose(unitsText) ?? 1, scheduledTimes: [], timeUnits: {}, repeat: { kind: 'daily' } };
    const pairs = med.scheduledTimes.map((t, i) => ({ t, p: parsedPills[i] ?? 1 })).sort((x, y) => (x.t < y.t ? -1 : x.t > y.t ? 1 : 0));
    const per = pairs[0]?.p ?? 1;
    // a "certain weekdays" choice with all seven days is just every day
    const repeat: MedRepeat = med.repeat?.kind === 'weekdays' && med.repeat.days.length === 7 ? { kind: 'daily' } : (med.repeat ?? { kind: 'daily' });
    return {
      ...med,
      unitsPerDose: per,
      scheduledTimes: pairs.map((x) => x.t),
      timeUnits: compactTimeUnits(pairs.map((x) => x.t), pairs.map((x) => x.p), per),
      repeat,
    };
  }
  const next = draft(m);
  const doseChanged = !isNew && saved != null && next != null && doseDiffers(saved, next);
  const valid = !!(m.name.trim() && m.dosage.trim() && next && !duplicateTimes && repeatOk && (m.isRescue || m.scheduledTimes.length > 0));
  const upcoming = !m.isRescue && mode !== 'daily' && repeatOk ? Array.from({ length: 30 }, (_, i) => addDays(todayKey(), i)).filter((d) => isMedDueOn(m, d)).slice(0, 3) : [];

  async function save() {
    if (!m || !valid || !next) return;
    const count = next.scheduledTimes.length;
    const final: Medication = {
      ...next,
      name: m.name.trim(),
      dosage: m.dosage.trim(),
      frequency: m.isRescue
        ? 'as needed'
        : (count === 1 ? 'once daily' : count === 2 ? 'twice daily' : `${count} times daily`) + (repeatOf(next).kind === 'daily' ? '' : ' on certain days'),
    };
    const change = doseChanged && saved && changeKind === 'change' && changeDate ? newDoseChange(m.id, changeDate, doseText(saved), doseText(final)) : null;
    await saveMedicationWithDoseChange(final, change);
    toast(isNew ? `${m.name} added. It’s now on your daily checklist.` : change ? 'Medication saved. The dose change is in its history.' : 'Medication saved.');
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
            <TextField label="Dose" value={m.dosage} onChange={(v) => set({ dosage: v })} placeholder="e.g. 100" required inputMode="decimal" hint="One pill" />
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
              <legend className="mb-1.5 font-bold">Times and how many pills</legend>
              <div className="grid gap-2">
                {m.scheduledTimes.map((t, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <Input
                      type="time"
                      aria-label={`Dose time ${i + 1}`}
                      value={t}
                      onChange={(e) => set({ scheduledTimes: m.scheduledTimes.map((x, j) => (j === i ? e.target.value : x)) })}
                    />
                    <div className="flex items-center gap-1.5 whitespace-nowrap">
                      <span aria-hidden className="text-ink-2">Pills</span>
                      <Input
                        className="!w-20"
                        inputMode="decimal"
                        aria-label={`Pills to take at dose time ${i + 1}`}
                        aria-invalid={parseUnitsPerDose(pills[i] ?? '') == null}
                        value={pills[i] ?? ''}
                        onChange={(e) => setPills(pills.map((x, j) => (j === i ? e.target.value : x)))}
                      />
                    </div>
                    <IconButton
                      label={`Remove dose time ${i + 1}`}
                      onClick={() => {
                        set({ scheduledTimes: m.scheduledTimes.filter((_, j) => j !== i) });
                        setPills(pills.filter((_, j) => j !== i));
                      }}
                    >
                      <Trash2 aria-hidden size={22} />
                    </IconButton>
                  </div>
                ))}
                <Button
                  icon={<Plus aria-hidden size={20} />}
                  onClick={() => {
                    set({ scheduledTimes: [...m.scheduledTimes, '12:00'] });
                    setPills([...pills, '1']);
                  }}
                >
                  Add a time
                </Button>
              </div>
              {duplicateTimes && <p className="mt-2 text-sm text-attn-ink">Two doses are at the same time. Use one time and put the total in Pills (for example 2).</p>}
              {pills.some((p) => parseUnitsPerDose(p) == null) && (
                <p className="mt-2 text-sm text-attn-ink">Enter how many pills at each time, for example 1 or 2 (or 0.5 for half).</p>
              )}
              <p className="mt-2 text-sm text-ink-2">Tip: tying doses to something you already do (breakfast, brushing teeth) makes them easier to remember.</p>
            </fieldset>
          )}
          {!m.isRescue && (
            <div className="grid gap-3">
              <Segmented<'daily' | 'weekdays' | 'every'>
                label="Which days?"
                value={mode}
                onChange={(v) => {
                  if (v === 'daily') set({ repeat: { kind: 'daily' } });
                  else if (v === 'weekdays') set({ repeat: { kind: 'weekdays', days: m.repeat?.kind === 'weekdays' ? m.repeat.days : [] } });
                  else set({ repeat: { kind: 'everyN', n: everyOk ? everyN : 2, from: m.repeat?.kind === 'everyN' ? m.repeat.from : todayKey() } });
                }}
                columns={3}
                options={[
                  { value: 'daily', label: 'Every day' },
                  { value: 'weekdays', label: 'Certain weekdays' },
                  { value: 'every', label: 'Every few days' },
                ]}
              />
              {m.repeat?.kind === 'weekdays' && (
                <fieldset>
                  <legend className="mb-1.5 font-bold">Take it on these days</legend>
                  <div className="grid grid-cols-7 gap-1.5">
                    {WEEKDAY_ORDER.map((d) => {
                      const days = (m.repeat as WeekdaysRepeat).days;
                      const on = days.includes(d);
                      return (
                        <button
                          key={d}
                          type="button"
                          aria-pressed={on}
                          aria-label={WEEKDAY_LONG[d]}
                          onClick={() => set({ repeat: { kind: 'weekdays', days: on ? days.filter((x) => x !== d) : [...days, d] } })}
                          className={cx('tap !min-w-0 rounded-xl border-2 font-bold', on ? 'border-accent bg-accent text-accent-ink' : 'border-line-strong bg-surface')}
                        >
                          {WEEKDAY_SHORT[d]}
                          <span aria-hidden className="block text-xs font-normal">
                            {on ? '✓' : ' '}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                  {m.repeat.days.length === 0 && <p className="mt-2 text-sm text-attn-ink">Pick at least one day.</p>}
                </fieldset>
              )}
              {m.repeat?.kind === 'everyN' && (
                <div className="grid gap-3 rounded-xl border border-line p-3">
                  <TextField
                    label="Every how many days?"
                    inputMode="numeric"
                    value={everyText}
                    onChange={(v) => {
                      setEveryText(v);
                      const num = Number(v);
                      if (Number.isInteger(num) && num >= 2 && num <= 60 && m.repeat?.kind === 'everyN') set({ repeat: { ...m.repeat, n: num } });
                    }}
                    hint={everyOk || everyText === '' ? '2 means every other day.' : 'Use a whole number from 2 to 60.'}
                    aria-invalid={!everyOk && everyText !== ''}
                  />
                  <TextField
                    label="A day you take it"
                    type="date"
                    value={m.repeat.from}
                    onChange={(v) => set({ repeat: { kind: 'everyN', n: everyOk ? everyN : 2, from: v || todayKey() } })}
                    hint="This day, and then every few days from it."
                  />
                </div>
              )}
              {upcoming.length > 0 && (
                <p>
                  <strong>Next:</strong> {upcoming.map((d) => formatDateLong(d)).join(' · ')}
                </p>
              )}
            </div>
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
            {m.isRescue && (
              <Field label="Used per dose" hint="e.g. 2 tablets">
                {(fid, d) => <Input id={fid} aria-describedby={d} inputMode="decimal" value={unitsText} onChange={(e) => setUnitsText(e.target.value)} />}
              </Field>
            )}
          </div>
          {m.isRescue && parseUnitsPerDose(unitsText) == null && (
            <p className="text-sm text-attn-ink">Enter how many you take each time, for example 1 or 2 (or 0.5 for half).</p>
          )}
          {doseChanged && <p className="text-sm text-ink-2">If you change the pills, check that “Pills/doses left” still matches what you have, so the refill reminder stays right.</p>}
          {doseChanged && saved && next && (
            <fieldset className="grid gap-3 rounded-2xl border-2 border-line bg-surface-2 p-3">
              <legend className="px-1 font-bold">
                The dose is now {doseText(next)} (it was {doseText(saved)})
              </legend>
              <Segmented<'change' | 'fix'>
                label="What is this?"
                value={changeKind}
                onChange={setChangeKind}
                options={[
                  { value: 'change', label: 'A new dose', hint: 'keep it in the history' },
                  { value: 'fix', label: 'Fixing a mistake', hint: 'don’t add to the history' },
                ]}
              />
              {changeKind === 'change' && <TextField label="From which day?" type="date" value={changeDate} onChange={setChangeDate} hint="Today unless it started on another day." />}
            </fieldset>
          )}
          <Field label="Remind me to refill when this many days are left">
            {(fid) => <Input id={fid} type="number" inputMode="numeric" min={0} value={m.refillReminderDays} onChange={(e) => set({ refillReminderDays: Math.max(0, Number(e.target.value) || 0) })} />}
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <TextField label="Prescriber" value={m.prescriber ?? ''} onChange={(v) => set({ prescriber: v || null })} />
            <TextField label="Pharmacy" value={m.pharmacy ?? ''} onChange={(v) => set({ pharmacy: v || null })} />
          </div>
          <TextField label="Started on" type="date" value={m.startDate} onChange={(v) => set({ startDate: v || todayKey() })} />
          <Field label="Notes">{(fid) => <TextArea id={fid} value={m.notes ?? ''} onChange={(e) => set({ notes: e.target.value || null })} className="min-h-20" />}</Field>
          <Button type="submit" variant="primary" size="lg" disabled={!valid}>
            {isNew ? 'Add medication' : 'Save changes'}
          </Button>
          {!valid && (
            <p className="text-sm text-ink-2">
              Add a name, a dose{m.isRescue ? '' : ' and at least one time'}, how many pills each time{m.isRescue ? '' : ', and which days'}, to save.
            </p>
          )}
        </form>
      </Card>

      {!isNew && (
        <Card labelledBy="dc-h">
          <h2 id="dc-h" className="mb-2 text-lg font-bold">
            Dose changes
          </h2>
          <DoseHistory med={m} />
        </Card>
      )}

      {!isNew && (
        <Card labelledBy="se-h">
          <h2 id="se-h" className="mb-2 text-lg font-bold">
            Side effects I’ve noticed
          </h2>
          <SideEffectsList medicationId={m.id} />
        </Card>
      )}
      {isNew && <p className="text-sm text-ink-2">You can note side effects, and when they started, after you save this medication.</p>}

      {!isNew && !m.isActive && (
        <Card labelledBy="why-h">
          <h2 id="why-h" className="mb-2 text-lg font-bold">
            Why it was stopped
          </h2>
          <p>
            {m.endDate ? `Stopped ${formatDateShort(m.endDate)}. ` : ''}
            {m.stopReason ? STOP_REASON_SHORT[m.stopReason] : 'Reason not recorded.'}
          </p>
          {m.stopReasonNote && <p className="mt-1 whitespace-pre-line text-ink-2">{m.stopReasonNote}</p>}
          <Button className="mt-3" onClick={() => setStopSheet('edit')}>
            {m.stopReason ? 'Change this' : 'Add a reason'}
          </Button>
        </Card>
      )}

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
          onClick={() => setStopSheet('stop')}
        >
          I no longer take this
        </Button>
      )}
      {stopSheet && (
        <StopMedicationSheet
          med={m}
          mode={stopSheet}
          onClose={() => setStopSheet(null)}
          onSave={async (v) => {
            if (stopSheet === 'stop') {
              const undo = await deleteMedication(m.id, { endDate: v.endDate, reason: v.reason, note: v.note });
              toast(`${m.name} moved to past medications. Dose history is kept.`, undo);
              nav('/meds');
            } else {
              const undo = await saveStopDetails(m.id, { endDate: v.endDate, reason: v.reason, note: v.note });
              setM({ ...m, endDate: v.endDate, stopReason: v.reason, stopReasonNote: v.note });
              setStopSheet(null);
              toast('Saved.', undo);
            }
          }}
        />
      )}
      <Disclaimer>Only change doses or times when your prescriber tells you to. Steady just keeps the record.</Disclaimer>
    </div>
  );
}
