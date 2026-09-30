import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import type { EmergencyContact } from '../../core/types';
import { useContacts } from '../../data/hooks';
import { deleteContact, newContact, saveContact } from '../../data/repo';
import { toast } from '../../state/ui';
import { Button, TextField, Toggle } from '../../ui/kit';

export function ContactsEditor() {
  const contacts = useContacts();
  const [draft, setDraft] = useState<EmergencyContact | null>(null);

  if (draft) {
    const set = (p: Partial<EmergencyContact>) => setDraft({ ...draft, ...p });
    return (
      <form
        className="grid gap-3 rounded-xl border border-line p-3"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!draft.name.trim() || !draft.phone.trim()) return;
          await saveContact({ ...draft, name: draft.name.trim(), phone: draft.phone.trim() });
          setDraft(null);
          toast('Contact saved.');
        }}
      >
        <TextField label="Name" value={draft.name} onChange={(v) => set({ name: v })} required autoComplete="off" />
        <TextField label="Relationship" value={draft.relationship} onChange={(v) => set({ relationship: v })} placeholder="e.g. Partner, Mum, Roommate" />
        <TextField label="Phone" type="tel" value={draft.phone} onChange={(v) => set({ phone: v })} required autoComplete="off" />
        <Toggle label="Include in “Text everyone”" checked={draft.notifyOnEmergency} onChange={(v) => set({ notifyOnEmergency: v })} />
        <Toggle label="Show on my action plan" checked={draft.canViewRescueProtocol} onChange={(v) => set({ canViewRescueProtocol: v })} />
        <Toggle
          label="Someone I can reach when I’m not feeling safe"
          hint="Appears on the Support page with Call and Text buttons."
          checked={!!draft.supportPerson}
          onChange={(v) => set({ supportPerson: v })}
        />
        <div className="flex gap-2">
          <Button type="submit" variant="primary">
            Save contact
          </Button>
          <Button onClick={() => setDraft(null)}>Cancel</Button>
        </div>
      </form>
    );
  }

  return (
    <div className="grid gap-2">
      {contacts.map((c) => (
        <div key={c.id} className="flex items-center gap-2">
          <Button variant="quiet" className="flex-1 justify-start" onClick={() => setDraft(c)}>
            Edit {c.name}
          </Button>
          <Button
            variant="ghost"
            aria-label={`Remove ${c.name}`}
            onClick={async () => {
              const undo = await deleteContact(c.id);
              toast(`${c.name} removed.`, undo);
            }}
          >
            <Trash2 aria-hidden size={20} />
          </Button>
        </div>
      ))}
      <Button variant="primary" onClick={() => setDraft(newContact(contacts.length))}>
        Add a person
      </Button>
    </div>
  );
}
