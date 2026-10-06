import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ChevronLeft, Copy, Printer } from 'lucide-react';
import { AURA_SYMPTOMS, POST_ICTAL_SYMPTOMS, SEIZURE_TYPE_LABELS } from '../../core/defaults';
import { adherence, doseNotesForReport } from '../../core/stats';
import { describeSideEffectDates, groupSideEffects, pastMedicationsForReport, SEVERITY_TEXT } from '../../core/sideEffects';
import { dateKeyOf, formatDateShort, formatDuration, formatHours, formatIsoClock } from '../../core/time';
import { useBathroomLogs, useDoseChanges, useDoses, usePrefs, useProfile, useSideEffects, useTriggerTags } from '../../data/hooks';
import { BOWEL_BLADDER_NOTE, BOWEL_HOW_LABELS, compareAroundMedicationDates, comparisonRows, comparisonTitle, summarizeBathroom } from '../../core/bathroom';
import { describeChange, sortDoseChanges } from '../../core/doseChanges';
import { reportWho } from '../../core/reportWho';
import { feelingsLines, summarizeFeelings } from '../../core/feelings';
import { webShare } from '../../platform/share';
import { toast } from '../../state/ui';
import { Button, Segmented } from '../../ui/kit';
import { useInsightData } from './useInsightData';
import { scheduleText } from '../../core/medSchedule';

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
  const [withFeelingNotes, setWithFeelingNotes] = useState(false);
  const who = reportWho(profile?.displayName);
  const feelings = summarizeFeelings(d.checkIns, d.start, d.end);
  const feelingLines = feelingsLines(feelings);
  const bathroomLogs = useBathroomLogs();
  const trackBathroom = !!usePrefs()?.trackBathroom;
  const bath = summarizeBathroom(bathroomLogs, d.start, d.end);
  const showBath = bath.hasAnything && (trackBathroom || bathroomLogs.length > 0);
  const bathLines = showBath
    ? [
        `Bowel movements recorded on ${bath.bowelDays} ${bath.bowelDays === 1 ? 'day' : 'days'}; recorded as none on ${bath.noBowelDays}.`,
        bath.longestGapDays != null ? `Longest stretch without one: ${bath.longestGapDays} ${bath.longestGapDays === 1 ? 'day' : 'days'}.` : '',
        bath.bowelDays ? `How they were: ${(['normal', 'hard', 'loose'] as const).map((k) => `${BOWEL_HOW_LABELS[k].toLowerCase()} ${bath.how[k]}`).join(', ')}.` : '',
        bath.bladderAverage != null ? `Urination: about ${bath.bladderAverage} times a day, on the ${bath.bladderDays} ${bath.bladderDays === 1 ? 'day' : 'days'} it was counted.` : '',
      ].filter(Boolean)
    : [];
  const doseChanges = useDoseChanges();
  const doseChangesInRange = sortDoseChanges(doseChanges.filter((c) => c.date >= d.start && c.date <= d.end && d.meds.some((m) => m.id === c.medicationId)));
  const medName = (id: string) => d.meds.find((m) => m.id === id)?.name ?? 'Medication';
  const bathCompare = showBath ? compareAroundMedicationDates(bathroomLogs, d.meds, d.start, d.end, undefined, doseChanges) : [];
  const bathCompareText = bathCompare.flatMap((c) => [
    `  - ${comparisonTitle(c, formatDateShort)}:${c.enough ? '' : ' not enough records on both sides to compare.'}`,
    ...(c.enough ? comparisonRows(c).map(([label, b, a]) => `      ${label}: before ${b}; from that day ${a}`) : []),
    ...(c.otherChanges.length ? [`      Also in these weeks: ${c.otherChanges.join(', ')}.`] : []),
  ]);
  const allSideEffects = useSideEffects();
  const sideEffectGroups = groupSideEffects(allSideEffects, d.meds);
  const pastMeds = pastMedicationsForReport(d.meds, allSideEffects);
  const meds = d.meds.filter((m) => m.isActive);
  const perMed = meds
    .filter((m) => !m.isRescue)
    .map((m) => ({ m, a: adherence(allDoses.filter((x) => x.medicationId === m.id), d.start, d.end) }));
  const doseNotes = doseNotesForReport(allDoses, d.meds);
  const seizures = [...d.seizures].sort((a, b) => (a.timestamp < b.timestamp ? -1 : 1));
  const withDuration = seizures.filter((s) => s.durationSeconds != null);
  const medianDuration = withDuration.length
    ? [...withDuration].sort((a, b) => a.durationSeconds! - b.durationSeconds!)[Math.floor(withDuration.length / 2)].durationSeconds!
    : null;
  const stressDays = d.checkIns.filter((c) => c.date >= d.start && c.date <= d.end && c.stress != null);
  const avgStress = stressDays.length ? (stressDays.reduce((a, c) => a + (c.stress ?? 0), 0) / stressDays.length).toFixed(1) : null;

  const text = [
    `SEIZURE DIARY SUMMARY${who.name ? ` — ${who.name}` : ''}`,
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
    ...perMed.map(({ m, a }) => `  - ${m.name} ${m.dosage}${m.unit} at ${scheduleText(m)}: ${a.percent ?? '—'}% (${a.skipped} skipped, ${a.unsure} unsure, ${a.notRecorded} not recorded)`),
    '',
    ...(feelingLines.length
      ? [
          'Mood and anxiety (self-rated):',
          ...feelingLines.map((l) => `  - ${l}`),
          ...(withFeelingNotes && feelings.notes.length ? [`  ${who.Possessive} own notes:`, ...feelings.notes.map((n) => `    ${formatDateShort(n.date)}: ${n.text}`)] : []),
          '',
        ]
      : []),
    ...(bathLines.length
      ? [
          'Bowel and bladder (self-reported):',
          ...bathLines.map((l) => `  - ${l}`),
          ...(bathCompareText.length ? ['  Around medication start, stop and dose-change dates (14 days before, and from that day):', ...bathCompareText, `  Note: ${BOWEL_BLADDER_NOTE}`] : []),
          '',
        ]
      : []),
    ...(sideEffectGroups.length
      ? [
          'Side effects noted (all dates):',
          ...sideEffectGroups.flatMap((g) =>
            g.entries.map((e) => `  - ${g.medication ? `${g.medication.name} ${g.medication.dosage}${g.medication.unit}` : 'Medication not known'}: ${e.name}${e.severity ? ` (${SEVERITY_TEXT[e.severity].toLowerCase()})` : ''}, ${describeSideEffectDates(e).toLowerCase()}${e.notes ? ` — ${e.notes}` : ''}`),
          ),
          '',
        ]
      : []),
    ...(doseChangesInRange.length
      ? [`Dose changes recorded (by ${who.by}):`, ...doseChangesInRange.map((c) => `  - ${formatDateShort(c.date)}, ${medName(c.medicationId)}: ${describeChange(c)}${c.note ? ` (${c.note})` : ''}`), '']
      : []),
    ...(pastMeds.length
      ? [
          'Past medications and why they were stopped:',
          ...pastMeds.map((r) => `  - ${r.medication.name} ${r.medication.dosage}${r.medication.unit}: ${r.reasonText}${r.note ? ` (${r.note})` : ''}. ${r.period}${r.sideEffects.length ? `. Side effects: ${r.sideEffects.map((e) => e.name).join(', ')}` : ''}`),
          '',
        ]
      : []),
    ...(doseNotes.length
      ? ['Notes recorded with doses:', ...doseNotes.map((n) => `  - ${formatDateShort(dateKeyOf(n.when))} ${formatIsoClock(n.when)}, ${n.medication}: ${[n.note, n.sideEffects.length ? `side effects: ${n.sideEffects.join(', ')}` : ''].filter(Boolean).join(' · ')}`), '']
      : []),
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
          {feelings.notes.length > 0 && (
            <Button aria-pressed={withFeelingNotes} onClick={() => setWithFeelingNotes((v) => !v)}>
              {withFeelingNotes ? '✓ ' : ''}Include my notes about feelings
            </Button>
          )}
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
            <p>{[who.name, profile?.dateOfBirth ? `born ${profile.dateOfBirth}` : '', profile?.seizureFocus ?? ''].filter(Boolean).join(' · ')}</p>
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
                      <td>{scheduleText(m)}</td>
                      <td>{a.percent ?? '—'}%</td>
                      <td>
                        {a.skipped} / {a.unsure} / {a.notRecorded}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          )}

          {feelingLines.length > 0 && (
            <section className="mt-5">
              <h2 className="text-lg font-bold">Mood and anxiety</h2>
              <p className="text-sm text-ink-2">Self-rated by {who.by} from 1 to 5, for this period. Depression and anxiety are more common in people with epilepsy, so this is shared for the care team to see. It is not a screening result or a diagnosis.</p>
              <ul className="mt-1 list-disc pl-6">
                {feelingLines.map((l) => (
                  <li key={l}>{l}</li>
                ))}
              </ul>
              {withFeelingNotes && feelings.notes.length > 0 && (
                <div className="mt-2">
                  <h3 className="font-bold">{who.Possessive} own notes</h3>
                  <ul className="mt-1 grid gap-1">
                    {feelings.notes.map((n) => (
                      <li key={n.date}>
                        <strong>{formatDateShort(n.date)}:</strong> {n.text}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </section>
          )}

          {bathLines.length > 0 && (
            <section className="mt-5">
              <h2 className="text-lg font-bold">Bowel and bladder</h2>
              <p className="text-sm text-ink-2">Self-reported, for this period. Days with nothing recorded are not counted.</p>
              <ul className="mt-1 list-disc pl-6">
                {bathLines.map((l) => (
                  <li key={l}>{l}</li>
                ))}
              </ul>
              {bathCompare.length > 0 && (
                <div className="mt-3">
                  <h3 className="font-bold">Around medication start, stop and dose-change dates</h3>
                  <p className="text-sm text-ink-2">The 14 days before, and from, the date saved with the medication.</p>
                  {bathCompare.map((c) => (
                    <div key={`${c.medicationId}-${c.event}-${c.date}`} className="mt-2">
                      <p className="font-bold">
                        {comparisonTitle(c, formatDateShort)}
                      </p>
                      {c.enough ? (
                        <table className="w-full border-collapse text-left text-sm">
                          <caption className="sr-only">
                            {comparisonTitle(c, formatDateShort)}: records before and after
                          </caption>
                          <thead>
                            <tr className="border-b border-line">
                              <th scope="col" className="py-1 pr-2">&nbsp;</th>
                              <th scope="col" className="py-1 pr-2">Before</th>
                              <th scope="col" className="py-1">From that day</th>
                            </tr>
                          </thead>
                          <tbody>
                            {comparisonRows(c).map(([label, b, a]) => (
                              <tr key={label} className="border-b border-line align-top">
                                <th scope="row" className="py-1 pr-2 font-normal">{label}</th>
                                <td className="py-1 pr-2">{b}</td>
                                <td className="py-1">{a}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      ) : (
                        <p className="text-sm text-ink-2">Not enough records on both sides to compare.</p>
                      )}
                      {c.otherChanges.length > 0 && <p className="text-sm text-ink-2">Also in these weeks: {c.otherChanges.join(', ')}.</p>}
                    </div>
                  ))}
                  <p className="mt-2 text-sm text-ink-2">{BOWEL_BLADDER_NOTE}</p>
                </div>
              )}
            </section>
          )}

          {sideEffectGroups.length > 0 && (
            <section className="mt-5">
              <h2 className="text-lg font-bold">Side effects noted</h2>
              <p className="text-sm text-ink-2">All dates, as recorded by {who.by}. “Start date unknown” means it was noted without a date.</p>
              <table className="mt-2 w-full border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b-2 border-line">
                    <th className="py-1">Medication</th>
                    <th>Side effect</th>
                    <th>Strength</th>
                    <th>When</th>
                  </tr>
                </thead>
                <tbody>
                  {sideEffectGroups.flatMap((g) =>
                    g.entries.map((e) => (
                      <tr key={e.id} className="border-b border-line align-top">
                        <td className="py-1.5 pr-2">{g.medication ? `${g.medication.name} ${g.medication.dosage}${g.medication.unit}` : 'Not sure which'}</td>
                        <td className="pr-2">
                          {e.name}
                          {e.notes && <span className="text-ink-2"> — {e.notes}</span>}
                        </td>
                        <td className="pr-2">{e.severity ? SEVERITY_TEXT[e.severity] : '—'}</td>
                        <td>{describeSideEffectDates(e)}</td>
                      </tr>
                    )),
                  )}
                </tbody>
              </table>
            </section>
          )}

          {doseChangesInRange.length > 0 && (
            <section className="mt-5">
              <h2 className="text-lg font-bold">Dose changes recorded</h2>
              <p className="text-sm text-ink-2">Entered by {who.by}, with the day the new dose started.</p>
              <table className="mt-2 w-full border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-line">
                    <th scope="col" className="py-1 pr-2">From</th>
                    <th scope="col" className="py-1 pr-2">Medication</th>
                    <th scope="col" className="py-1 pr-2">Change</th>
                    <th scope="col" className="py-1">Note</th>
                  </tr>
                </thead>
                <tbody>
                  {doseChangesInRange.map((c) => (
                    <tr key={c.id} className="border-b border-line align-top">
                      <th scope="row" className="py-1 pr-2 font-normal">{formatDateShort(c.date)}</th>
                      <td className="py-1 pr-2">{medName(c.medicationId)}</td>
                      <td className="py-1 pr-2">{describeChange(c)}</td>
                      <td className="py-1">{c.note ?? ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          )}

          {pastMeds.length > 0 && (
            <section className="mt-5">
              <h2 className="text-lg font-bold">Past medications and why they were stopped</h2>
              <table className="mt-2 w-full border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b-2 border-line">
                    <th className="py-1">Medication</th>
                    <th>When</th>
                    <th>Why it was stopped</th>
                  </tr>
                </thead>
                <tbody>
                  {pastMeds.map((r) => (
                    <tr key={r.medication.id} className="border-b border-line align-top">
                      <td className="py-1.5 pr-2">
                        {r.medication.name} {r.medication.dosage}
                        {r.medication.unit}
                      </td>
                      <td className="pr-2">{r.period}</td>
                      <td>
                        <strong>{r.reasonText}</strong>
                        {r.note && <span> — {r.note}</span>}
                        {r.sideEffects.length > 0 && <div className="text-ink-2">Side effects noted: {r.sideEffects.map((e) => e.name).join(', ')}</div>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          )}

          {doseNotes.length > 0 && (
            <section className="mt-5">
              <h2 className="text-lg font-bold">Notes recorded with doses</h2>
              <table className="mt-2 w-full border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b-2 border-line">
                    <th className="py-1">Date</th>
                    <th>Medication</th>
                    <th>Note</th>
                  </tr>
                </thead>
                <tbody>
                  {doseNotes.map((n) => (
                    <tr key={n.doseId} className="border-b border-line align-top">
                      <td className="py-1.5 pr-2 whitespace-nowrap">
                        {formatDateShort(dateKeyOf(n.when))} {formatIsoClock(n.when)}
                      </td>
                      <td className="pr-2">{n.medication}</td>
                      <td>
                        {n.note}
                        {n.sideEffects.length > 0 && (
                          <>
                            {n.note && ' · '}
                            <strong>Side effects:</strong> {n.sideEffects.join(', ')}
                          </>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
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
              <p className="mt-1 text-sm text-ink-2">Simple comparisons of {who.possessive} own records — associations, not causes.</p>
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
            Self-reported data from the Steady app, kept on {who.possessive} own device. Seizures with impaired awareness may be under-reported. This
            summary is not a diagnosis or treatment recommendation.
          </footer>
        </article>
      </main>
    </div>
  );
}
