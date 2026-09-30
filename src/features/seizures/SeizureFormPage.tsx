import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Plus, Trash2 } from 'lucide-react';
import { ACTIVITIES, AURA_SYMPTOMS, LOCATIONS, POST_ICTAL_SYMPTOMS, SEIZURE_TYPE_LABELS, SEVERITY_LABELS } from '../../core/defaults';
import { uuid } from '../../core/ids';
import { localDateTime, todayKey } from '../../core/time';
import { SEIZURE_TYPES, type SeizureEvent } from '../../core/types';
import { db, getMeta, setMeta } from '../../data/db';
import { useSeizures, useTriggerTags } from '../../data/hooks';
import { addTriggerTag, deleteSeizure, newSeizure, saveSeizure } from '../../data/repo';
import { toast } from '../../state/ui';
import { Button, Card, Chip, Field, Input, PageHeader, Rating, Segmented, TextArea, Disclaimer } from '../../ui/kit';
import { VoiceNote } from './VoiceNote';

const DRAFT_KEY = 'draft.seizure';

function toLocalInput(iso: string) {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

type Draft = { ev: SeizureEvent; aura: string[] };

/** Full event capture (blueprint Screen 2). Only type and severity are needed; everything else is optional. */
export function SeizureFormPage() {
  const { id } = useParams();
  const isNew = id === 'new';
  const nav = useNavigate();
  const [params] = useSearchParams();
  // coming from a past day: start the time at noon on that day (she can change it)
  const forDate = /^\d{4}-\d{2}-\d{2}$/.test(params.get('date') ?? '') && (params.get('date') as string) < todayKey() ? (params.get('date') as string) : null;
  const [draft, setDraft] = useState<Draft | null>(null);
  const [customTrigger, setCustomTrigger] = useState('');
  const tags = useTriggerTags();
  const history = useSeizures();
  const loaded = useRef(false);
  const initial = useRef('');

  // Load an existing event, or restore an unfinished draft.
  useEffect(() => {
    (async () => {
      if (isNew) {
        const saved = await getMeta<Draft>(DRAFT_KEY);
        const d = saved ?? { ev: newSeizure({ id: uuid(), type: 'focal_aware', severity: 3 }), aura: [] };
        if (forDate) d.ev = { ...d.ev, timestamp: localDateTime(forDate, '12:00') };
        initial.current = JSON.stringify(d);
        setDraft(d);
      } else if (id) {
        const ev = await db.seizureEvents.get(id);
        if (!ev) return nav('/seizures', { replace: true });
        const auras = ev.auraIds.length ? await db.auraLogs.bulkGet(ev.auraIds) : [];
        const d = { ev, aura: auras.flatMap((a) => a?.symptoms ?? []) };
        initial.current = JSON.stringify(d);
        setDraft(d);
      }
      loaded.current = true;
    })();
  }, [id, isNew, nav, forDate]);

  // Auto-save every change: drafts for new events, straight to the log for existing ones.
  useEffect(() => {
    if (!draft || !loaded.current || JSON.stringify(draft) === initial.current) return;
    const t = setTimeout(() => {
      if (isNew) void setMeta(DRAFT_KEY, draft);
      else void saveSeizure({ ...draft.ev, isQuickLog: false }, draft.aura);
    }, 500);
    return () => clearTimeout(t);
  }, [draft, isNew]);

  const sortedTags = useMemo(() => {
    const counts = new Map<string, number>();
    for (const s of history) for (const t of s.triggerTagIds) counts.set(t, (counts.get(t) ?? 0) + 1);
    return [...tags].sort((a, b) => (counts.get(b.id) ?? 0) - (counts.get(a.id) ?? 0) || Number(b.isBuiltIn) - Number(a.isBuiltIn));
  }, [tags, history]);

  if (!draft) return <p className="text-ink-2">Loading…</p>;
  const ev = draft.ev;
  const set = (patch: Partial<SeizureEvent>) => setDraft((d) => (d ? { ...d, ev: { ...d.ev, ...patch } } : d));
  const toggle = (list: string[], key: string) => (list.includes(key) ? list.filter((x) => x !== key) : [...list, key]);
  const mins = ev.durationSeconds != null ? Math.floor(ev.durationSeconds / 60) : '';
  const secs = ev.durationSeconds != null ? ev.durationSeconds % 60 : '';
  const setDuration = (m: string, s: string) => {
    const mm = Number(m) || 0;
    const ss = Number(s) || 0;
    set({ durationSeconds: m === '' && s === '' ? null : Math.max(0, mm * 60 + ss) });
  };

  async function finish() {
    if (!draft) return;
    await saveSeizure({ ...draft.ev, isQuickLog: false }, draft.aura);
    if (isNew) await db.meta.delete(DRAFT_KEY);
    toast(isNew ? 'Seizure saved to your log.' : 'Changes saved.');
    nav(isNew ? (forDate ? `/day/${forDate}` : '/') : '/seizures');
  }

  async function discard() {
    if (isNew) {
      await db.meta.delete(DRAFT_KEY);
      await db.voiceNotes.where('seizureEventId').equals(ev.id).delete();
      nav(-1);
    } else {
      const undo = await deleteSeizure(ev.id);
      toast('Seizure deleted.', undo);
      nav('/seizures');
    }
  }

  return (
    <div className="grid gap-4 pb-8">
      <PageHeader
        title={isNew ? 'Log a seizure' : 'Seizure details'}
        back
        subtitle={isNew ? 'Only type and strength are needed. Your answers are saved as you go.' : 'Changes save automatically.'}
      />

      <Card labelledBy="when-h">
        <h2 id="when-h" className="mb-3 text-lg font-bold">
          When
        </h2>
        <div className="grid gap-4">
          <Field label="Started">
            {(fid) => (
              <Input
                id={fid}
                type="datetime-local"
                value={toLocalInput(ev.timestamp)}
                max={toLocalInput(new Date().toISOString())}
                onChange={(e) => e.target.value && set({ timestamp: new Date(e.target.value).toISOString() })}
              />
            )}
          </Field>
          <fieldset>
            <legend className="mb-1.5 font-bold">How long did it last? (best guess)</legend>
            <div className="flex items-center gap-2">
              <Input aria-label="Minutes" type="number" inputMode="numeric" min={0} className="w-24" value={mins} onChange={(e) => setDuration(e.target.value, String(secs))} />
              <span>min</span>
              <Input aria-label="Seconds" type="number" inputMode="numeric" min={0} max={59} className="w-24" value={secs} onChange={(e) => setDuration(String(mins), e.target.value)} />
              <span>sec</span>
            </div>
          </fieldset>
        </div>
      </Card>

      <Card>
        <Segmented
          label="Type"
          value={ev.type}
          onChange={(type) => set({ type })}
          columns={1}
          options={SEIZURE_TYPES.map((t) => ({ value: t, label: SEIZURE_TYPE_LABELS[t].label, hint: SEIZURE_TYPE_LABELS[t].hint }))}
        />
      </Card>

      <Card>
        <Rating label="How strong?" value={ev.severity} onChange={(severity) => set({ severity })} low="1 · very mild" high="5 · severe" labels={SEVERITY_LABELS} />
      </Card>

      <Card labelledBy="aura-h">
        <h2 id="aura-h" className="mb-1 text-lg font-bold">
          Warning signs before it (aura)
        </h2>
        <p className="mb-3 text-ink-2">Pick any you remember.</p>
        <div className="flex flex-wrap gap-2">
          {AURA_SYMPTOMS.map((s) => (
            <Chip key={s.key} pressed={draft.aura.includes(s.key)} onClick={() => setDraft({ ...draft, aura: toggle(draft.aura, s.key) })}>
              {s.label}
            </Chip>
          ))}
        </div>
      </Card>

      <Card labelledBy="trig-h">
        <h2 id="trig-h" className="mb-1 text-lg font-bold">
          Possible triggers
        </h2>
        <p className="mb-3 text-ink-2">Your best guess is useful. Most-used first.</p>
        <div className="flex flex-wrap gap-2">
          {sortedTags.map((t) => (
            <Chip key={t.id} pressed={ev.triggerTagIds.includes(t.id)} onClick={() => set({ triggerTagIds: toggle(ev.triggerTagIds, t.id) })}>
              {t.label}
            </Chip>
          ))}
        </div>
        <form
          className="mt-3 flex gap-2"
          onSubmit={async (e) => {
            e.preventDefault();
            if (!customTrigger.trim()) return;
            const tag = await addTriggerTag(customTrigger);
            set({ triggerTagIds: [...new Set([...ev.triggerTagIds, tag.id])] });
            setCustomTrigger('');
          }}
        >
          <Input aria-label="Add your own trigger" placeholder="Add your own…" value={customTrigger} onChange={(e) => setCustomTrigger(e.target.value)} />
          <Button type="submit" icon={<Plus aria-hidden size={20} />}>
            Add
          </Button>
        </form>
      </Card>

      <Card labelledBy="note-h">
        <h2 id="note-h" className="mb-3 text-lg font-bold">
          Notes
        </h2>
        <div className="grid gap-4">
          <VoiceNote
            noteId={ev.voiceNoteUri?.replace('voicenote:', '') ?? null}
            seizureId={ev.id}
            onChange={(nid) => set({ voiceNoteUri: nid ? `voicenote:${nid}` : null })}
          />
          <Field label="Written note">{(fid) => <TextArea id={fid} value={ev.notes ?? ''} onChange={(e) => set({ notes: e.target.value || null })} />}</Field>
        </div>
      </Card>

      <Card labelledBy="after-h">
        <h2 id="after-h" className="mb-3 text-lg font-bold">
          Afterwards I had…
        </h2>
        <div className="flex flex-wrap gap-2">
          {POST_ICTAL_SYMPTOMS.map((s) => (
            <Chip key={s.key} pressed={ev.postIctalSymptoms.includes(s.key)} onClick={() => set({ postIctalSymptoms: toggle(ev.postIctalSymptoms, s.key) })}>
              {s.label}
            </Chip>
          ))}
        </div>
      </Card>

      <Card labelledBy="where-h">
        <h2 id="where-h" className="mb-3 text-lg font-bold">
          Where and what I was doing
        </h2>
        <div className="flex flex-wrap gap-2">
          {LOCATIONS.map((l) => (
            <Chip key={l} pressed={ev.location === l} onClick={() => set({ location: ev.location === l ? null : l })}>
              {l}
            </Chip>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {ACTIVITIES.map((a) => (
            <Chip key={a} pressed={ev.activityAtOnset === a} onClick={() => set({ activityAtOnset: ev.activityAtOnset === a ? null : a })}>
              {a}
            </Chip>
          ))}
        </div>
      </Card>

      <Card>
        <div className="grid gap-4">
          <Segmented
            label="Was someone with you?"
            value={ev.observerPresent == null ? 'unknown' : ev.observerPresent ? 'yes' : 'no'}
            onChange={(v) => set({ observerPresent: v === 'unknown' ? null : v === 'yes' })}
            options={[
              { value: 'yes', label: 'Yes' },
              { value: 'no', label: 'No' },
              { value: 'unknown', label: 'Not sure' },
            ]}
          />
          {ev.observerPresent && (
            <Field label="What they saw" hint="A caregiver or friend can type this.">
              {(fid, d) => <TextArea id={fid} aria-describedby={d} value={ev.observerNotes ?? ''} onChange={(e) => set({ observerNotes: e.target.value || null })} />}
            </Field>
          )}
          <Segmented
            label="Was rescue medication used?"
            value={ev.rescueMedicationUsed ? 'yes' : 'no'}
            onChange={(v) => set({ rescueMedicationUsed: v === 'yes' })}
            options={[
              { value: 'yes', label: 'Yes' },
              { value: 'no', label: 'No' },
            ]}
          />
          {ev.rescueMedicationUsed && (
            <Field label="Which one and when?">
              {(fid) => <Input id={fid} value={ev.rescueMedicationDetails ?? ''} onChange={(e) => set({ rescueMedicationDetails: e.target.value || null })} />}
            </Field>
          )}
        </div>
      </Card>

      <div className="grid gap-2">
        <Button variant="primary" size="xl" block onClick={finish}>
          {isNew ? 'Save seizure' : 'Done'}
        </Button>
        <Button variant="ghost" block icon={<Trash2 aria-hidden size={20} />} onClick={discard}>
          {isNew ? 'Discard this entry' : 'Delete this seizure'}
        </Button>
      </div>
      <Disclaimer>
        This log is for you and your care team. Self-reported logs can miss seizures where awareness was lost — observer notes help.
      </Disclaimer>
    </div>
  );
}
