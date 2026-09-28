import { useState } from 'react';
import { usePrefs } from '../../data/hooks';
import { updatePreferences } from '../../data/repo';
import { toast, useUI } from '../../state/ui';
import { Button, Card, CardTitle, Field, PageHeader, Select, Toggle } from '../../ui/kit';
import { PinPad } from './PinPad';
import { changePin, clearPasscode, generateRecoveryCode, setPasscode, verifyPin } from './passcode';

type Step = { kind: 'idle' } | { kind: 'enter'; purpose: 'new' | 'change' | 'off' | 'verify-change' } | { kind: 'confirm'; purpose: 'new' | 'change'; first: string } | { kind: 'recovery'; code: string; pin: string };

export function PasscodePage() {
  const prefs = usePrefs();
  const setLocked = useUI((s) => s.setLocked);
  const [step, setStep] = useState<Step>({ kind: 'idle' });
  const [pin, setPin] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const enabled = !!prefs?.passcodeEnabled;

  async function submit() {
    const value = pin;
    setPin('');
    setMsg(null);
    if (step.kind === 'enter') {
      if (step.purpose === 'new' || step.purpose === 'change') return setStep({ kind: 'confirm', purpose: step.purpose, first: value });
      const ok = await verifyPin(value);
      if (!ok) return setMsg('That’s not your current passcode.');
      if (step.purpose === 'off') {
        await clearPasscode();
        setStep({ kind: 'idle' });
        toast('Passcode turned off.');
      } else setStep({ kind: 'enter', purpose: 'change' });
    } else if (step.kind === 'confirm') {
      if (value !== step.first) {
        setMsg('Those didn’t match. Let’s start again.');
        return setStep({ kind: 'enter', purpose: step.purpose });
      }
      if (step.purpose === 'change') {
        await changePin(value);
        setStep({ kind: 'idle' });
        toast('Passcode changed.');
      } else setStep({ kind: 'recovery', code: generateRecoveryCode(), pin: value });
    }
  }

  const title =
    step.kind === 'enter'
      ? step.purpose === 'new' || step.purpose === 'change'
        ? 'Choose a passcode (4–8 digits)'
        : 'Enter your current passcode'
      : step.kind === 'confirm'
        ? 'Type it again'
        : '';

  return (
    <div className="grid gap-4 pb-6">
      <PageHeader title="Passcode lock" back="/more" subtitle="Keeps Steady private if someone else picks up your device." />

      {step.kind === 'idle' && (
        <Card>
          <p className="mb-4">
            Passcode is <strong>{enabled ? 'on' : 'off'}</strong>.
          </p>
          {!enabled ? (
            <Button variant="primary" size="lg" onClick={() => setStep({ kind: 'enter', purpose: 'new' })}>
              Set up a passcode
            </Button>
          ) : (
            <div className="grid gap-4">
              <Field label="Lock after I’ve been away for">
                {(id) => (
                  <Select id={id} value={prefs?.autoLockMinutes ?? 5} onChange={(e) => updatePreferences({ autoLockMinutes: Number(e.target.value) })}>
                    {[1, 5, 15, 30, 60].map((m) => (
                      <option key={m} value={m}>
                        {m} {m === 1 ? 'minute' : 'minutes'}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
              <Toggle
                label="Show emergency info on the lock screen"
                hint="Lets someone helping you see your action plan and call your contacts without unlocking."
                checked={prefs?.emergencyInfoOnLockScreen !== false}
                onChange={(v) => updatePreferences({ emergencyInfoOnLockScreen: v })}
              />
              <div className="flex flex-wrap gap-2">
                <Button variant="primary" onClick={() => setLocked(true)}>
                  Lock now
                </Button>
                <Button onClick={() => setStep({ kind: 'enter', purpose: 'verify-change' })}>Change passcode</Button>
                <Button variant="ghost" onClick={() => setStep({ kind: 'enter', purpose: 'off' })}>
                  Turn off
                </Button>
              </div>
            </div>
          )}
          <p className="mt-4 text-sm text-ink-2">
            The passcode is stored only as a salted hash. It locks the app screen; your device’s own screen lock and encryption protect the stored
            data. Think about whether a passcode could slow you down after a seizure — the emergency info stays available either way.
          </p>
        </Card>
      )}

      {(step.kind === 'enter' || step.kind === 'confirm') && (
        <Card labelledBy="pin-h">
          <CardTitle id="pin-h">{title}</CardTitle>
          <PinPad label={title} value={pin} onChange={setPin} onSubmit={submit} />
          <p role="alert" className="mt-3 min-h-6 text-center font-bold">
            {msg}
          </p>
          <Button variant="ghost" block onClick={() => { setStep({ kind: 'idle' }); setPin(''); setMsg(null); }}>
            Cancel
          </Button>
        </Card>
      )}

      {step.kind === 'recovery' && (
        <Card labelledBy="rc-h" tone="accent">
          <CardTitle id="rc-h">Save your recovery code</CardTitle>
          <p>If you forget your passcode, this code is the only way back in. Write it down and keep it somewhere safe.</p>
          <p className="my-4 text-center font-mono text-3xl font-bold tracking-widest select-all">{step.code}</p>
          <Button
            variant="primary"
            size="lg"
            block
            onClick={async () => {
              await setPasscode(step.pin, step.code);
              setStep({ kind: 'idle' });
              toast('Passcode is on.');
            }}
          >
            I’ve saved it — turn on passcode
          </Button>
        </Card>
      )}
    </div>
  );
}
