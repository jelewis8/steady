import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Mic, Plus, Trash2 } from 'lucide-react';
import { AURA_SYMPTOMS, SEIZURE_TYPE_LABELS, SEVERITY_LABELS } from '../../core/defaults';
import { dateKeyOf, formatDuration, formatIsoClock, relativeDay } from '../../core/time';
import { useAuras, useSeizures, useTriggerTags } from '../../data/hooks';
import { deleteAura } from '../../data/repo';
import { toast } from '../../state/ui';
import { Empty, IconButton, LinkButton, PageHeader, Segmented } from '../../ui/kit';

function SeverityDots({ n }: { n: number }) {
  return (
    <span className="inline-flex items-center gap-1" aria-label={`Strength ${n} of 5, ${SEVERITY_LABELS[n]}`}>
      <span aria-hidden className="tracking-tight">
        {'●'.repeat(n)}
        <span className="opacity-40">{'○'.repeat(5 - n)}</span>
      </span>
      <span aria-hidden className="text-sm text-ink-2">
        {SEVERITY_LABELS[n]}
      </span>
    </span>
  );
}

export function SeizureListPage() {
  const seizures = useSeizures();
  const auras = useAuras();
  const tags = useTriggerTags();
  const [tab, setTab] = useState<'seizures' | 'auras'>('seizures');
  const tagName = useMemo(() => new Map(tags.map((t) => [t.id, t.label])), [tags]);
  const auraLabel = useMemo(() => new Map(AURA_SYMPTOMS.map((a) => [a.key, a.label])), []);

  const byMonth = useMemo(() => {
    const groups = new Map<string, typeof seizures>();
    for (const s of seizures) {
      const k = new Date(s.timestamp).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
      groups.set(k, [...(groups.get(k) ?? []), s]);
    }
    return [...groups.entries()];
  }, [seizures]);

  const standaloneAuras = auras.filter((a) => !a.seizureEventId);

  return (
    <div className="grid gap-4">
      <PageHeader
        title="Seizure log"
        back="/more"
        action={
          <LinkButton to="/seizures/new" variant="primary" icon={<Plus aria-hidden size={20} />}>
            Log past one
          </LinkButton>
        }
      />
      <Segmented
        label="Show"
        hideLabel
        value={tab}
        onChange={setTab}
        options={[
          { value: 'seizures', label: `Seizures (${seizures.length})` },
          { value: 'auras', label: `Warning signs (${standaloneAuras.length})` },
        ]}
      />
      {tab === 'seizures' ? (
        seizures.length === 0 ? (
          <Empty title="No seizures logged">When you log one with the “Log seizure” button, it appears here.</Empty>
        ) : (
          byMonth.map(([month, list]) => (
            <section key={month} aria-labelledby={`m-${month}`}>
              <h2 id={`m-${month}`} className="mb-2 text-lg font-bold">
                {month} <span className="font-normal text-ink-2">· {list.length}</span>
              </h2>
              <ul className="grid gap-2">
                {list.map((s) => (
                  <li key={s.id}>
                    <Link to={`/seizures/${s.id}`} className="tap block rounded-2xl border-2 border-line bg-surface p-3 no-underline hover:border-accent">
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <span className="font-bold">
                          {relativeDay(dateKeyOf(s.timestamp))} · {formatIsoClock(s.timestamp)}
                        </span>
                        <SeverityDots n={s.severity} />
                      </div>
                      <div>
                        {SEIZURE_TYPE_LABELS[s.type].label}
                        {s.durationSeconds != null && <span className="text-ink-2"> · {formatDuration(s.durationSeconds)}</span>}
                      </div>
                      {s.triggerTagIds.length > 0 && (
                        <div className="text-sm text-ink-2">Triggers: {s.triggerTagIds.map((t) => tagName.get(t) ?? '').filter(Boolean).join(', ')}</div>
                      )}
                      <div className="flex gap-3 text-sm text-ink-2">
                        {s.isQuickLog && <span>Quick log — tap to add details</span>}
                        {s.voiceNoteUri && (
                          <span className="inline-flex items-center gap-1">
                            <Mic aria-hidden size={14} /> Voice note
                          </span>
                        )}
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))
        )
      ) : standaloneAuras.length === 0 ? (
        <Empty title="No warning signs logged">Warning signs you log on their own (without a seizure) appear here.</Empty>
      ) : (
        <ul className="grid gap-2">
          {standaloneAuras.map((a) => (
            <li key={a.id} className="flex items-center gap-2 rounded-2xl border-2 border-line bg-surface p-3">
              <div className="min-w-0 flex-1">
                <div className="font-bold">
                  {relativeDay(dateKeyOf(a.timestamp))} · {formatIsoClock(a.timestamp)}
                </div>
                <div className="text-ink-2">{a.symptoms.map((s) => auraLabel.get(s) ?? s).join(', ') || 'No details'}</div>
              </div>
              <IconButton
                label="Delete this warning sign"
                onClick={async () => {
                  const undo = await deleteAura(a.id);
                  toast('Warning sign deleted.', undo);
                }}
              >
                <Trash2 aria-hidden size={22} />
              </IconButton>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
