import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ChevronLeft, Copy, Printer } from 'lucide-react';
import { AURA_SYMPTOMS, POST_ICTAL_SYMPTOMS, SEIZURE_TYPE_LABELS } from '../../core/defaults';
import { adherence } from '../../core/stats';
import { dateKeyOf, formatDateShort, formatDuration, formatHours, formatIsoClock } from '../../core/time';
import { useDoses, useProfile, useTriggerTags } from '../../data/hooks';
import { webShare } from '../../platform/share';
import { toast } from '../../state/ui';
import { Button, Segmented } from '../../ui/kit';
import { useInsightData } from './useInsightData';

/** Clinician report (Workflow 4) — printable to PDF, or copied as plain text. Generated on the device. */
export function ReportPage() {
  const [params] = useSearchParams();
  const nav = useNavigate();
  const [days, setDays] = useState(Number(params.get('days')) || 90);
  const d = useInsightData(days);
  const profile = useProfile();
  const tags = useTriggerTags();
  const allDoses = useDoses(d.start, d.end);
  const tagName = new Map(tags.map((t) => [t.id, t.label]));
  const auraName = new Map(AURA_SYMPTOMS.map((a) => [a.key, a.label]));
  const postName = new Map(POST_ICTAL_SYMPTOMS.map((a) => [a.key, a.label]));
  const meds = d.meds.filter((m) => m.isActive);
  const perMed = meds
    .filter((m) => !m.isRescue)
    .map((m) => ({ m, a: adherence(allDoses.filter((x) => x.medicationId === m.id), d.start, d.end) }));
  const seizures = [...d.seizures].sort((a, b) => (a.timestamp < b.timestamp ? -1 : 1));
  const withDuration = seizures.filter((s) => s.durationSeconds != null);
  const medianDuration = withDuration.length
    ? [...withDuration].sort((a, b) => a.durationSeconds! - b.durationSeconds!)[Math.floor(withDuration.length / 2)].durationSeconds!
    : null;
  const stressDays = d.checkIns.filter((c) => c.date >= d.start && c.date <= d.end && c.stress != null);
  const avgStress = stressDays.length ? (stressDays.reduce((a, c) => a + (c.stress ?? 0), 0) / stressDays.length).toFixed(1) : null;

  const text = [
    `SEIZURE DIARY SUMMARY — ${profile?.displayName || 'Patient'}`,
    `Period: ${formatDateShort(d.start)} to ${formatDateShort(d.end)} (${days} days)`,
    '',
    `Seizures: ${seizures.length} (≈${Math.round((seizures.length / days) * 300) / 10} per 30 days)`,
    ...Object.entries(seizures.reduce<Record<string, number>>((a, s) => ({ ...a, [s.type]: (a[s.type] ?? 0) + 1 }), {})).map(
      ([k, v]) => `  - ${SEIZURE_TYPE_LABELS[k as keyof typeof SEIZURE_TYPE_LABELS].label}: ${v}`,
    ),
    medianDuration != null ? `Median duration: ${formatDuration(medianDuration)}` : '',
    `Standalone warning signs (auras): ${d.auras.filter((a) => !a.seizureEventId).length}`,
    '',
    `Medication adherence (recorded doses): ${d.adherence.percent ?? '—'}%`,
    ...perMed.map(({ m, a }) => `  - ${m.name} ${m.dosage}${m.unit} at ${m.scheduledTimes.join(', ')}: ${a.percent ?? '—'}% (${a.skipped} skipped, ${a.unsure} unsure, ${a.notRecorded} not recorded)`),
    '',
    `Average sleep: ${d.avgSleep != null ? formatHours(d.avgSleep) : '—'}`,
    avgStress ? `Average self-rated stress: ${avgStress}/5 (${stressDays.length} days)` : '',
    d.triggers.length ? `Most-noted triggers: ${d.triggers.slice(0, 5).map((t) => `${t.tag.label} (${t.count})`).join(', ')}` : '',
    '',
    ...(d.insights.length ? ['Patterns (associations only):', ...d.insights.map((i) => `  - ${i.summary} [confidence: ${i.confidence}]`)] : []),
    '',
    'Self-reported data from the Steady app. Seizures with impaired awareness may be under-reported.',
  ]
    .filter((l, i, arr) => l !== '' || arr[i - 1] !== '')
    .join('\n');

  return (
    <div className="min-h-dvh bg-bg">
      <header className="no-print sticky top-0 z-10 border-b border-line bg-surface px-4 py-2">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center gap-2">
          <Button variant="ghost" icon={<ChevronLeft aria-hidden size={24} />} onClick={() => nav('/insights')}>
            Back
          </Button>
          <div className="flex-1" />
          <Button
            icon={<Copy aria-hidden size={20} />}
            onClick={async () => {
              const r = await webShare.shareText(text, 'Seizure diary summary');
              if (r === 'copied') toast('Summary copied as text.');
            }}
          >
            Share as text
          </Button>
          <Button variant="primary" icon={<Printer aria-hidden size={20} />} onClick={() => window.print()}>
            Print / save PDF
          </Button>
        </div>
        <div className="mx-auto mt-2 max-w-3xl">
          <Segmented
            label="Report period"
            hideLabel
            value={days}
            onChange={setDays}
            columns={4}
            options={[
              { value: 30, label: '30 days' },
              { value: 90, label: '90 days' },
              { value: 180, label: '6 months' },
              { value: 365, label: '1 year' },
            ]}
          />
        </div>
      </header>

      <main className="mx-auto max-w-3xl p-4 print:p-0">
        <article className="print-plain rounded-2xl border border-line bg-surface p-5 print:border-0 print:p-0">
          <header className="border-b-2 border-accent pb-3">
            <h1 className="text-2xl font-bold">Seizure diary summary</h1>
            <p>
              {profile?.displayName || 'Patient'}
              {profile?.dateOfBirth ? ` · born ${profile.dateOfBirth}` : ''}
              {profile?.seizureFocus ? ` · ${profile.seizureFocus}` : ''}
            </p>
            <p className="text-ink-2">
              {formatDateShort(d.start)} – {formatDateShort(d.end)} ({days} days) · generated {new Date().toLocaleDateString()}
            </p>
          </header>

          <section className="mt-4">
            <h2 className="text-lg font-bold">Overview</h2>
            <table className="mt-2 w-full border-collapse text-left">
              <tbody>
                {[
                  ['Seizures', `${seizures.length} (≈ ${Math.round((seizures.length / days) * 300) / 10} per 30 days)`],
                  ['Median duration', medianDuration != null ? formatDuration(medianDuration) : '—'],
                  ['Warning signs on their own', String(d.auras.filter((a) => !a.seizureEventId).length)],
                  ['Doses recorded as taken', d.adherence.percent == null ? '—' : `${d.adherence.percent}% of ${d.adherence.scheduled}`],
                  ['Average sleep', d.avgSleep != null ? formatHours(d.avgSleep) : '—'],
                  ['Average stress (self-rated)', avgStress ? `${avgStress} / 5` : '—'],
                ].map(([k, v]) => (
                  <tr key={k} className="border-b border-line">
                    <th scope="row" className="py-1.5 pr-3 font-normal text-ink-2">
                      {k}
                    </th>
                    <td className="py-1.5 font-bold">{v}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          {perMed.length > 0 && (
            <section className="mt-5">
              <h2 className="text-lg font-bold">Medications</h2>
              <table className="mt-2 w-full border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b-2 border-line">
                    <th className="py-1">Medication</th>
                    <th>Schedule</th>
                    <th>Taken</th>
                    <th>Skipped / unsure / not recorded</th>
                  </tr>
                </thead>
                <tbody>
                  {perMed.map(({ m, a }) => (
                    <tr key={m.id} className="border-b border-line">
                      <td className="py-1.5">
                        {m.name} {m.dosage}
                        {m.unit}
                      </td>
                      <td>{m.scheduledTimes.join(', ')}</td>
                      <td>{a.percent ?? '—'}%</td>
                      <td>
                        {a.skipped} / {a.unsure} / {a.notRecorded}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {meds.some((m) => m.sideEffectsNoted.length) && (
                <p className="mt-2 text-sm">
                  Side effects noted:{' '}
                  {meds
                    .filter((m) => m.sideEffectsNoted.length)
                    .map((m) => `${m.name}: ${m.sideEffectsNoted.join(', ')}`)
                    .join('; ')}
                </p>
              )}
            </section>
          )}

          {d.insights.length > 0 && (
            <section className="mt-5">
              <h2 className="text-lg font-bold">Patterns in the diary</h2>
              <ul className="mt-1 list-disc pl-6">
                {d.insights.map((i) => (
                  <li key={i.id}>
                    {i.summary} <span className="text-ink-2">(confidence: {i.confidence})</span>
                  </li>
                ))}
              </ul>
              <p className="mt-1 text-sm text-ink-2">Simple comparisons of the patient’s own records — associations, not causes.</p>
            </section>
          )}

          <section className="mt-5">
            <h2 className="text-lg font-bold">Seizure log</h2>
            {seizures.length === 0 ? (
              <p>No seizures logged in this period.</p>
            ) : (
              <table className="mt-2 w-full border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b-2 border-line">
                    <th className="py-1">Date</th>
                    <th>Type</th>
                    <th>Str.</th>
                    <th>Duration</th>
                    <th>Aura · triggers · after</th>
                  </tr>
                </thead>
                <tbody>
                  {seizures.map((s) => (
                    <tr key={s.id} className="border-b border-line align-top">
                      <td className="py-1.5 pr-2 whitespace-nowrap">
                        {formatDateShort(dateKeyOf(s.timestamp))} {formatIsoClock(s.timestamp)}
                      </td>
                      <td className="pr-2">{SEIZURE_TYPE_LABELS[s.type].label}</td>
                      <td className="pr-2">{s.severity}/5</td>
                      <td className="pr-2">{s.durationSeconds != null ? formatDuration(s.durationSeconds) : '—'}</td>
                      <td>
                        {[
                          s.triggerTagIds.map((t) => tagName.get(t)).filter(Boolean).join(', '),
                          s.postIctalSymptoms.map((p) => postName.get(p) ?? p).join(', '),
                          s.notes ?? '',
                        ]
                          .filter(Boolean)
                          .join(' · ') || '—'}
                        {s.rescueMedicationUsed && <strong> · rescue med used</strong>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>

          {d.auras.length > 0 && (
            <section className="mt-5">
              <h2 className="text-lg font-bold">Warning signs reported</h2>
              <p className="text-sm">
                {Object.entries(
                  d.auras.flatMap((a) => a.symptoms).reduce<Record<string, number>>((acc, s) => ({ ...acc, [s]: (acc[s] ?? 0) + 1 }), {}),
                )
                  .sort((a, b) => b[1] - a[1])
                  .map(([k, v]) => `${auraName.get(k) ?? k} (${v})`)
                  .join(', ')}
              </p>
            </section>
          )}

          <footer className="mt-6 border-t border-line pt-3 text-sm text-ink-2">
            Self-reported data from the Steady app, kept on the patient’s own device. Seizures with impaired awareness may be under-reported. This
            summary is not a diagnosis or treatment recommendation.
          </footer>
        </article>
      </main>
    </div>
  );
}
