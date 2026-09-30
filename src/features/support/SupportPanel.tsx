import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ExternalLink, HandHeart, LifeBuoy, MessageSquare, NotebookPen, Phone, Wind } from 'lucide-react';
import {
  COUNTRIES,
  CRISIS_LINES_CHECKED,
  GLOBAL_DIRECTORY,
  countryByCode,
  inCountry,
  supportPeople,
  type CrisisLine,
} from '../../core/crisisLines';
import { DEFAULT_SUPPORT_MESSAGE } from '../../core/defaults';
import type { CustomSupportLine, SafetyPlan } from '../../core/types';
import { useContacts, usePrefs, useProfile } from '../../data/hooks';
import { setCountry } from '../../data/repo';
import { toast } from '../../state/ui';
import { Card, CardTitle, Disclaimer, Field, Select, cx } from '../../ui/kit';
import { smsHref, smsNumberHref, telHref } from '../rescue/sms';

const linkBase = 'tap inline-flex items-center justify-center gap-2 rounded-xl border-2 px-4 font-bold no-underline';
const linkSecondary = `${linkBase} border-line-strong bg-surface text-ink`;
const linkPrimary = `${linkBase} border-accent bg-accent text-accent-ink`;

function DialLink({ number, label, primary }: { number: string; label: string; primary?: boolean }) {
  return (
    <a href={telHref(number)} className={primary ? linkPrimary : linkSecondary} aria-label={`Call ${label}`}>
      <Phone aria-hidden size={20} /> Call {number}
    </a>
  );
}

function TextLink({ to, body, instruction, label }: { to: string; body?: string; instruction: string; label: string }) {
  return (
    <a href={smsNumberHref(to, body)} className={linkSecondary} aria-label={`${instruction} (${label})`}>
      <MessageSquare aria-hidden size={20} /> {instruction}
    </a>
  );
}

function LineCard({ line }: { line: CrisisLine }) {
  return (
    <li className="grid gap-2 rounded-xl bg-surface-2 p-3">
      <div>
        <div className="font-bold">{line.name}</div>
        <div className="text-sm text-ink-2">{[line.hours, line.note].filter(Boolean).join(' · ')}</div>
      </div>
      <div className="flex flex-wrap gap-2">
        {line.call && <DialLink number={line.call} label={line.name} primary />}
        {line.text && <TextLink to={line.text.to} body={line.text.body} instruction={line.text.label} label={line.name} />}
      </div>
      {line.web && <WebLink url={line.web} />}
    </li>
  );
}

function WebLink({ url }: { url: string }) {
  const host = url.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '');
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm font-bold text-accent-text underline underline-offset-4">
      <ExternalLink aria-hidden size={14} /> {host}
      <span className="sr-only"> (opens a website)</span>
    </a>
  );
}

function CustomLineCard({ line }: { line: CustomSupportLine }) {
  return (
    <li className="grid gap-2 rounded-xl bg-surface-2 p-3">
      <div className="font-bold">{line.name}</div>
      <div className="flex flex-wrap gap-2">
        {line.phone && <DialLink number={line.phone} label={line.name} primary />}
        {line.textNumber && <TextLink to={line.textNumber} instruction={`Text ${line.textNumber}`} label={line.name} />}
      </div>
    </li>
  );
}

/** Country choice for crisis lines. Saves as soon as it changes. */
export function CountryPicker({ label = 'Which country are you in?', hint }: { label?: string; hint?: string }) {
  const prefs = usePrefs();
  return (
    <Field label={label} hint={hint}>
      {(id, d) => (
        <Select
          id={id}
          aria-describedby={d}
          value={prefs?.country ?? ''}
          onChange={async (e) => {
            const v = e.target.value || null;
            const undo = await setCountry(v);
            toast(v && v !== 'other' ? `Country set to ${countryByCode(v)?.name}.` : 'Country saved.', undo);
          }}
        >
          <option value="">Choose a country…</option>
          {COUNTRIES.map((c) => (
            <option key={c.code} value={c.code}>
              {c.name}
            </option>
          ))}
          <option value="other">Somewhere else</option>
        </Select>
      )}
    </Field>
  );
}

const PLAN_SECTIONS: { key: keyof SafetyPlan; title: string }[] = [
  { key: 'warningSigns', title: 'Warning signs' },
  { key: 'copingStrategies', title: 'Things I can do on my own' },
  { key: 'distractions', title: 'People and places that help' },
  { key: 'helpers', title: 'People I can ask for help' },
  { key: 'professionals', title: 'Professionals and services' },
  { key: 'makingSafe', title: 'Making my space safer' },
  { key: 'reasonsForLiving', title: 'What matters most to me' },
];

export function PlanSummary({ plan }: { plan: SafetyPlan }) {
  const filled = PLAN_SECTIONS.filter((s) => String(plan[s.key] ?? '').trim());
  if (filled.length === 0) return null;
  return (
    <div className="grid gap-3">
      {filled.map((s) => (
        <div key={s.key}>
          <h3 className="font-bold">{s.title}</h3>
          <p className="whitespace-pre-line">{String(plan[s.key])}</p>
        </div>
      ))}
    </div>
  );
}

function Section({ id, title, icon, children }: { id: string; title: string; icon?: ReactNode; children: ReactNode }) {
  return (
    <Card labelledBy={id}>
      <CardTitle id={id} icon={icon}>
        {title}
      </CardTitle>
      {children}
    </Card>
  );
}

/**
 * Support for thoughts of self-harm or suicide (F-002).
 * Used on the Support page and, read-only, on the lock screen (`locked`). It records nothing, scores nothing,
 * and sends nothing: every call or text is started by the person tapping a link that opens the phone's own app.
 */
export function SupportPanel({ locked = false }: { locked?: boolean }) {
  const prefs = usePrefs();
  const profile = useProfile();
  const contacts = useContacts();
  const plan = profile?.safetyPlan ?? null;
  const country = countryByCode(prefs?.country);
  const number = prefs?.emergencyNumber ?? '911';
  const people = supportPeople(contacts, prefs?.defaultSupportContactId ?? null);
  const message = plan?.message?.trim() || DEFAULT_SUPPORT_MESSAGE;
  const custom = prefs?.customSupportLines ?? [];
  const showPlan = plan && (!locked || plan.showOnLockScreen) && PLAN_SECTIONS.some((s) => String(plan[s.key] ?? '').trim());

  return (
    <div className="grid gap-4">
      <div>
        <h2 className="text-2xl font-bold">You’re not alone.</h2>
        <p className="mt-1 text-lg">Thank you for reaching out. You don’t have to go through this alone. Here are people you can contact right now.</p>
      </div>

      <Card tone="attn" labelledBy="sup-danger">
        <h3 id="sup-danger" className="text-lg font-bold">
          If you might act on these thoughts, or you’re in danger
        </h3>
        <p className="mt-1">Call emergency services now.</p>
        <a href={telHref(number)} className="tap mt-3 flex items-center justify-center gap-3 rounded-2xl border-2 border-sos bg-sos px-6 py-4 text-xl font-bold text-sos-ink no-underline" aria-label={`Call emergency services on ${number}`}>
          <Phone aria-hidden size={26} /> Call emergency services ({number})
        </a>
        {country?.emergencyNote && number === country.emergency && <p className="mt-2 text-sm">{country.emergencyNote}</p>}
      </Card>

      <Section id="sup-lines" title="Talk to someone now" icon={<LifeBuoy aria-hidden size={20} />}>
        {country ? (
          <>
            <p className="mb-3 text-ink-2">Free, private support from trained people in {inCountry(country)}. You don’t need to be sure what to say.</p>
            <ul className="grid gap-2">
              {country.lines.map((l) => (
                <LineCard key={`${l.name}-${l.call ?? l.text?.to}`} line={l} />
              ))}
            </ul>
          </>
        ) : locked ? (
          <p>Choose your country inside Steady to see crisis lines for where you live. For now you can call emergency services above, or reach someone you trust below.</p>
        ) : (
          <>
            <p className="mb-3">Tell Steady which country you’re in, and it will show the crisis lines there.</p>
            <CountryPicker />
          </>
        )}
        {custom.length > 0 && (
          <div className="mt-3">
            <h3 className="mb-2 font-bold">Numbers I added</h3>
            <ul className="grid gap-2">
              {custom.map((l) => (
                <CustomLineCard key={l.id} line={l} />
              ))}
            </ul>
          </div>
        )}
        {(!country || prefs?.country === 'other') && (
          <p className="mt-3 text-sm text-ink-2">
            Somewhere else? {GLOBAL_DIRECTORY.name} {GLOBAL_DIRECTORY.note} <WebLink url={GLOBAL_DIRECTORY.url} />
          </p>
        )}
        {!locked && country && (
          <div className="mt-3">
            <CountryPicker label="Change country" />
          </div>
        )}
      </Section>

      <Section id="sup-people" title="Reach someone you trust" icon={<HandHeart aria-hidden size={20} />}>
        {people.length > 0 ? (
          <>
            <p className="mb-3 text-ink-2">
              Texts open in your phone’s messaging app with this message ready. You press send: <em>“{message}”</em>
            </p>
            <ul className="grid gap-2">
              {people.map((c, i) => (
                <li key={c.id} className="grid gap-2 rounded-xl bg-surface-2 p-3">
                  <div>
                    <div className="font-bold">
                      {c.name}
                      {i === 0 && people.length > 1 && <span className="ml-2 rounded-full border border-line-strong px-2 py-0.5 text-sm font-normal">Main person</span>}
                    </div>
                    {c.relationship && <div className="text-sm text-ink-2">{c.relationship}</div>}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <a href={telHref(c.phone)} className={linkPrimary} aria-label={`Call ${c.name}`}>
                      <Phone aria-hidden size={20} /> Call
                    </a>
                    <a href={smsHref([c], message)} className={linkSecondary} aria-label={`Text ${c.name}: ${message}`}>
                      <MessageSquare aria-hidden size={20} /> Text
                    </a>
                  </div>
                </li>
              ))}
            </ul>
            {people.length > 1 && (
              <a href={smsHref(people, message)} className={cx(linkSecondary, 'mt-3 w-full')}>
                <MessageSquare aria-hidden size={20} /> Text everyone on this list
              </a>
            )}
          </>
        ) : (
          <p className="text-ink-2">
            {locked ? 'No one is set up here yet.' : 'Choose the people you would want to reach when things feel too much. You can do it in your safety plan.'}
          </p>
        )}
      </Section>

      <Section id="sup-plan" title="My safety plan" icon={<NotebookPen aria-hidden size={20} />}>
        {showPlan ? (
          <PlanSummary plan={plan} />
        ) : plan && locked ? (
          <p className="text-ink-2">Your plan is kept private. Unlock Steady to read it.</p>
        ) : locked ? (
          <p className="text-ink-2">No plan written yet.</p>
        ) : (
          <p className="text-ink-2">A plan you write when you feel steadier can help on harder days. It’s yours, it stays on this device, and you can change it any time.</p>
        )}
        {!locked && (
          <Link to="/support/plan" className={cx(linkSecondary, 'mt-3')}>
            {plan ? 'Edit my safety plan' : 'Write my safety plan'}
          </Link>
        )}
      </Section>

      {!locked && (
        <Link to="/rescue/calm" className={cx(linkSecondary, 'py-3')}>
          <Wind aria-hidden size={20} /> Calm & grounding
        </Link>
      )}

      <Disclaimer>
        Steady is not a crisis or emergency service. It never contacts anyone by itself, keeps no record of this page, and sends nothing anywhere. This page shows ways to reach
        people. It is not medical advice or treatment. Numbers were last checked {new Date(CRISIS_LINES_CHECKED).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })} and
        can change. If one doesn’t connect, try another or call emergency services.
      </Disclaimer>
    </div>
  );
}
