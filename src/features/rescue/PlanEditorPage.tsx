import { useEffect, useState } from 'react';
import type { RescueProtocol } from '../../core/types';
import { useMedications, useRescueProtocol } from '../../data/hooks';
import { saveRescueProtocol } from '../../data/repo';
import { toast } from '../../state/ui';
import { Button, Card, Disclaimer, Field, Input, PageHeader, TextArea } from '../../ui/kit';
import { ContactsEditor } from './ContactsEditor';

export function PlanEditorPage() {
  const plan = useRescueProtocol();
  const meds = useMedications();
  const [form, setForm] = useState<RescueProtocol | null>(null);
  const [allergy, setAllergy] = useState('');

  useEffect(() => {
    if (plan && !form) setForm(plan);
  }, [plan, form]);

  // Auto-save each change (debounced).
  useEffect(() => {
    if (!form || form === plan) return;
    const t = setTimeout(() => void saveRescueProtocol(form), 600);
    return () => clearTimeout(t);
  }, [form, plan]);

  if (!form) return <p className="text-ink-2">Loading…</p>;
  const set = (p: Partial<RescueProtocol>) => setForm({ ...form, ...p });
  const medSummary = meds
    .filter((m) => m.isActive)
    .map((m) => `${m.name} ${m.dosage}${m.unit}${m.isRescue ? ' (rescue)' : m.scheduledTimes.length ? ` at ${m.scheduledTimes.join(', ')}` : ''}`)
    .join('\n');

  return (
    <div className="grid gap-4 pb-6">
      <PageHeader title="My seizure action plan" back="/rescue" subtitle="Saved as you type. Share it with the people around you." />
      <Disclaimer>
        Ask your neurologist to help fill this in — especially the rescue medication and when to call for help. Steady doesn’t decide these.
      </Disclaimer>
      <Card>
        <div className="grid gap-4">
          <Field label="What my seizures look like" hint="What might someone see? How long do they usually last? What am I like afterwards?">
            {(id, d) => <TextArea id={id} aria-describedby={d} value={form.seizureDescription} onChange={(e) => set({ seizureDescription: e.target.value })} />}
          </Field>
          <Field label="How to help me">
            {(id) => <TextArea id={id} value={form.howToHelp ?? ''} onChange={(e) => set({ howToHelp: e.target.value || null })} />}
          </Field>
          <Field label="Rescue medication" hint="Name, dose, where it’s kept, and when to give it — exactly as your doctor prescribed.">
            {(id, d) => (
              <TextArea id={id} aria-describedby={d} value={form.rescueMedicationInstructions ?? ''} onChange={(e) => set({ rescueMedicationInstructions: e.target.value || null })} />
            )}
          </Field>
          <Field label="When to call emergency services">
            {(id) => <TextArea id={id} value={form.whenToCall911} onChange={(e) => set({ whenToCall911: e.target.value })} />}
          </Field>
        </div>
      </Card>
      <Card>
        <div className="grid gap-4">
          <div>
            <span className="font-bold">Allergies</span>
            <ul className="my-2 flex flex-wrap gap-2">
              {form.allergies.map((a) => (
                <li key={a}>
                  <Button variant="quiet" aria-label={`Remove allergy ${a}`} onClick={() => set({ allergies: form.allergies.filter((x) => x !== a) })}>
                    {a} ✕
                  </Button>
                </li>
              ))}
              {form.allergies.length === 0 && <li className="text-ink-2">None added</li>}
            </ul>
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (allergy.trim()) set({ allergies: [...new Set([...form.allergies, allergy.trim()])] });
                setAllergy('');
              }}
            >
              <Input aria-label="Add an allergy" placeholder="e.g. Penicillin" value={allergy} onChange={(e) => setAllergy(e.target.value)} />
              <Button type="submit">Add</Button>
            </form>
          </div>
          <Field label="Current medications" hint="Filled in from your medication list. You can add anything else.">
            {(id, d) => (
              <>
                <TextArea id={id} aria-describedby={d} value={form.currentMedications} onChange={(e) => set({ currentMedications: e.target.value })} />
                {medSummary && (
                  <Button className="mt-2 self-start" variant="ghost" onClick={() => set({ currentMedications: medSummary })}>
                    Fill in from my medication list
                  </Button>
                )}
              </>
            )}
          </Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Neurologist">{(id) => <Input id={id} value={form.neurologistName ?? ''} onChange={(e) => set({ neurologistName: e.target.value || null })} />}</Field>
            <Field label="Neurologist phone">
              {(id) => <Input id={id} type="tel" value={form.neurologistPhone ?? ''} onChange={(e) => set({ neurologistPhone: e.target.value || null })} />}
            </Field>
          </div>
          <Field label="Anything else">{(id) => <TextArea id={id} value={form.additionalNotes ?? ''} onChange={(e) => set({ additionalNotes: e.target.value || null })} />}</Field>
        </div>
      </Card>
      <Card labelledBy="ppl-h">
        <h2 id="ppl-h" className="mb-3 text-lg font-bold">
          Emergency contacts
        </h2>
        <ContactsEditor />
      </Card>
      <Button
        variant="primary"
        size="lg"
        onClick={async () => {
          await saveRescueProtocol({ ...form, lastReviewedAt: new Date().toISOString() });
          toast('Plan marked as reviewed today.');
        }}
      >
        I’ve reviewed my plan today
      </Button>
      {form.lastReviewedAt && <p className="text-ink-2">Last reviewed {new Date(form.lastReviewedAt).toLocaleDateString()}.</p>}
    </div>
  );
}
