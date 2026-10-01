import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bell, BellOff, Link2, Plus, Trash2, Wand2 } from 'lucide-react';
import { CATEGORY_LABELS, DEFAULT_ROUTINE_SETUP, MEAL_LABELS, type RoutineSetup } from '../../core/defaults';
import { uuid } from '../../core/ids';
import { formatClock, formatDateLong, isoNow, parseTime, prefers24h, todayKey } from '../../core/time';
import { ROUTINE_CATEGORIES, type MealType, type RoutineCategory, type RoutineTemplate, type RoutineTemplateItem } from '../../core/types';
import { isRepeating, nextRepeatDates, selectTemplate, shiftedDoseTime } from '../../core/checklist';
import { useDayPlan, useMedications, usePrefs, useTemplates } from '../../data/hooks';
import { deleteTemplate, patchTemplate, replaceRoutineFromSetup, saveTemplate, setDayTemplate } from '../../data/repo';
import { toast } from '../../state/ui';
import { CategoryIcon } from '../../ui/icons';
import { Button, Card, Disclaimer, Field, IconButton, Input, PageHeader, Segmented, Select, Sheet, TextField, Toggle, cx } from '../../ui/kit';
import { RoutineSetupForm } from './RoutineSetupForm';

const DAYS = [
  { n: 1, short: 'M', long: 'Monday' },
  { n: 2, short: 'T', long: 'Tuesday' },
  { n: 3, short: 'W', long: 'Wednesday' },
  { n: 4, short: 'T', long: 'Thursday' },
  { n: 5, short: 'F', long: 'Friday' },
  { n: 6, short: 'S', long: 'Saturday' },
  { n: 0, short: 'S', long: 'Sunday' },
];

type Row = { kind: 'item'; item: RoutineTemplateItem } | { kind: 'med'; id: string; label: string; hour: number; minute: number };

export function SchedulePage() {
  const templates = useTemplates();
  const meds = useMedications();
  const today = todayKey();
  const plan = useDayPlan(today);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editing, setEditing] = useState<RoutineTemplateItem | null>(null);
  const [rebuild, setRebuild] = useState(false);

  useEffect(() => {
    if (!templates?.length) return;
    if (!selectedId || !templates.some((t) => t.id === selectedId)) setSelectedId(selectTemplate(templates, today, plan)?.id ?? templates[0].id);
  }, [templates, selectedId, today, plan]);

  const t = templates?.find((x) => x.id === selectedId) ?? null;
  const todayTemplate = templates ? selectTemplate(templates, today, plan) : null;

  const rows = useMemo<Row[]>(() => {
    if (!t) return [];
    const r: Row[] = t.items.map((item) => ({ kind: 'item', item }));
    for (const m of meds) {
      if (!m.isActive || m.isRescue) continue;
      for (const time of m.scheduledTimes) {
        const { hour, minute } = parseTime(shiftedDoseTime(time, t)); // shown at the moved time on days this routine moves doses
        r.push({ kind: 'med', id: `${m.id}-${time}`, label: `${m.name} ${m.dosage}${m.unit}`, hour, minute });
      }
    }
    const mins = (x: Row) => (x.kind === 'item' ? x.item.hour * 60 + x.item.minute : x.hour * 60 + x.minute);
    return r.sort((a, b) => mins(a) - mins(b));
  }, [t, meds]);

  const byHour = useMemo(() => {
    const m = new Map<number, Row[]>();
    for (const r of rows) {
      const h = r.kind === 'item' ? r.item.hour : r.hour;
      m.set(h, [...(m.get(h) ?? []), r]);
    }
    return [...m.entries()];
  }, [rows]);

  if (!templates) return <p className="text-ink-2">Loading…</p>;
  if (!t) return null;

  const update = (patch: Partial<RoutineTemplate>) => patchTemplate(t.id, patch);

  async function saveItem(item: RoutineTemplateItem) {
    if (!t) return;
    const exists = t.items.some((i) => i.id === item.id);
    await update({ items: exists ? t.items.map((i) => (i.id === item.id ? item : i)) : [...t.items, item] });
    setEditing(null);
    toast(exists ? 'Item updated.' : `“${item.label}” added to ${t.name}.`);
  }

  async function removeItem(item: RoutineTemplateItem) {
    if (!t) return;
    const before = t;
    await update({ items: t.items.filter((i) => i.id !== item.id) });
    toast(`“${item.label}” removed.`, () => saveTemplate(before));
  }

  async function newTemplate() {
    const copy: RoutineTemplate = {
      id: uuid(),
      name: 'New routine',
      isDefault: false,
      applicableDays: [],
      items: (t?.items ?? []).map((i) => ({ ...i, id: uuid() })),
      createdAt: isoNow(),
      updatedAt: isoNow(),
    };
    await saveTemplate(copy);
    setSelectedId(copy.id);
    toast('New routine created as a copy. Rename it and pick its days.');
  }

  return (
    <div className="grid gap-4">
      <PageHeader title="Schedule" subtitle="Your daily routine. Changes show up on today’s checklist straight away." />

      <div role="group" aria-label="Routines" className="flex flex-wrap gap-2">
        {templates.map((x) => (
          <button
            key={x.id}
            type="button"
            aria-pressed={x.id === t.id}
            onClick={() => setSelectedId(x.id)}
            className={cx(
              'tap rounded-xl border-2 px-4 font-bold',
              x.id === t.id ? 'border-accent bg-accent text-accent-ink' : 'border-line-strong bg-surface',
            )}
          >
            {x.name}
            {todayTemplate?.id === x.id && <span className="font-normal"> · today</span>}
          </button>
        ))}
        <Button variant="ghost" icon={<Plus aria-hidden size={20} />} onClick={newTemplate}>
          New routine
        </Button>
      </div>

      <Card>
        <div className="grid gap-4">
          <Field label="Routine name">
            {(id) => <NameInput id={id} key={t.id} initial={t.name} onCommit={(name) => update({ name: name.trim() || 'Routine' })} />}
          </Field>
          <RepeatFields key={t.id} t={t} update={update} />
          {!isRepeatMode(t) && (
          <fieldset>
            <legend className="mb-1.5 font-bold">Use on these days</legend>
            <div className="grid grid-cols-7 gap-1.5">
              {DAYS.map((d) => {
                const on = t.applicableDays.includes(d.n);
                return (
                  <button
                    key={d.n}
                    type="button"
                    aria-pressed={on}
                    aria-label={d.long}
                    onClick={() => update({ applicableDays: on ? t.applicableDays.filter((x) => x !== d.n) : [...t.applicableDays, d.n] })}
                    className={cx('tap rounded-xl border-2 font-bold', on ? 'border-accent bg-accent text-accent-ink' : 'border-line-strong bg-surface')}
                  >
                    {d.short}
                    <span aria-hidden className="block text-xs font-normal">
                      {on ? '✓' : ' '}
                    </span>
                  </button>
                );
              })}
            </div>
            <p className="mt-2 text-sm text-ink-2">A day can belong to one routine. Routines with no days (like “Rest day”) can be picked on the Today screen.</p>
          </fieldset>
          )}
          <DoseShiftFields t={t} update={update} />
          <div className="flex flex-wrap gap-2">
            {todayTemplate?.id !== t.id && (
              <Button onClick={() => setDayTemplate(today, t.id).then(() => toast(`Today now uses “${t.name}”.`))}>Use this routine today</Button>
            )}
            <Button variant="ghost" icon={<Wand2 aria-hidden size={20} />} onClick={() => setRebuild(true)}>
              Rebuild from my times
            </Button>
          </div>
        </div>
      </Card>

      <section aria-labelledby="tl-h">
        <div className="mb-2 flex items-center justify-between">
          <h2 id="tl-h" className="text-lg font-bold">
            Hour by hour
          </h2>
          <Button
            variant="primary"
            icon={<Plus aria-hidden size={20} />}
            onClick={() =>
              setEditing({ id: uuid(), hour: 9, minute: 0, label: '', category: 'custom', linkedEntityId: null, reminderEnabled: true, reminderOffsetMinutes: 0, isOptional: false })
            }
          >
            Add item
          </Button>
        </div>
        <ol className="grid gap-3">
          {byHour.map(([hour, list]) => (
            <li key={hour} className="grid grid-cols-[4.5rem_1fr] gap-2">
              <div className="pt-3 text-right font-bold whitespace-nowrap tabular-nums text-ink-2">{prefers24h() ? formatClock(hour, 0) : ` `}</div>
              <ul className="grid gap-2 border-l-2 border-line pl-3">
                {list.map((r) =>
                  r.kind === 'med' ? (
                    <li key={r.id} className="flex items-center gap-2 rounded-xl bg-surface-2 p-2 pl-3">
                      <Link2 aria-label="Linked from medications" size={18} />
                      <div className="min-w-0 flex-1">
                        <div className="font-bold">
                          {formatClock(r.hour, r.minute)} · {r.label}
                        </div>
                        <Link to="/meds" className="text-sm text-accent-text underline underline-offset-2">
                          Edit in Medications
                        </Link>
                      </div>
                    </li>
                  ) : (
                    <li key={r.item.id} className="flex items-center gap-1 rounded-xl border-2 border-line bg-surface p-1 pl-3">
                      <CategoryIcon category={r.item.category} />
                      <button type="button" className="tap min-w-0 flex-1 px-2 text-left" onClick={() => setEditing(r.item)} aria-label={`Edit ${r.item.label} at ${formatClock(r.item.hour, r.item.minute)}`}>
                        <span className="block font-bold">
                          {formatClock(r.item.hour, r.item.minute)} · {r.item.label}
                        </span>
                        <span className="flex flex-wrap gap-x-2 text-sm text-ink-2">
                          {CATEGORY_LABELS[r.item.category]}
                          {r.item.isOptional && <span>· optional</span>}
                          {r.item.isEssential && <span>· essential</span>}
                          <span className="inline-flex items-center gap-1">
                            · {r.item.reminderEnabled ? <Bell aria-hidden size={14} /> : <BellOff aria-hidden size={14} />}
                            {r.item.reminderEnabled ? 'reminder' : 'no reminder'}
                          </span>
                        </span>
                      </button>
                      <IconButton label={`Remove ${r.item.label}`} onClick={() => removeItem(r.item)}>
                        <Trash2 aria-hidden size={20} />
                      </IconButton>
                    </li>
                  ),
                )}
              </ul>
            </li>
          ))}
        </ol>
        <p className="mt-3 text-sm text-ink-2">Items linked (⛓) from your medication list are added automatically. Edit them in Medications.</p>
      </section>

      {templates.length > 1 && (
        <Button
          variant="ghost"
          icon={<Trash2 aria-hidden size={20} />}
          onClick={async () => {
            const undo = await deleteTemplate(t.id);
            setSelectedId(null);
            toast(`Routine “${t.name}” deleted.`, undo);
          }}
        >
          Delete this routine
        </Button>
      )}

      {editing && <ItemSheet item={editing} onClose={() => setEditing(null)} onSave={saveItem} />}
      <RebuildSheet open={rebuild} onClose={() => setRebuild(false)} />
    </div>
  );
}

function ItemSheet({ item, onClose, onSave }: { item: RoutineTemplateItem; onClose: () => void; onSave: (i: RoutineTemplateItem) => void }) {
  const [f, setF] = useState(item);
  const set = (p: Partial<RoutineTemplateItem>) => setF({ ...f, ...p });
  const time = `${String(f.hour).padStart(2, '0')}:${String(f.minute).padStart(2, '0')}`;
  return (
    <Sheet
      open
      onClose={onClose}
      title={item.label ? 'Edit item' : 'Add an item'}
      footer={
        <Button variant="primary" size="lg" block disabled={!f.label.trim()} onClick={() => onSave({ ...f, label: f.label.trim() })}>
          Save
        </Button>
      }
    >
      <div className="grid gap-4">
        <Field label="What">{(id) => <Input id={id} value={f.label} onChange={(e) => set({ label: e.target.value })} placeholder="e.g. Stretch, Journal, Walk the dog" />}</Field>
        <Field label="Time">
          {(id) => (
            <Input
              id={id}
              type="time"
              value={time}
              onChange={(e) => {
                const p = parseTime(e.target.value);
                set({ hour: p.hour, minute: p.minute });
              }}
            />
          )}
        </Field>
        <Field label="Kind">
          {(id) => (
            <Select id={id} value={f.category} onChange={(e) => set({ category: e.target.value as RoutineCategory })}>
              {ROUTINE_CATEGORIES.filter((c) => c !== 'medication').map((c) => (
                <option key={c} value={c}>
                  {CATEGORY_LABELS[c]}
                </option>
              ))}
            </Select>
          )}
        </Field>
        {f.category === 'meal' && (
          <Field label="Which meal">
            {(id) => (
              <Select id={id} value={f.mealType ?? 'snack'} onChange={(e) => set({ mealType: e.target.value as MealType })}>
                {(Object.keys(MEAL_LABELS) as MealType[]).map((m) => (
                  <option key={m} value={m}>
                    {MEAL_LABELS[m]}
                  </option>
                ))}
              </Select>
            )}
          </Field>
        )}
        <Toggle label="Remind me" checked={f.reminderEnabled} onChange={(v) => set({ reminderEnabled: v })} />
        <Toggle label="Optional" hint="Doesn’t count toward the day’s total unless you do it." checked={f.isOptional} onChange={(v) => set({ isOptional: v })} />
        <Toggle label="Essential" hint="Kept when “Essentials only” is on." checked={!!f.isEssential} onChange={(v) => set({ isEssential: v })} />
      </div>
    </Sheet>
  );
}

function RebuildSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const prefs = usePrefs();
  const [setup, setSetup] = useState<RoutineSetup>(DEFAULT_ROUTINE_SETUP);
  useEffect(() => {
    if (open) setSetup({ ...DEFAULT_ROUTINE_SETUP, wakeTime: prefs?.targetWakeTime ?? '07:00', bedTime: prefs?.targetBedtime ?? '22:30' });
  }, [open, prefs?.targetWakeTime, prefs?.targetBedtime]);
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Rebuild my routine"
      footer={
        <Button
          variant="primary"
          size="lg"
          block
          onClick={async () => {
            await replaceRoutineFromSetup(setup);
            onClose();
            toast('Your routine was rebuilt. Items you already finished today are kept.');
          }}
        >
          Rebuild routines
        </Button>
      }
    >
      <p className="mb-4 text-ink-2">This replaces your routines with a fresh “Everyday” and “Rest day” built from these times.</p>
      <RoutineSetupForm value={setup} onChange={setSetup} />
    </Sheet>
  );
}

/** Local state while typing; saves after a short pause so keystrokes are never lost. */
function NameInput({ id, initial, onCommit }: { id: string; initial: string; onCommit: (v: string) => void }) {
  const [v, setV] = useState(initial);
  useEffect(() => {
    if (v === initial) return;
    const timer = setTimeout(() => onCommit(v), 600);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [v]);
  return <Input id={id} value={v} onChange={(e) => setV(e.target.value)} onBlur={() => v !== initial && onCommit(v)} />;
}

/** Whether the routine is set to repeat every N days (even if N is still being typed). */
function isRepeatMode(t: RoutineTemplate): boolean {
  return t.repeatEveryDays != null;
}

type Update = (p: Partial<RoutineTemplate>) => Promise<void> | void;

/** "Use this routine": on certain weekdays, or every few days counting from a date (F-008). */
function RepeatFields({ t, update }: { t: RoutineTemplate; update: Update }) {
  const every = isRepeatMode(t);
  // keep what she types as text; save as soon as it is a usable number
  const [text, setText] = useState(String(t.repeatEveryDays ?? 6));
  const n = Number(text);
  const valid = Number.isInteger(n) && n >= 2 && n <= 60;
  const next = isRepeating(t) ? nextRepeatDates(t, todayKey(), 3) : [];
  return (
    <div className="grid gap-3">
      <Segmented<'weekdays' | 'every'>
        label="When to use this routine"
        value={every ? 'every' : 'weekdays'}
        onChange={async (v) => {
          const before = t;
          if (v === 'every') {
            setText('6');
            await update({ repeatEveryDays: 6, repeatStartDate: t.repeatStartDate ?? todayKey(), applicableDays: [] });
            toast('This routine now repeats every few days. Its weekdays were cleared.', async () => {
              await update(before);
            });
          } else {
            await update({ repeatEveryDays: null, repeatStartDate: null });
          }
        }}
        columns={2}
        options={[
          { value: 'weekdays', label: 'On certain weekdays' },
          { value: 'every', label: 'Every few days' },
        ]}
      />
      {every && (
        <div className="grid gap-3 rounded-xl border border-line p-3">
          <TextField
            label="Every how many days?"
            inputMode="numeric"
            value={text}
            onChange={(v) => {
              setText(v);
              const num = Number(v);
              if (Number.isInteger(num) && num >= 2 && num <= 60) void update({ repeatEveryDays: num });
            }}
            hint={valid || text === '' ? 'For example 6 for every sixth day.' : 'Use a whole number from 2 to 60.'}
            aria-invalid={!valid && text !== ''}
          />
          <TextField label="Starting on" type="date" value={t.repeatStartDate ?? ''} onChange={(v) => update({ repeatStartDate: v || todayKey() })} hint="This day, and then every few days after it." />
          {next.length > 0 && (
            <p>
              <strong>Next:</strong> {next.map((d) => formatDateLong(d)).join(' · ')}
            </p>
          )}
          <p className="text-sm text-ink-2">On those days this routine is used instead of your weekday one. A routine that repeats ignores the weekdays. To start from your usual day, use “New routine” to make a copy first.</p>
        </div>
      )}
    </div>
  );
}

const SHIFT_CHOICES = [15, 30, 45, 60, 90, 120];

/** On days this routine is used, medication times move later by an amount she chooses (F-008). */
function DoseShiftFields({ t, update }: { t: RoutineTemplate; update: Update }) {
  const shift = t.doseShiftMinutes ?? 0;
  const which = t.doseShiftWhich ?? 'all';
  return (
    <div className="grid gap-3">
      <Field label="Medication times on these days">
        {(id) => (
          <Select
            id={id}
            value={shift === 0 ? 'none' : which}
            onChange={(e) => {
              const v = e.target.value;
              if (v === 'none') void update({ doseShiftMinutes: 0 });
              else void update({ doseShiftWhich: v as 'all' | 'morning', doseShiftMinutes: shift || 60 });
            }}
          >
            <option value="none">Keep them as they are</option>
            <option value="morning">Move morning doses later</option>
            <option value="all">Move all doses later</option>
          </Select>
        )}
      </Field>
      {shift > 0 && (
        <Field label="How much later">
          {(id) => (
            <Select id={id} value={shift} onChange={(e) => update({ doseShiftMinutes: Number(e.target.value) })}>
              {SHIFT_CHOICES.map((m) => (
                <option key={m} value={m}>
                  {m % 60 === 0 ? `${m / 60} ${m === 60 ? 'hour' : 'hours'}` : `${m} minutes`} later
                </option>
              ))}
            </Select>
          )}
        </Field>
      )}
      <Disclaimer>
        Only use this if your doctor has agreed to it. Steady never suggests changing when you take your medication. It only follows the plan you set. Reminders and your record use the moved times, and a dose taken at the moved time counts as on time.
      </Disclaimer>
    </div>
  );
}
