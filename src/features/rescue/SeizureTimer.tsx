import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Phone, X } from 'lucide-react';
import { formatClock, formatDuration } from '../../core/time';
import { usePrefs, useRescueProtocol } from '../../data/hooks';
import { newSeizure, saveSeizure } from '../../data/repo';
import { useUI } from '../../state/ui';
import { Button } from '../../ui/kit';

const KEY = 'steady.seizureTimerStart';

function readStart(): number | null {
  try {
    const v = localStorage.getItem(KEY);
    return v ? Number(v) : null;
  } catch {
    return null;
  }
}

export function startSeizureTimer() {
  try {
    if (!readStart()) localStorage.setItem(KEY, String(Date.now()));
  } catch {
    /* storage blocked — timer still runs in memory */
  }
  useUI.getState().setSeizureTimer(true);
}

/**
 * Full-screen seizure timer for whoever is with the person. Survives reloads.
 * The clock changes once per second as plain text — nothing flashes or changes colour.
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

  useEffect(() => {
    if (readStart()) setOpen(true);
  }, [setOpen]);

  useEffect(() => {
    if (!open) return;
    const s = readStart() ?? Date.now();
    setStart(s);
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

  const reset = () => {
    try {
      localStorage.removeItem(KEY);
    } catch {
      /* ignore */
    }
    setStoppedAt(null);
    setOpen(false);
  };

  async function saveToLog() {
    const ev = newSeizure({
      timestamp: new Date(start!).toISOString(),
      endTimestamp: new Date(end).toISOString(),
      durationSeconds: elapsed,
      observerPresent: true,
      type: 'unknown',
      severity: 3,
      isQuickLog: true,
    });
    await saveSeizure(ev);
    reset();
    nav(`/seizures/${ev.id}`);
  }

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="timer-h" className="fixed inset-0 z-50 overflow-y-auto bg-bg">
      <div className="mx-auto flex min-h-full max-w-xl flex-col gap-4 p-4 pt-[max(1rem,env(safe-area-inset-top))]">
        <div className="flex items-center justify-between">
          <h1 id="timer-h" className="text-2xl font-bold">
            Seizure timer
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

        {!stoppedAt ? (
          <Button variant="primary" size="xl" block onClick={() => setStoppedAt(Date.now())}>
            The seizure has stopped
          </Button>
        ) : (
          <section aria-labelledby="done-h" className="rounded-2xl border-2 border-line bg-surface p-4">
            <h2 id="done-h" className="text-xl font-bold">
              It lasted about {formatDuration(elapsed)}
            </h2>
            <p className="mt-1">Stay with them. Turn them on their side if they’re drowsy. Confusion afterwards is common — speak calmly.</p>
            <div className="mt-3 grid gap-2">
              {allowSave && (
                <Button variant="primary" size="lg" block onClick={saveToLog}>
                  Save to seizure log
                </Button>
              )}
              <Button size="lg" block onClick={() => setStoppedAt(null)}>
                It started again — keep timing
              </Button>
              <Button variant="ghost" block onClick={reset}>
                Close without saving
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
