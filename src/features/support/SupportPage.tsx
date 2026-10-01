import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import type { CustomSupportLine } from '../../core/types';
import { uuid } from '../../core/ids';
import { usePrefs } from '../../data/hooks';
import { updatePreferences } from '../../data/repo';
import { toast } from '../../state/ui';
import { Button, Card, CardTitle, PageHeader, TextField } from '../../ui/kit';
import { SupportPanel } from './SupportPanel';

/** Numbers the user adds: a local line not in the list, or someone like a counsellor. */
function MyNumbers() {
  const prefs = usePrefs();
  const lines = prefs?.customSupportLines ?? [];
  const [draft, setDraft] = useState<{ name: string; phone: string; textNumber: string } | null>(null);

  async function add() {
    if (!draft || !draft.name.trim() || !draft.phone.trim()) return;
    const line: CustomSupportLine = { id: uuid(), name: draft.name.trim(), phone: draft.phone.trim(), textNumber: draft.textNumber.trim() || null };
    const undo = await updatePreferences({ customSupportLines: [...lines, line] });
    setDraft(null);
    toast(`${line.name} added to your numbers.`, undo);
  }

  return (
    <Card labelledBy="mynum-h">
      <CardTitle id="mynum-h">Add a number of my own</CardTitle>
      <p className="mb-3 text-ink-2">A crisis line that isn’t listed for your country, or a counsellor or service you already use. It appears under “Talk to someone now”.</p>
      {lines.length > 0 && (
        <ul className="mb-3 grid gap-2">
          {lines.map((l) => (
            <li key={l.id} className="flex items-center gap-2 rounded-xl bg-surface-2 p-3">
              <span className="min-w-0 flex-1">
                <span className="block font-bold">{l.name}</span>
                <span className="block text-sm text-ink-2">{[l.phone, l.textNumber && `text ${l.textNumber}`].filter(Boolean).join(' · ')}</span>
              </span>
              <Button
                variant="ghost"
                aria-label={`Remove ${l.name}`}
                onClick={async () => {
                  const undo = await updatePreferences({ customSupportLines: lines.filter((x) => x.id !== l.id) });
                  toast(`${l.name} removed.`, undo);
                }}
              >
                <Trash2 aria-hidden size={20} />
              </Button>
            </li>
          ))}
        </ul>
      )}
      {draft ? (
        <form
          className="grid gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            void add();
          }}
        >
          <TextField label="Name of the line or service" value={draft.name} onChange={(v) => setDraft({ ...draft, name: v })} required autoComplete="off" />
          <TextField label="Phone number" type="tel" value={draft.phone} onChange={(v) => setDraft({ ...draft, phone: v })} required autoComplete="off" />
          <TextField label="Number to text (optional)" type="tel" value={draft.textNumber} onChange={(v) => setDraft({ ...draft, textNumber: v })} autoComplete="off" />
          <div className="flex gap-2">
            <Button type="submit" variant="primary">
              Save number
            </Button>
            <Button onClick={() => setDraft(null)}>Cancel</Button>
          </div>
        </form>
      ) : (
        <Button icon={<Plus aria-hidden size={20} />} onClick={() => setDraft({ name: '', phone: '', textNumber: '' })}>
          Add a number
        </Button>
      )}
    </Card>
  );
}

export function SupportPage() {
  return (
    <div className="grid gap-4 pb-6">
      <PageHeader title="Support" back="/rescue" />
      <SupportPanel />
      <MyNumbers />
    </div>
  );
}
