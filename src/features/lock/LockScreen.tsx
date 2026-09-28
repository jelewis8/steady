import { useEffect, useRef, useState } from 'react';
import { LifeBuoy, Phone, Timer } from 'lucide-react';
import type { UserPreferences } from '../../core/types';
import { useContacts, usePrefs, useProfile, useRescueProtocol } from '../../data/hooks';
import { useUI } from '../../state/ui';
import { Button, Field, Input } from '../../ui/kit';
import { SeizureTimer, startSeizureTimer } from '../rescue/SeizureTimer';
import { telHref } from '../rescue/sms';
import { PinPad } from './PinPad';
import { clearPasscode, verifyPin, verifyRecovery } from './passcode';

let bootLocked = false;

/** Lock on launch and after inactivity (blueprint §2.6 Access Control). */
export function useAutoLock(prefs: UserPreferences | undefined) {
  const setLocked = useUI((s) => s.setLocked);
  const last = useRef(Date.now());
  const enabled = !!prefs?.passcodeEnabled;
  const minutes = prefs?.autoLockMinutes ?? 5;

  useEffect(() => {
    if (enabled && !bootLocked) {
      bootLocked = true;
      setLocked(true);
    }
  }, [enabled, setLocked]);

  useEffect(() => {
    if (!enabled) return;
    const touch = () => (last.current = Date.now());
    const check = () => {
      if (Date.now() - last.current > minutes * 60_000) setLocked(true);
    };
    const onVis = () => (document.hidden ? touch() : check());
    window.addEventListener('pointerdown', touch);
    window.addEventListener('keydown', touch);
    document.addEventListener('visibilitychange', onVis);
    const id = setInterval(check, 15_000);
    return () => {
      window.removeEventListener('pointerdown', touch);
      window.removeEventListener('keydown', touch);
      document.removeEventListener('visibilitychange', onVis);
      clearInterval(id);
    };
  }, [enabled, minutes, setLocked]);
}

export function LockScreen() {
  const setLocked = useUI((s) => s.setLocked);
  const prefs = usePrefs();
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [view, setView] = useState<'pin' | 'emergency' | 'recover'>('pin');

  async function submit() {
    if (busy) return;
    setBusy(true);
    const ok = await verifyPin(pin);
    setBusy(false);
    if (ok) setLocked(false);
    else {
      setError('That passcode didn’t match. Take your time and try again.');
      setPin('');
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-6 p-6 pt-[max(2rem,env(safe-area-inset-top))]">
      <div className="text-center">
        <img src="/favicon.svg" alt="" width={56} height={56} className="mx-auto rounded-2xl" />
        <h1 className="mt-3 text-2xl font-bold">Steady is locked</h1>
      </div>

      {view === 'pin' && (
        <>
          <PinPad label="Passcode" value={pin} onChange={(v) => { setPin(v); setError(null); }} onSubmit={submit} />
          <p role="alert" className="min-h-6 text-center font-bold">
            {busy ? 'Checking…' : error}
          </p>
          <div className="grid gap-2">
            {prefs?.emergencyInfoOnLockScreen !== false && (
              <Button variant="sos" size="lg" icon={<LifeBuoy aria-hidden size={22} />} onClick={() => setView('emergency')}>
                Emergency info
              </Button>
            )}
            <Button variant="ghost" onClick={() => setView('recover')}>
              Forgot passcode?
            </Button>
          </div>
        </>
      )}
      {view === 'emergency' && <EmergencyInfo onBack={() => setView('pin')} />}
      {view === 'recover' && <Recover onBack={() => setView('pin')} onDone={() => setLocked(false)} />}
      <SeizureTimer allowSave={false} />
    </main>
  );
}

/** Caregiver view — works without unlocking (Module 6 caregiver story). */
function EmergencyInfo({ onBack }: { onBack: () => void }) {
  const plan = useRescueProtocol();
  const contacts = useContacts().filter((c) => c.canViewRescueProtocol);
  const prefs = usePrefs();
  const profile = useProfile();
  const number = prefs?.emergencyNumber ?? '911';
  return (
    <section aria-labelledby="ei-h" className="grid gap-4">
      <h2 id="ei-h" className="text-xl font-bold">
        Emergency information{profile?.displayName ? ` for ${profile.displayName}` : ''}
      </h2>
      <Button variant="primary" size="xl" icon={<Timer aria-hidden size={26} />} onClick={startSeizureTimer}>
        Start seizure timer
      </Button>
      <a href={`tel:${number}`} className="tap flex items-center justify-center gap-2 rounded-2xl border-2 border-sos bg-sos px-6 py-4 text-xl font-bold text-sos-ink no-underline">
        <Phone aria-hidden size={24} /> Call {number}
      </a>
      {plan?.seizureDescription && (
        <div>
          <h3 className="font-bold">What their seizures look like</h3>
          <p className="whitespace-pre-line">{plan.seizureDescription}</p>
        </div>
      )}
      {plan?.howToHelp && (
        <div>
          <h3 className="font-bold">How to help</h3>
          <p className="whitespace-pre-line">{plan.howToHelp}</p>
        </div>
      )}
      {plan?.rescueMedicationInstructions && (
        <div>
          <h3 className="font-bold">Rescue medication</h3>
          <p className="whitespace-pre-line">{plan.rescueMedicationInstructions}</p>
        </div>
      )}
      {plan?.whenToCall911 && (
        <div>
          <h3 className="font-bold">When to call for help</h3>
          <p className="whitespace-pre-line">{plan.whenToCall911}</p>
        </div>
      )}
      {plan && plan.allergies.length > 0 && (
        <p>
          <strong>Allergies:</strong> {plan.allergies.join(', ')}
        </p>
      )}
      {contacts.length > 0 && (
        <ul className="grid gap-2">
          {contacts.map((c) => (
            <li key={c.id}>
              <a href={telHref(c.phone)} className="tap flex items-center justify-between rounded-xl border-2 border-line-strong bg-surface px-4 py-2 no-underline">
                <span>
                  <strong>{c.name}</strong> {c.relationship && <span className="text-ink-2">({c.relationship})</span>}
                </span>
                <span className="inline-flex items-center gap-1 font-bold">
                  <Phone aria-hidden size={18} /> Call
                </span>
              </a>
            </li>
          ))}
        </ul>
      )}
      <Button onClick={onBack}>Back</Button>
    </section>
  );
}

function Recover({ onBack, onDone }: { onBack: () => void; onDone: () => void }) {
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  return (
    <form
      className="grid gap-4"
      onSubmit={async (e) => {
        e.preventDefault();
        if (await verifyRecovery(code)) {
          await clearPasscode();
          onDone();
        } else setError('That recovery code didn’t match.');
      }}
    >
      <p>Enter the recovery code you saved when you set up the passcode. The passcode will be turned off, and you can set a new one.</p>
      <Field label="Recovery code">
        {(id) => <Input id={id} value={code} onChange={(e) => setCode(e.target.value)} autoComplete="off" autoCapitalize="characters" placeholder="XXXX-XXXX-XXXX" />}
      </Field>
      {error && <p role="alert" className="font-bold">{error}</p>}
      <Button type="submit" variant="primary" size="lg">
        Unlock with recovery code
      </Button>
      <p className="text-sm text-ink-2">
        No recovery code? Steady can’t get around the passcode — that’s what keeps it private. You can erase Steady’s data in your browser’s site
        settings and restore from a backup.
      </p>
      <Button onClick={onBack}>Back</Button>
    </form>
  );
}
