import { Link } from 'react-router-dom';
import { Phone } from 'lucide-react';
import { buildChecklistView } from '../../core/checklist';
import { formatIsoClock, todayKey } from '../../core/time';
import { useChecklistItems, useContacts, useDoses, useMedications, usePrefs } from '../../data/hooks';
import { updatePreferences } from '../../data/repo';
import { toast } from '../../state/ui';
import { Button } from '../../ui/kit';
import { ChecklistRow } from '../today/Checklist';
import { telHref } from '../rescue/sms';

/** Post-ictal safe mode (blueprint §2.4): only the checklist essentials, logging and rescue. */
export function SafeModeToday({ now }: { now: Date }) {
  const today = todayKey(now);
  const prefs = usePrefs();
  const items = useChecklistItems(today) ?? [];
  const doses = useDoses(today, today);
  const meds = useMedications();
  const contacts = useContacts();
  const view = buildChecklistView({ date: today, items, doses, meds, now, isToday: true, essentialsOnly: true, upNextCount: 3 });
  const open = [...view.stillOpen, ...view.upNext];
  const first = contacts[0];

  return (
    <div className="grid gap-5">
      <div>
        <h1 className="text-3xl font-bold">Take it slow</h1>
        <p className="mt-1 text-lg">
          Safe mode is on{prefs?.safeModeUntil ? ` until ${formatIsoClock(prefs.safeModeUntil)}` : ''}. Rest somewhere safe. Feeling confused or tired
          after a seizure is common.
        </p>
      </div>

      <Button
        variant="primary"
        size="xl"
        block
        onClick={async () => {
          const undo = await updatePreferences({ safeModeUntil: null });
          toast('Welcome back. Safe mode is off.', undo);
        }}
      >
        I’m OK — exit safe mode
      </Button>

      <section aria-labelledby="sm-meds">
        <h2 id="sm-meds" className="mb-2 text-xl font-bold">
          Just the essentials
        </h2>
        {open.length === 0 ? (
          <p className="rounded-2xl border-2 border-dashed border-line p-4 text-lg">Nothing needs doing right now.</p>
        ) : (
          <ul className="grid gap-3">
            {open.map((e) => (
              <ChecklistRow key={e.key} entry={e} date={today} />
            ))}
          </ul>
        )}
      </section>

      <div className="grid gap-3">
        {first && (
          <a
            href={telHref(first.phone)}
            className="tap flex items-center justify-center gap-3 rounded-2xl border-2 border-line-strong bg-surface px-6 py-5 text-xl font-bold no-underline"
          >
            <Phone aria-hidden size={26} /> Call {first.name}
          </a>
        )}
        <Link
          to="/rescue"
          className="tap flex items-center justify-center rounded-2xl border-2 border-line-strong bg-surface px-6 py-5 text-xl font-bold no-underline"
        >
          Rescue plan
        </Link>
      </div>
      <p className="text-ink-2">Medication reminders stay on. Other reminders are paused while safe mode is on.</p>
    </div>
  );
}
