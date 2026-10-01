import { useState } from 'react';
import { Plus } from 'lucide-react';
import { describeSideEffectDates, groupSideEffects, SEVERITY_TEXT, sideEffectProblem, sortSideEffects } from '../../core/sideEffects';
import type { Medication, SideEffectLog, SideEffectSeverity } from '../../core/types';
import { useMedications, useSideEffects } from '../../data/hooks';
import { deleteSideEffect, newSideEffect, saveSideEffect } from '../../data/repo';
import { toast } from '../../state/ui';
import { Button, Field, Segmented, Select, Sheet, TextArea, TextField } from '../../ui/kit';

type SeverityChoice = SideEffectSeverity | 'unsure';

const medLabel = (m: Medication) => `${m.name} ${m.dosage}${m.unit ? ` ${m.unit}` : ''}${m.isActive ? '' : ' (no longer taking)'}`;

/** Add or edit one side effect. Mounted only while open (the Sheet does that). */
function SideEffectSheet({ initial, isNew, meds, onClose }: { initial: SideEffectLog; isNew: boolean; meds: Medication[]; onClose: () => void }) {
  const [d, setD] = useState<SideEffectLog>(initial);
  const [tried, setTried] = useState(false);
  const set = (p: Partial<SideEffectLog>) => setD({ ...d, ...p });
  const problem = sideEffectProblem(d.startDate, d.endDate);
  const nameMissing = !d.name.trim();

  async function save() {
    setTried(true);
    if (nameMissing || problem) return;
    const undo = await saveSideEffect(d);
    toast(isNew ? `${d.name.trim()} added to your side-effect log.` : 'Side effect saved.', undo);
    onClose();
  }

  return (
    <Sheet open onClose={onClose} title={isNew ? 'Add a side effect' : 'Edit side effect'}>
      <form
        className="grid gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <TextField
          label="What did you notice?"
          value={d.name}
          onChange={(v) => set({ name: v })}
          placeholder="e.g. Dizziness"
          autoComplete="off"
          aria-invalid={tried && nameMissing}
          hint={tried && nameMissing ? 'Add a few words so you and your doctor know what this was.' : undefined}
        />
        <Field label="Which medication?">
          {(id) => (
            <Select id={id} value={d.medicationId ?? ''} onChange={(e) => set({ medicationId: e.target.value || null })}>
              <option value="">I’m not sure which one</option>
              {meds.map((m) => (
                <option key={m.id} value={m.id}>
                  {medLabel(m)}
                </option>
              ))}
            </Select>
          )}
        </Field>
        <TextField label="When did it start?" type="date" value={d.startDate ?? ''} onChange={(v) => set({ startDate: v || null })} hint="Leave empty if you don’t remember. That’s fine." />
        <TextField label="When did it stop?" type="date" value={d.endDate ?? ''} onChange={(v) => set({ endDate: v || null })} hint="Leave empty if it’s still happening, or you’re not sure." />
        {problem && (
          <p role="alert" className="text-attn-ink font-bold">
            {problem}
          </p>
        )}
        <Segmented<SeverityChoice>
          label="How strong was it?"
          value={d.severity ?? 'unsure'}
          onChange={(v) => set({ severity: v === 'unsure' ? null : v })}
          columns={2}
          options={[
            { value: 'mild', label: 'Mild' },
            { value: 'moderate', label: 'Moderate' },
            { value: 'severe', label: 'Severe' },
            { value: 'unsure', label: 'Not sure' },
          ]}
        />
        <Field label="Notes (optional)">{(id) => <TextArea id={id} value={d.notes ?? ''} onChange={(e) => set({ notes: e.target.value || null })} className="min-h-20" />}</Field>
        <div className="grid gap-2">
          <Button type="submit" variant="primary" size="lg">
            Save
          </Button>
          {!isNew && (
            <Button
              variant="ghost"
              onClick={async () => {
                const undo = await deleteSideEffect(d.id);
                toast(`${d.name} removed from your log.`, undo);
                onClose();
              }}
            >
              Remove this entry
            </Button>
          )}
          <Button onClick={onClose}>Cancel</Button>
        </div>
      </form>
    </Sheet>
  );
}

function Entry({ se, onEdit }: { se: SideEffectLog; onEdit: () => void }) {
  return (
    <li className="flex items-start gap-2 rounded-xl bg-surface-2 p-3">
      <div className="min-w-0 flex-1">
        <div className="font-bold">
          {se.name}
          {se.severity && <span className="ml-2 font-normal text-ink-2">· {SEVERITY_TEXT[se.severity]}</span>}
        </div>
        <div className="text-sm text-ink-2">{describeSideEffectDates(se)}</div>
        {se.notes && <div className="mt-1 text-sm">{se.notes}</div>}
      </div>
      <Button variant="quiet" onClick={onEdit} aria-label={`Edit ${se.name}`}>
        Edit
      </Button>
    </li>
  );
}

/**
 * The side-effect log. With `medicationId` it shows that medication's entries; without, everything grouped by medication.
 */
export function SideEffectsList({ medicationId, showAddLabel = 'Add a side effect' }: { medicationId?: string; showAddLabel?: string }) {
  const meds = useMedications();
  const all = useSideEffects();
  const [editing, setEditing] = useState<{ se: SideEffectLog; isNew: boolean } | null>(null);
  const scoped = medicationId ? sortSideEffects(all.filter((e) => e.medicationId === medicationId)) : null;
  const groups = medicationId ? [] : groupSideEffects(all, meds);

  return (
    <div className="grid gap-3">
      {medicationId ? (
        scoped && scoped.length > 0 ? (
          <ul className="grid gap-2">
            {scoped.map((se) => (
              <Entry key={se.id} se={se} onEdit={() => setEditing({ se, isNew: false })} />
            ))}
          </ul>
        ) : (
          <p className="text-ink-2">Nothing noted for this medication.</p>
        )
      ) : groups.length === 0 ? (
        <p className="text-ink-2">No side effects noted yet. If you notice something you think might be linked to a medication, add it here so your doctor can see when it started.</p>
      ) : (
        groups.map((g) => (
          <section key={g.medication?.id ?? 'unsure'} aria-label={g.medication ? medLabel(g.medication) : 'Not sure which medication'}>
            <h2 className="mb-1.5 font-bold">{g.medication ? medLabel(g.medication) : 'Not sure which medication'}</h2>
            <ul className="grid gap-2">
              {g.entries.map((se) => (
                <Entry key={se.id} se={se} onEdit={() => setEditing({ se, isNew: false })} />
              ))}
            </ul>
          </section>
        ))
      )}
      <div>
        <Button icon={<Plus aria-hidden size={20} />} onClick={() => setEditing({ se: newSideEffect(medicationId ?? null), isNew: true })}>
          {showAddLabel}
        </Button>
      </div>
      {editing && <SideEffectSheet key={editing.se.id} initial={editing.se} isNew={editing.isNew} meds={meds} onClose={() => setEditing(null)} />}
    </div>
  );
}
