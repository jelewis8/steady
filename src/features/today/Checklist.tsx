import { useState } from 'react';
import { Check, Clock, Minus, MoreHorizontal, HelpCircle } from 'lucide-react';
import type { ChecklistEntry } from '../../core/checklist';
import { CATEGORY_LABELS } from '../../core/defaults';
import { formatClock, formatIsoClock, formatTimeKey, localDateTime, resolveDoneTime, todayKey } from '../../core/time';
import { usePrefs } from '../../data/hooks';
import {
  deleteChecklistItem,
  setChecklistNote,
  setChecklistStatus,
  setDoseNote,
  setDoseStatus,
} from '../../data/repo';
import { toast } from '../../state/ui';
import { Button, cx, Field, Input, Sheet, TextArea } from '../../ui/kit';
import { CategoryIcon } from '../../ui/icons';
import { BathroomSheet } from '../bathroom/BathroomSheet';
import { CheckInSheet } from './CheckInSheet';

const clock = (mins: number) => formatClock(Math.floor(mins / 60), mins % 60);

function statusText(e: ChecklistEntry): string {
  switch (e.status) {
    case 'done':
      return e.kind === 'dose' ? `Taken${e.completedAt ? ` at ${formatIsoClock(e.completedAt)}` : ''}` : `Done${e.completedAt ? ` ${formatIsoClock(e.completedAt)}` : ''}`;
    case 'skipped':
      return 'Skipped';
    case 'unsure':
      return 'Not sure';
    case 'deferred':
      return `Later · ${clock(e.minutes)}`;
    default:
      return e.overdue ? 'Still open' : 'To do';
  }
}

/** When a past-day item is recorded, it is recorded at the time it was scheduled for, not "now". */
function recordTime(entry: ChecklistEntry, date: string): Date | undefined {
  if (date === todayKey()) return undefined;
  return new Date(localDateTime(date, formatTimeKey(Math.floor(entry.scheduledMinutes / 60), entry.scheduledMinutes % 60)));
}

export function ChecklistRow({ entry, date }: { entry: ChecklistEntry; date: string }) {
  const past = date !== todayKey();
  const prefs = usePrefs();
  const [menu, setMenu] = useState(false);
  const [checkIn, setCheckIn] = useState(false);
  const [bathroom, setBathroom] = useState(false);
  const done = entry.status === 'done';
  const open = entry.status === 'pending' || entry.status === 'deferred';
  const name = `${entry.label}${entry.detail ? ` ${entry.detail}` : ''}`;

  async function toggle() {
    if (entry.kind === 'dose') {
      if (done) {
        const undo = await setDoseStatus(entry.id, 'pending');
        toast(`${entry.label} set back to not recorded.`, undo);
      } else {
        const at = recordTime(entry, date);
        const undo = await setDoseStatus(entry.id, 'taken', at);
        toast(at ? `${entry.label} recorded as taken.` : `${entry.label} recorded as taken at ${formatClock(new Date().getHours(), new Date().getMinutes())}.`, undo);
      }
      return;
    }
    if (!done && entry.category === 'bowel') {
      setBathroom(true);
      return;
    }
    if (!done && (entry.category === 'stress_check' || entry.category === 'mood')) {
      setCheckIn(true);
      return;
    }
    await setChecklistStatus(entry.id, done ? 'pending' : 'done', { glassMl: prefs?.glassSizeMl, at: recordTime(entry, date) });
  }

  const StatusIcon = done ? Check : entry.status === 'skipped' ? Minus : entry.status === 'unsure' ? HelpCircle : entry.status === 'deferred' ? Clock : null;

  return (
    <li
      className={cx(
        'flex items-center gap-2 rounded-2xl border-2 py-2 pr-1 pl-2',
        entry.overdue && open && !past ? 'border-attn-line bg-attn-bg' : 'border-line bg-surface',
        !open && 'opacity-90',
      )}
    >
      <button
        type="button"
        onClick={toggle}
        aria-pressed={done}
        aria-label={`${done ? 'Undo' : 'Mark'} ${name} at ${clock(entry.scheduledMinutes)} ${done ? '' : entry.kind === 'dose' ? 'as taken' : 'as done'}`.trim()}
        className={cx(
          'tap ease-calm flex shrink-0 items-center justify-center rounded-xl border-[3px]',
          done ? 'border-accent bg-accent text-accent-ink' : 'border-line-strong bg-surface text-ink-2 hover:border-accent',
        )}
      >
        {StatusIcon ? <StatusIcon aria-hidden size={28} strokeWidth={3} /> : <span aria-hidden className="h-6 w-6" />}
      </button>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2">
          <span className="font-bold tabular-nums">{clock(entry.minutes)}</span>
          <span className={cx('font-bold', entry.status === 'skipped' && 'line-through decoration-2')}>{entry.label}</span>
          {entry.detail && <span className="text-ink-2">{entry.detail}</span>}
        </div>
        <div className="flex flex-wrap items-center gap-x-3 text-sm text-ink-2">
          <span className="inline-flex items-center gap-1">
            <CategoryIcon category={entry.category} size={16} />
            {CATEGORY_LABELS[entry.category]}
            {entry.isOptional && ' · optional'}
          </span>
          <span className={cx(entry.overdue && open && !past && 'font-bold text-attn-ink')}>{past && open ? 'Not recorded yet' : statusText(entry)}</span>
          {entry.notes && <span className="italic">“{entry.notes}”</span>}
        </div>
      </div>
      <button
        type="button"
        onClick={() => setMenu(true)}
        aria-label={`More options for ${name}`}
        className="tap inline-flex shrink-0 items-center justify-center rounded-xl text-ink-2 hover:bg-surface-2"
      >
        <MoreHorizontal aria-hidden size={26} />
      </button>
      <EntryActions entry={entry} open={menu} onClose={() => setMenu(false)} date={date} />
      <CheckInSheet open={checkIn} onClose={() => setCheckIn(false)} date={date} />
      <BathroomSheet open={bathroom} onClose={() => setBathroom(false)} date={date} />
    </li>
  );
}

function EntryActions({ entry, open, onClose, date }: { entry: ChecklistEntry; open: boolean; onClose: () => void; date: string }) {
  const past = date !== todayKey();
  const prefs = usePrefs();
  const [note, setNote] = useState(entry.notes ?? '');
  const [earlier, setEarlier] = useState(formatTimeKey(Math.floor(entry.scheduledMinutes / 60), entry.scheduledMinutes % 60));

  const run = async (fn: () => Promise<unknown>, msg?: string) => {
    const undo = await fn();
    if (msg) toast(msg, typeof undo === 'function' ? (undo as () => Promise<void>) : undefined);
    onClose();
  };

  const saveNote = async () => {
    if (entry.kind === 'dose') await setDoseNote(entry.id, note);
    else await setChecklistNote(entry.id, note);
    onClose();
  };

  return (
    <Sheet open={open} onClose={onClose} title={`${entry.label}${entry.detail ? ` ${entry.detail}` : ''}`}>
      <p className="mb-4 text-ink-2">
        Scheduled for {clock(entry.scheduledMinutes)} · {statusText(entry)}
      </p>
      <div className="grid gap-2">
        {entry.kind === 'dose' ? (
          <>
            {past ? (
              <Button variant="primary" size="lg" block onClick={() => run(() => setDoseStatus(entry.id, 'taken', recordTime(entry, date)), `${entry.label} recorded as taken.`)}>
                I took it on time
              </Button>
            ) : (
              <Button variant="primary" size="lg" block onClick={() => run(() => setDoseStatus(entry.id, 'taken'), `${entry.label} recorded as taken.`)}>
                I took it just now
              </Button>
            )}
            <div className="flex items-end gap-2 rounded-xl border border-line p-3">
              <Field label="I took it earlier, at">
                {(id) => <Input id={id} type="time" value={earlier} onChange={(e) => setEarlier(e.target.value)} />}
              </Field>
              <Button
                onClick={() =>
                  run(
                    () => setDoseStatus(entry.id, 'taken', new Date(localDateTime(date, earlier))),
                    `${entry.label} recorded as taken at ${earlier}.`,
                  )
                }
              >
                Save
              </Button>
            </div>
            <Button size="lg" block onClick={() => run(() => setDoseStatus(entry.id, 'unsure'), 'Marked “not sure”. That’s okay — it’s noted.')}>
              I’m not sure if I took it
            </Button>
            <Button size="lg" block onClick={() => run(() => setDoseStatus(entry.id, 'skipped'), 'Dose marked as skipped.')}>
              I’m skipping this dose
            </Button>
            {entry.status !== 'pending' && (
              <Button variant="ghost" block onClick={() => run(() => setDoseStatus(entry.id, 'pending'), 'Dose set back to not recorded.')}>
                Clear what I recorded
              </Button>
            )}
            <p className="text-sm text-ink-2">
              Not sure what to do about a missed dose? Your pharmacist or neurologist can tell you — Steady doesn’t give dosing advice.
            </p>
          </>
        ) : (
          <>
            {entry.status !== 'done' && (
              <Button variant="primary" size="lg" block onClick={() => run(() => setChecklistStatus(entry.id, 'done', { glassMl: prefs?.glassSizeMl, at: recordTime(entry, date) }))}>
                Done
              </Button>
            )}
            <div className="flex items-end gap-2 rounded-xl border border-line p-3">
              <Field label="I did it earlier, at">
                {(id) => <Input id={id} type="time" value={earlier} onChange={(e) => setEarlier(e.target.value)} />}
              </Field>
              <Button
                disabled={!earlier}
                onClick={() => {
                  const at = resolveDoneTime(date, entry.scheduledMinutes, earlier);
                  if (at.getTime() > Date.now()) {
                    toast('That time hasn’t happened yet. Pick a time that has passed.');
                    return;
                  }
                  return run(() => setChecklistStatus(entry.id, 'done', { glassMl: prefs?.glassSizeMl, at }), `${entry.label} recorded at ${earlier}.`);
                }}
              >
                Save
              </Button>
            </div>
            {date === todayKey() && (
              <div className="grid grid-cols-2 gap-2">
                <Button size="lg" onClick={() => run(() => setChecklistStatus(entry.id, 'deferred', { deferMinutes: 30 }), 'Moved 30 minutes later.')}>
                  Later (30 min)
                </Button>
                <Button size="lg" onClick={() => run(() => setChecklistStatus(entry.id, 'deferred', { deferMinutes: 60 }), 'Moved an hour later.')}>
                  Later (1 hour)
                </Button>
              </div>
            )}
            <Button size="lg" block onClick={() => run(() => setChecklistStatus(entry.id, 'skipped'), 'Skipped for today. No problem.')}>
              Skip for today
            </Button>
            {entry.status !== 'pending' && (
              <Button variant="ghost" block onClick={() => run(() => setChecklistStatus(entry.id, 'pending'))}>
                Set back to “to do”
              </Button>
            )}
            {entry.key.startsWith('r:') && (
              <Button variant="ghost" block onClick={() => run(() => deleteChecklistItem(entry.id), 'Removed from today.')}>
                Remove from today only
              </Button>
            )}
          </>
        )}
        <div className="mt-2 rounded-xl border border-line p-3">
          <Field label={entry.kind === 'dose' ? 'Note or side effect' : 'Note'}>
            {(id) => <TextArea id={id} value={note} onChange={(e) => setNote(e.target.value)} className="min-h-20" />}
          </Field>
          <Button className="mt-2" onClick={saveNote}>
            Save note
          </Button>
        </div>
      </div>
    </Sheet>
  );
}
