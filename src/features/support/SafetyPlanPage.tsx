import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { DEFAULT_SUPPORT_MESSAGE } from '../../core/defaults';
import { supportPeople } from '../../core/crisisLines';
import type { SafetyPlan } from '../../core/types';
import { useContacts, usePrefs, useProfile } from '../../data/hooks';
import { saveContact, saveSafetyPlan, updatePreferences } from '../../data/repo';
import { toast } from '../../state/ui';
import { Button, Card, CardTitle, Disclaimer, Field, PageHeader, Select, TextArea, Toggle } from '../../ui/kit';
import { ContactsEditor } from '../rescue/ContactsEditor';

const EMPTY: SafetyPlan = {
  warningSigns: '',
  copingStrategies: '',
  distractions: '',
  helpers: '',
  professionals: '',
  makingSafe: '',
  reasonsForLiving: '',
  message: DEFAULT_SUPPORT_MESSAGE,
  showOnLockScreen: false,
  updatedAt: '',
};

/** The standard safety-planning sections, in the user's own words. Steady supplies the prompts and never the content. */
const SECTIONS: { key: 'warningSigns' | 'copingStrategies' | 'distractions' | 'helpers' | 'professionals' | 'makingSafe' | 'reasonsForLiving'; title: string; prompt: string }[] = [
  { key: 'warningSigns', title: 'My warning signs', prompt: 'Thoughts, feelings, or situations that tell me things are getting harder.' },
  { key: 'copingStrategies', title: 'Things I can do on my own that help', prompt: 'Small things that have helped before, even a little.' },
  { key: 'distractions', title: 'People and places that help me feel better', prompt: 'Somewhere I can go, or someone I can be around, to take my mind off things.' },
  { key: 'helpers', title: 'People I can ask for help', prompt: 'Their names and numbers. (People you choose above also appear on the Support page.)' },
  { key: 'professionals', title: 'Professionals and services I can contact', prompt: 'My doctor, therapist, or clinic, and a crisis line.' },
  { key: 'makingSafe', title: 'Making my space safer', prompt: 'What would make my surroundings safer during a hard time, in my own words. My care team can help me think this through.' },
  { key: 'reasonsForLiving', title: 'What matters most to me', prompt: 'The people, things, and hopes that matter to me.' },
];

export function SafetyPlanPage() {
  const profile = useProfile();
  const prefs = usePrefs();
  const contacts = useContacts();
  const [draft, setDraft] = useState<SafetyPlan | null>(null);

  useEffect(() => {
    if (profile && !draft) setDraft({ ...EMPTY, ...(profile.safetyPlan ?? {}) });
  }, [profile, draft]);

  if (!draft) return <p className="text-ink-2">Loading…</p>;
  const set = (p: Partial<SafetyPlan>) => setDraft({ ...draft, ...p });
  const people = supportPeople(contacts, prefs?.defaultSupportContactId ?? null);
  const mainId = prefs?.defaultSupportContactId && people.some((c) => c.id === prefs.defaultSupportContactId) ? prefs.defaultSupportContactId : (people[0]?.id ?? '');

  async function toggleSupport(id: string, on: boolean) {
    const c = contacts.find((x) => x.id === id);
    if (!c) return;
    await saveContact({ ...c, supportPerson: on });
    if (on && !people.length) await updatePreferences({ defaultSupportContactId: id });
    if (!on && prefs?.defaultSupportContactId === id) await updatePreferences({ defaultSupportContactId: null });
  }

  return (
    <div className="grid gap-4 pb-6">
      <PageHeader
        title="My safety plan"
        back="/support"
        subtitle="Written by you, for hard moments. It stays on this device. Fill in as much or as little as you like, and change it any time."
      />
      <Disclaimer>
        This is a place for your own words. Steady doesn’t judge, score, or read what you write. It works best when made with someone you trust or a professional.
      </Disclaimer>

      <Card labelledBy="ppl-h">
        <CardTitle id="ppl-h">People I can reach out to</CardTitle>
        {contacts.length === 0 ? (
          <p className="text-ink-2">Add someone below. They’ll then appear on your Support page with Call and Text buttons.</p>
        ) : (
          <div className="grid gap-3">
            {contacts.map((c) => (
              <Toggle key={c.id} label={c.name} hint={c.relationship || c.phone} checked={!!c.supportPerson} onChange={(v) => toggleSupport(c.id, v)} />
            ))}
            {people.length > 1 && (
              <Field label="Main person" hint="Shown first on the Support page.">
                {(id, d) => (
                  <Select
                    id={id}
                    aria-describedby={d}
                    value={mainId}
                    onChange={async (e) => {
                      const undo = await updatePreferences({ defaultSupportContactId: e.target.value });
                      toast('Main person changed.', undo);
                    }}
                  >
                    {people.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </Select>
                )}
              </Field>
            )}
          </div>
        )}
        <details className="mt-3">
          <summary className="tap flex cursor-pointer items-center gap-2 font-bold text-accent-text">Add or edit people</summary>
          <div className="mt-3">
            <ContactsEditor />
          </div>
        </details>
      </Card>

      <form
        className="grid gap-4"
        onSubmit={async (e) => {
          e.preventDefault();
          const undo = await saveSafetyPlan({ ...draft, message: draft.message.trim() || DEFAULT_SUPPORT_MESSAGE });
          toast('Safety plan saved.', undo);
        }}
      >
        {SECTIONS.map((s) => (
          <Card key={s.key}>
            <Field label={s.title} hint={s.prompt}>
              {(id, d) => <TextArea id={id} aria-describedby={d} value={draft[s.key]} onChange={(e) => set({ [s.key]: e.target.value })} className="min-h-24" />}
            </Field>
          </Card>
        ))}

        <Card>
          <Field label="The message I’d send" hint="Used when you tap Text next to someone on the Support page. You press send yourself.">
            {(id, d) => <TextArea id={id} aria-describedby={d} value={draft.message} onChange={(e) => set({ message: e.target.value })} className="min-h-20" />}
          </Field>
        </Card>

        <Card>
          <Toggle
            label="Show this plan on the lock screen"
            hint="Off by default. If on, anyone holding your phone could read the plan without your passcode. Your crisis lines and people to contact are always available from the lock screen."
            checked={draft.showOnLockScreen}
            onChange={(v) => set({ showOnLockScreen: v })}
          />
        </Card>

        <div className="flex flex-wrap gap-2">
          <Button type="submit" variant="primary" size="lg">
            Save my plan
          </Button>
          <Link to="/support" className="tap inline-flex items-center rounded-xl border-2 border-line-strong bg-surface px-4 font-bold no-underline">
            Back to Support
          </Link>
        </div>
      </form>
    </div>
  );
}
