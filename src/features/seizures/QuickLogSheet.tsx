import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AURA_SYMPTOMS, SEIZURE_TYPE_LABELS, SEVERITY_LABELS } from '../../core/defaults';
import { SEIZURE_TYPES, type SeizureType } from '../../core/types';
import { useSeizures } from '../../data/hooks';
import { deleteSeizure, logAura, newSeizure, saveSeizure } from '../../data/repo';
import { toast, useUI } from '../../state/ui';
import { Button, Chip, Field, Input, Rating, Segmented, Sheet } from '../../ui/kit';

type When = 'now' | '15' | '60' | 'custom';

function toLocalInput(d: Date) {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

/**
 * Workflow 1: log a seizure in under 10 seconds — FAB + Save = 2 taps.
 * Defaults are learned from the last event so confirming is usually enough.
 */
export function QuickLogSheet() {
  const open = useUI((s) => s.quickLogOpen);
  const setOpen = useUI((s) => s.setQuickLog);
  const setSuggest = useUI((s) => s.setSuggestSafeMode);
  const seizures = useSeizures();
  const nav = useNavigate();
  const last = seizures[0];

  const [mode, setMode] = useState<'seizure' | 'aura'>('seizure');
  const [type, setType] = useState<SeizureType>('focal_aware');
  const [severity, setSeverity] = useState<1 | 2 | 3 | 4 | 5>(3);
  const [when, setWhen] = useState<When>('now');
  const [custom, setCustom] = useState(toLocalInput(new Date()));
  const [aura, setAura] = useState<string[]>([]);

  useEffect(() => {
    if (!open) return;
    setMode('seizure');
    setType(last?.type ?? 'focal_aware');
    setSeverity(last?.severity ?? 3);
    setWhen('now');
    setCustom(toLocalInput(new Date()));
    setAura([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const timestamp = () => {
    const now = Date.now();
    if (when === '15') return new Date(now - 15 * 60000).toISOString();
    if (when === '60') return new Date(now - 60 * 60000).toISOString();
    if (when === 'custom') return new Date(custom).toISOString();
    return new Date(now).toISOString();
  };

  async function save(details: boolean) {
    const ev = newSeizure({ type, severity, timestamp: timestamp(), isQuickLog: !details });
    await saveSeizure(ev);
    setOpen(false);
    if (details) {
      nav(`/seizures/${ev.id}`);
    } else {
      toast('Seizure logged. Take all the time you need.', () => deleteSeizure(ev.id).then(() => undefined));
      setSuggest(true);
    }
  }

  async function saveAura() {
    const undo = await logAura(aura);
    setOpen(false);
    toast('Warning sign logged. Breathe slowly — you’re doing fine.', undo);
    nav('/rescue/calm');
  }

  return (
    <Sheet
      open={open}
      onClose={() => setOpen(false)}
      title={mode === 'seizure' ? 'Log a seizure' : 'Log a warning sign (aura)'}
      footer={
        mode === 'seizure' ? (
          <div className="grid grid-cols-[2fr_1fr] gap-2">
            <Button variant="primary" size="xl" onClick={() => save(false)}>
              Save
            </Button>
            <Button size="xl" onClick={() => save(true)}>
              Add details
            </Button>
          </div>
        ) : (
          <Button variant="primary" size="xl" block onClick={saveAura}>
            Save warning sign
          </Button>
        )
      }
    >
      {mode === 'seizure' ? (
        <div className="grid gap-5">
          <Segmented
            label="What kind?"
            value={type}
            onChange={setType}
            columns={2}
            options={SEIZURE_TYPES.map((t) => ({ value: t, label: SEIZURE_TYPE_LABELS[t].label }))}
          />
          <Rating
            label="How strong?"
            value={severity}
            onChange={setSeverity}
            low="1 · very mild"
            high="5 · severe"
            labels={SEVERITY_LABELS}
          />
          <div>
            <Segmented
              label="When?"
              value={when}
              onChange={setWhen}
              columns={4}
              options={[
                { value: 'now', label: 'Now' },
                { value: '15', label: '15 min ago' },
                { value: '60', label: '1 hr ago' },
                { value: 'custom', label: 'Other' },
              ]}
            />
            {when === 'custom' && (
              <div className="mt-3">
                <Field label="Date and time">
                  {(id) => (
                    <Input id={id} type="datetime-local" value={custom} max={toLocalInput(new Date())} onChange={(e) => setCustom(e.target.value)} />
                  )}
                </Field>
              </div>
            )}
          </div>
          <Button variant="ghost" onClick={() => setMode('aura')}>
            It was only a warning sign (aura) →
          </Button>
        </div>
      ) : (
        <div className="grid gap-4">
          <p className="text-ink-2">What did you notice? Pick any — or none, and just save.</p>
          <div className="flex flex-wrap gap-2">
            {AURA_SYMPTOMS.map((s) => (
              <Chip key={s.key} pressed={aura.includes(s.key)} onClick={() => setAura((a) => (a.includes(s.key) ? a.filter((x) => x !== s.key) : [...a, s.key]))}>
                {s.label}
              </Chip>
            ))}
          </div>
          <p className="text-ink-2">After saving, a calm breathing screen opens. If a seizure follows, use “Log seizure”.</p>
          <Button variant="ghost" onClick={() => setMode('seizure')}>
            ← Back to logging a seizure
          </Button>
        </div>
      )}
    </Sheet>
  );
}
