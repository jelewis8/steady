import { useState } from 'react';
import { Link } from 'react-router-dom';
import { HandHeart, HeartHandshake, MapPin, MessageSquare, Phone, ShieldCheck, Timer, Wind, FileText, UserPlus } from 'lucide-react';
import { useContacts, usePrefs, useProfile, useRescueProtocol } from '../../data/hooks';
import { updatePreferences } from '../../data/repo';
import { toast } from '../../state/ui';
import { Button, Card, CardTitle, Disclaimer, LinkButton, PageHeader } from '../../ui/kit';
import { startSeizureTimer } from './SeizureTimer';
import { emergencyMessage, getLocationUrl, smsHref, telHref } from './sms';
import { ContactsEditor } from './ContactsEditor';

export function RescuePage() {
  const prefs = usePrefs();
  const profile = useProfile();
  const plan = useRescueProtocol();
  const contacts = useContacts();
  const [location, setLocation] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);
  const number = prefs?.emergencyNumber ?? '911';
  const notify = contacts.filter((c) => c.notifyOnEmergency && c.phone);
  const msg = emergencyMessage(profile?.displayName ?? '', location);

  async function startSafeMode() {
    const hours = prefs?.safeModeDurationHours ?? 4;
    await updatePreferences({ safeModeUntil: new Date(Date.now() + hours * 3600_000).toISOString() });
    toast(`Safe mode is on for ${hours} hours. Only the essentials are shown.`);
  }

  return (
    <div className="grid gap-4">
      <PageHeader title="Rescue" subtitle="Help, fast. Everything here works without signal except calls and texts." />

      <Button variant="primary" size="xl" block icon={<Timer aria-hidden size={28} />} onClick={startSeizureTimer}>
        Something’s happening — start timer
      </Button>

      <a
        href={`tel:${number}`}
        className="tap flex items-center justify-center gap-3 rounded-2xl border-2 border-sos bg-sos px-6 py-4 text-xl font-bold text-sos-ink no-underline"
      >
        <Phone aria-hidden size={26} /> Call emergency services ({number})
      </a>

      <LinkButton to="/support" size="lg" block icon={<HandHeart aria-hidden size={24} />}>
        I’m having thoughts of hurting myself
      </LinkButton>

      <Card labelledBy="contacts-h">
        <CardTitle id="contacts-h" icon={<HeartHandshake aria-hidden size={20} />}>
          My people
        </CardTitle>
        {contacts.length === 0 ? (
          <p className="text-ink-2">Add someone who should know if you need help.</p>
        ) : (
          <ul className="grid gap-2">
            {contacts.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center gap-2 rounded-xl bg-surface-2 p-3">
                <div className="min-w-0 flex-1">
                  <div className="font-bold">{c.name}</div>
                  <div className="text-sm text-ink-2">
                    {c.relationship ? `${c.relationship} · ` : ''}
                    {c.phone}
                  </div>
                </div>
                <a href={telHref(c.phone)} className="tap inline-flex items-center gap-1 rounded-xl border-2 border-line-strong bg-surface px-3 font-bold no-underline" aria-label={`Call ${c.name}`}>
                  <Phone aria-hidden size={20} /> Call
                </a>
                <a href={smsHref([c], msg)} className="tap inline-flex items-center gap-1 rounded-xl border-2 border-line-strong bg-surface px-3 font-bold no-underline" aria-label={`Text ${c.name} for help`}>
                  <MessageSquare aria-hidden size={20} /> Text
                </a>
              </li>
            ))}
          </ul>
        )}
        {notify.length > 1 && (
          <a
            href={smsHref(notify, msg)}
            className="tap mt-3 flex items-center justify-center gap-2 rounded-xl border-2 border-accent bg-accent px-4 font-bold text-accent-ink no-underline"
          >
            <MessageSquare aria-hidden size={20} /> Text everyone for help
          </a>
        )}
        {notify.length > 0 && (
          <div className="mt-3">
            {location ? (
              <p className="text-sm">
                <MapPin aria-hidden size={16} className="inline" /> Your location will be included in the text.
              </p>
            ) : (
              <Button
                variant="ghost"
                icon={<MapPin aria-hidden size={20} />}
                disabled={locating}
                onClick={async () => {
                  setLocating(true);
                  const url = await getLocationUrl();
                  setLocating(false);
                  if (url) setLocation(url);
                  else toast('Location isn’t available. The text will be sent without it.');
                }}
              >
                {locating ? 'Finding location…' : 'Add my location to the text'}
              </Button>
            )}
            <p className="mt-1 text-sm text-ink-2">Texts open in your phone’s messaging app with the message ready — you press send. Steady never sends anything itself.</p>
          </div>
        )}
        <details className="mt-3">
          <summary className="tap flex cursor-pointer items-center gap-2 font-bold text-accent-text">
            <UserPlus aria-hidden size={20} /> Add or edit people
          </summary>
          <div className="mt-3">
            <ContactsEditor />
          </div>
        </details>
      </Card>

      <div className="grid gap-2 sm:grid-cols-2">
        <Button size="lg" icon={<ShieldCheck aria-hidden size={22} />} onClick={startSafeMode}>
          I just had a seizure
        </Button>
        <LinkButton to="/rescue/calm" size="lg" icon={<Wind aria-hidden size={22} />}>
          Calm & grounding
        </LinkButton>
      </div>

      <Card labelledBy="plan-h">
        <CardTitle id="plan-h" icon={<FileText aria-hidden size={20} />} action={<Link to="/rescue/plan" className="tap inline-flex items-center px-2 font-bold text-accent-text underline underline-offset-4">Edit</Link>}>
          My seizure action plan
        </CardTitle>
        {plan?.seizureDescription ? (
          <div className="grid gap-3">
            <div>
              <h3 className="font-bold">What my seizures look like</h3>
              <p className="whitespace-pre-line">{plan.seizureDescription}</p>
            </div>
            {plan.howToHelp && (
              <div>
                <h3 className="font-bold">How to help me</h3>
                <p className="whitespace-pre-line">{plan.howToHelp}</p>
              </div>
            )}
            {plan.rescueMedicationInstructions && (
              <div>
                <h3 className="font-bold">Rescue medication</h3>
                <p className="whitespace-pre-line">{plan.rescueMedicationInstructions}</p>
              </div>
            )}
            <div>
              <h3 className="font-bold">When to call emergency services</h3>
              <p className="whitespace-pre-line">{plan.whenToCall911}</p>
            </div>
          </div>
        ) : (
          <p className="text-ink-2">Your action plan tells others what to do. It takes about five minutes to fill in — ideally with your neurologist’s guidance.</p>
        )}
        <div className="mt-4 flex flex-wrap gap-2">
          <LinkButton to="/rescue/plan" variant={plan?.seizureDescription ? 'secondary' : 'primary'}>
            {plan?.seizureDescription ? 'Edit plan' : 'Fill in my plan'}
          </LinkButton>
          <LinkButton to="/rescue/plan/print">Share or print</LinkButton>
        </div>
      </Card>

      <Disclaimer>
        Steady is not an emergency service and doesn’t call anyone automatically. Your action plan should be agreed with your neurologist.
      </Disclaimer>
    </div>
  );
}
