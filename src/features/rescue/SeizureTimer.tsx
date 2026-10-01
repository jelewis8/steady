import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Phone, X } from 'lucide-react';
import { AURA_SYMPTOMS } from '../../core/defaults';
import { formatClock, formatDuration } from '../../core/time';
import { usePrefs, useRescueProtocol } from '../../data/hooks';
import { saveTimedAura, saveTimedSeizure } from '../../data/repo';
import { toast, useUI } from '../../state/ui';
import { Button, Chip } from '../../ui/kit';

const KEY = 'steady.seizureTimerStart';
/** How long the warning sign lasted, once it has turned into a seizure (seconds since the timer started). */
const AURA_KEY = 'steady.seizureTimerAuraSec';

function readNumber(key: string): number | null {
  try {
    const v = localStorage.getItem(key);
    return v ? Number(v) : null;
  } catch {
    return null;
  }
}

function writeNumber(key: string, value: number | null) {
  try {
    if (value == null) localStorage.removeItem(key);
    else localStorage.setItem(key, String(value));
  } catch {
    /* storage blocked: the timer still runs in memory */
  }
}

const readStart = () => readNumber(KEY);

export function startSeizureTimer() {
  if (!readStart()) writeNumber(KEY, Date.now());
  useUI.getState().setSeizureTimer(true);
}

type Kind = 'ask' | 'seizure' | 'aura';

/**
 * One timer for whatever is happening (F-005). It starts without anyone needing to know what it is. When it stops,
 * the person chooses: a seizure, or a warning sign (aura). If a warning sign turns into a seizure, one tap records
 * how long the warning lasted and the timer keeps going for the seizure. Survives reloads.
 * The clock changes once per second as plain text: nothing flashes or changes colour.
 */
export function SeizureTimer({ allowSave = true }: { allowSave?: boolean }) {
  const open = useUI((s) => s.seizureTimerOpen);
  const setOpen = useUI((s) => s.setSeizureTimer);
  const prefs = usePrefs();
  const plan = useRescueProtocol();
  const nav = useNavigate();
  const [start, setStart] = useState<number | null>(readStart);
  const [now, setNow] = useState(Date.now());
  const [stoppedAt, setStoppedAt] = useState<number | null>(null);
  const [showHelp, setShowHelp] = useState(false);
  const [auraSec, setAuraSec] = useState<number | null>(() => readNumber(AURA_KEY));
  const [kind, setKind] = useState<Kind>('ask');
  const [picked, setPicked] = useState<string[]>([]);

  useEffect(() => {
    if (readStart()) setOpen(true);
  }, [setOpen]);

  useEffect(() => {
    if (!open) return;
    const s = readStart() ?? Date.now();
    setStart(s);
    setAuraSec(readNumber(AURA_KEY));
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [open]);

  if (!open || !start) return null;

  const end = stoppedAt ?? now;
  const elapsed = Math.max(0, Math.floor((end - start) / 1000));
  const mm = Math.floor(elapsed / 60);
  const ss = elapsed % 60;
  const limit = prefs?.emergencyAfterMinutes ?? 5;
  const overLimit = elapsed >= limit * 60;
  const number = prefs?.emergencyNumber ?? '911';
  const startDate = new Date(start);
  const isSeizure = !allowSave || auraSec != null || kind === 'seizure';

  const reset = () => {
    writeNumber(KEY, null);
    writeNumber(AURA_KEY, null);
    setAuraSec(null);
    setKind('ask');
    setPicked([]);
    setStoppedAt(null);
    setOpen(false);
  };

  function markTurnedIntoSeizure() {
    // measured at the moment of the tap, not from the on-screen clock (which updates once a second)
    const seconds = Math.max(0, Math.floor(((stoppedAt ?? Date.now()) - start!) / 1000));
    setAuraSec(seconds);
    writeNumber(AURA_KEY, seconds);
  }

  async function saveSeizureToLog() {
    const id = await saveTimedSeizure({ start: new Date(start!), end: new Date(end), auraSeconds: auraSec });
    reset();
    nav(`/seizures/${id}`);
  }

  async function saveWarningSign() {
    const undo = await saveTimedAura({ start: new Date(start!), seconds: elapsed, symptoms: picked });
    reset();
    toast('Warning sign saved, with how long it lasted.', undo);
  }

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="timer-h" className="fixed inset-0 z-50 overflow-y-auto bg-bg">
      <div className="mx-auto flex min-h-full max-w-xl flex-col gap-4 p-4 pt-[max(1rem,env(safe-area-inset-top))]">
        <div className="flex items-center justify-between">
          <h1 id="timer-h" className="text-2xl font-bold">
            {auraSec != null ? 'Seizure timer' : 'Timer'}
          </h1>
          {stoppedAt && (
            <button type="button" aria-label="Close timer" className="tap inline-flex items-center justify-center rounded-xl" onClick={reset}>
              <X aria-hidden size={28} />
            </button>
          )}
        </div>

        <div className="rounded-3xl border-2 border-line bg-surface p-6 text-center">
          <div className="text-8xl font-bold tabular-nums" aria-hidden>
            {String(mm).padStart(2, '0')}:{String(ss).padStart(2, '0')}
          </div>
          <p className="sr-only" aria-live="polite">
            {mm} {mm === 1 ? 'minute' : 'minutes'} elapsed
          </p>
          <p className="mt-2 text-lg text-ink-2">Started at {formatClock(startDate.getHours(), startDate.getMinutes())}</p>
          {auraSec != null && <p className="mt-1 text-lg">It began with a warning sign that lasted {formatDuration(auraSec)}.</p>}
        </div>

        {overLimit && !stoppedAt && (
          <div role="alert" className="rounded-2xl border-4 border-attn-line bg-attn-bg p-4 text-attn-ink">
            <p className="text-xl font-bold">It has been {limit} minutes or more.</p>
            <p className="mt-1">{plan?.whenToCall911 ? 'The plan says to call emergency services now.' : 'Call emergency services now.'}</p>
          </div>
        )}

        <a
          href={`tel:${number}`}
          className="tap flex items-center justify-center gap-3 rounded-2xl border-2 border-sos bg-sos px-6 py-4 text-2xl font-bold text-sos-ink no-underline"
        >
          <Phone aria-hidden size={28} /> Call {number}
        </a>

        {plan?.rescueMedicationInstructions && (
          <section aria-labelledby="rm-h" className="rounded-2xl border-2 border-accent bg-accent-soft p-4">
            <h2 id="rm-h" className="font-bold">
              Rescue medication plan
            </h2>
            <p className="mt-1 text-lg whitespace-pre-line">{plan.rescueMedicationInstructions}</p>
          </section>
        )}

        {!stoppedAt && (
          <div className="grid gap-2">
            {allowSave && auraSec == null && (
              <Button size="lg" block onClick={markTurnedIntoSeizure}>
                It’s turning into a seizure
              </Button>
            )}
            <Button variant="primary" size="xl" block onClick={() => setStoppedAt(Date.now())}>
              It has stopped
            </Button>
          </div>
        )}

        {stoppedAt && !isSeizure && kind === 'ask' && (
          <section aria-labelledby="what-h" className="rounded-2xl border-2 border-line bg-surface p-4">
            <h2 id="what-h" className="text-xl font-bold">
              It lasted about {formatDuration(elapsed)}. What was it?
            </h2>
            <div className="mt-3 grid gap-2">
              <Button variant="primary" size="lg" block onClick={() => setKind('seizure')}>
                A seizure
              </Button>
              <Button size="lg" block onClick={() => setKind('aura')}>
                A warning sign (aura) only
              </Button>
              <Button size="lg" block onClick={() => setStoppedAt(null)}>
                It started again — keep timing
              </Button>
              <Button variant="ghost" block onClick={reset}>
                Close without saving
              </Button>
            </div>
          </section>
        )}

        {stoppedAt && isSeizure && (
          <section aria-labelledby="done-h" className="rounded-2xl border-2 border-line bg-surface p-4">
            <h2 id="done-h" className="text-xl font-bold">
              It lasted about {formatDuration(elapsed)}
            </h2>
            <p className="mt-1">Stay with them. Turn them on their side if they’re drowsy. Confusion afterwards is common — speak calmly.</p>
            <div className="mt-3 grid gap-2">
              {allowSave && (
                <Button variant="primary" size="lg" block onClick={saveSeizureToLog}>
                  Save to seizure log
                </Button>
              )}
              <Button size="lg" block onClick={() => setStoppedAt(null)}>
                It started again — keep timing
              </Button>
              {allowSave && auraSec == null && (
                <Button size="lg" block onClick={() => setKind('ask')}>
                  It wasn’t a seizure
                </Button>
              )}
              <Button variant="ghost" block onClick={reset}>
                Close without saving
              </Button>
            </div>
          </section>
        )}

        {stoppedAt && !isSeizure && kind === 'aura' && (
          <section aria-labelledby="aura-h" className="rounded-2xl border-2 border-line bg-surface p-4">
            <h2 id="aura-h" className="text-xl font-bold">
              A warning sign that lasted {formatDuration(elapsed)}
            </h2>
            <p className="mt-1 text-ink-2">Anything you noticed? You can skip this.</p>
            <div role="group" aria-label="What you noticed" className="mt-2 flex flex-wrap gap-2">
              {AURA_SYMPTOMS.map((a) => (
                <Chip key={a.key} pressed={picked.includes(a.key)} onClick={() => setPicked((p) => (p.includes(a.key) ? p.filter((x) => x !== a.key) : [...p, a.key]))}>
                  {a.label}
                </Chip>
              ))}
            </div>
            <div className="mt-3 grid gap-2">
              <Button variant="primary" size="lg" block onClick={saveWarningSign}>
                Save warning sign
              </Button>
              <Button
                size="lg"
                block
                onClick={() => {
                  // it turned into a seizure after all: the warning lasted until now, and timing carries on
                  markTurnedIntoSeizure();
                  setKind('ask');
                  setStoppedAt(null);
                }}
              >
                It turned into a seizure after all
              </Button>
              <Button variant="ghost" block onClick={() => setKind('ask')}>
                Back
              </Button>
            </div>
          </section>
        )}

        <Button variant="quiet" block aria-expanded={showHelp} onClick={() => setShowHelp((v) => !v)}>
          {showHelp ? 'Hide' : 'Show'} how to help
        </Button>
        {showHelp && (
          <section className="rounded-2xl border-2 border-line bg-surface p-4">
            <p className="text-lg whitespace-pre-line">
              {plan?.howToHelp ||
                'Stay calm and stay with them. Time the seizure. Move hard objects away. Do not hold them down or put anything in their mouth. Turn them on their side when jerking stops.'}
            </p>
            {plan?.whenToCall911 && (
              <>
                <h3 className="mt-3 font-bold">When to call for help</h3>
                <p className="whitespace-pre-line">{plan.whenToCall911}</p>
              </>
            )}
          </section>
        )}
      </div>
    </div>
  );
}
