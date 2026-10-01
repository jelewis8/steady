import { useEffect, useMemo, useState } from 'react';
import { FileText, Lightbulb } from 'lucide-react';
import { SEIZURE_TYPE_LABELS } from '../../core/defaults';
import type { Insight } from '../../core/insights';
import { addDays, dateRange, formatDateShort, formatHours, fromDateKey } from '../../core/time';
import { useBathroomLogs, useDoseChanges, useInsightRules, usePrefs } from '../../data/hooks';
import { persistInsights, setInsightDismissed } from '../../data/repo';
import { toast } from '../../state/ui';
import { BarChart, ChartFrame, HBars } from '../../ui/charts';
import { Button, Card, CardTitle, Disclaimer, LinkButton, PageHeader, Segmented, Stat, cx } from '../../ui/kit';
import { BathroomMedCard } from './BathroomMedCard';
import { useInsightData } from './useInsightData';

const RANGES = [
  { value: 30, label: '30 days' },
  { value: 90, label: '90 days' },
  { value: 180, label: '6 months' },
  { value: 365, label: '1 year' },
];

function InsightCard({ insight, onDismiss }: { insight: Insight; onDismiss: () => void }) {
  const [more, setMore] = useState(false);
  return (
    <Card tone="accent" as="article">
      <h3 className="flex items-center gap-2 font-bold">
        <Lightbulb aria-hidden size={20} />
        {insight.title}
      </h3>
      <p className="mt-1 text-lg">{insight.summary}</p>
      {more && <p className="mt-2">{insight.detail}</p>}
      <p className="mt-2 text-sm">
        Confidence: <strong>{insight.confidence}</strong>
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        <Button variant="ghost" aria-expanded={more} onClick={() => setMore((v) => !v)}>
          {more ? 'Show less' : 'Tell me more'}
        </Button>
        <Button variant="ghost" onClick={onDismiss}>
          Dismiss
        </Button>
      </div>
    </Card>
  );
}

function Heatmap({ map, start, end }: { map: Map<string, { percent: number | null; scheduled: number }>; start: string; end: string }) {
  const from = addDays(end, -83) > start ? addDays(end, -83) : start;
  const days = dateRange(from, end);
  const lead = (fromDateKey(from).getDay() + 6) % 7; // Monday-first grid
  const symbol = (p: number | null) => (p == null ? '' : p === 100 ? '✓' : p >= 50 ? '◐' : '○');
  const cls = (p: number | null) =>
    p == null ? 'border-line bg-surface' : p === 100 ? 'border-accent bg-accent text-accent-ink' : p >= 50 ? 'border-accent bg-accent-soft text-accent-text' : 'border-attn-line bg-attn-bg text-attn-ink';
  return (
    <ChartFrame
      title="Medication doses taken per day"
      description="Tick means every dose taken, half circle means at least half, open circle means fewer than half, blank means nothing scheduled."
      table={{
        columns: ['Date', 'Doses taken'],
        rows: days
          .filter((d) => (map.get(d)?.scheduled ?? 0) > 0)
          .reverse()
          .map((d) => [formatDateShort(d), `${map.get(d)?.percent ?? 0}%`]),
      }}
    >
      <div className="grid grid-cols-7 gap-1">
        {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
          <div key={i} className="text-center text-xs font-bold text-ink-2">
            {d}
          </div>
        ))}
        {Array.from({ length: lead }, (_, i) => (
          <div key={`e${i}`} />
        ))}
        {days.map((d) => {
          const a = map.get(d);
          const p = a && a.scheduled > 0 ? a.percent : null;
          return (
            <div key={d} className={cx('flex aspect-square items-center justify-center rounded-md border-2 text-sm font-bold', cls(p))} title={`${formatDateShort(d)}: ${p == null ? 'nothing scheduled' : `${p}%`}`}>
              {symbol(p)}
            </div>
          );
        })}
      </div>
      <p className="mt-2 text-sm text-ink-2">✓ all doses · ◐ half or more · ○ fewer than half · blank: nothing scheduled</p>
    </ChartFrame>
  );
}

export function InsightsPage() {
  const [days, setDays] = useState(90);
  const d = useInsightData(days);
  const rules = useInsightRules();
  const bathroomLogs = useBathroomLogs();
  const doseChanges = useDoseChanges();
  const showBathroom = !!usePrefs()?.trackBathroom || bathroomLogs.length > 0;
  const dismissed = useMemo(() => new Set(rules.filter((r) => r.dismissedByUser).map((r) => String(r.variables?.key))), [rules]);
  const visible = d.insights.filter((i) => !dismissed.has(`${i.correlationType}:${i.title}`));

  useEffect(() => {
    void persistInsights(d.insights, days);
  }, [d.insights, days]);

  const per30 = d.seizures.length ? Math.round((d.seizures.length / days) * 30 * 10) / 10 : 0;
  const typeCounts = Object.entries(
    d.seizures.reduce<Record<string, number>>((acc, s) => ({ ...acc, [s.type]: (acc[s.type] ?? 0) + 1 }), {}),
  ).map(([k, v]) => ({ label: SEIZURE_TYPE_LABELS[k as keyof typeof SEIZURE_TYPE_LABELS].label, value: v }));

  return (
    <div className="grid gap-4">
      <PageHeader title="Insights" subtitle="Patterns from your own records, in plain language." />
      <Segmented label="Time range" value={days} onChange={setDays} columns={4} options={RANGES} />

      <Card labelledBy="sum-h">
        <CardTitle id="sum-h">Summary</CardTitle>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Stat label="Seizures" value={d.seizures.length} sub={`≈ ${per30} per 30 days`} />
          <Stat label="Warning signs" value={d.auras.filter((a) => !a.seizureEventId).length} sub="on their own" />
          <Stat label="Doses taken" value={d.adherence.percent == null ? '—' : `${d.adherence.percent}%`} />
          <Stat label="Average sleep" value={d.avgSleep == null ? '—' : formatHours(d.avgSleep)} />
        </div>
      </Card>

      <section aria-labelledby="key-h" className="grid gap-3">
        <h2 id="key-h" className="text-xl font-bold">
          Key insights
        </h2>
        {!d.readiness.ready && visible.length === 0 ? (
          <Card>
            <p>
              Insights appear once there’s enough to compare — roughly two weeks of logging and a few seizures. So far: {d.readiness.trackedDays} days
              with data and {d.readiness.seizures} seizures in this range.
            </p>
            <p className="mt-2 text-ink-2">Logging sleep and ticking off doses is the most useful thing you can do.</p>
          </Card>
        ) : visible.length === 0 ? (
          <Card>
            <p>No clear patterns in this range. That’s useful to know, too.</p>
          </Card>
        ) : (
          visible.map((i) => (
            <InsightCard
              key={`${i.correlationType}:${i.title}`}
              insight={i}
              onDismiss={async () => {
                await setInsightDismissed(i.correlationType, i.title, true);
                toast('Insight dismissed.', () => setInsightDismissed(i.correlationType, i.title, false));
              }}
            />
          ))
        )}
      </section>

      <Card labelledBy="freq-h">
        <CardTitle id="freq-h">Seizures over time</CardTitle>
        <ChartFrame
          title="Seizures over time"
          description={`${d.seizures.length} seizures between ${formatDateShort(d.start)} and ${formatDateShort(d.end)}.`}
          table={{ columns: [days <= 31 ? 'Day' : 'Week', 'Seizures'], rows: d.buckets.map((b) => [b.label, b.count]) }}
        >
          <BarChart data={d.buckets.map((b) => ({ label: b.label.replace('Wk of ', ''), value: b.count }))} />
        </ChartFrame>
        {typeCounts.length > 0 && (
          <div className="mt-4">
            <h3 className="mb-2 font-bold">By type</h3>
            <HBars data={typeCounts} />
          </div>
        )}
      </Card>

      <Card labelledBy="sleep-h">
        <CardTitle id="sleep-h">Sleep and seizures</CardTitle>
        <p className="mb-3 text-ink-2">Seizures per 30 days, grouped by how long you slept the night before.</p>
        <ChartFrame
          title="Seizure rate by sleep the night before"
          description="Striped bar is nights under 6 hours."
          table={{ columns: ['Sleep the night before', 'Nights', 'Seizures', 'Per 30 days'], rows: d.sleepBands.map((b) => [b.label, b.nights, b.seizures, b.per30]) }}
        >
          <BarChart data={d.sleepBands.map((b, i) => ({ label: `${b.label} (${b.nights})`, value: b.per30, highlight: i === 0 }))} valueLabel={(v) => v.toFixed(1)} />
        </ChartFrame>
        <p className="mt-1 text-sm text-ink-2">Number of nights in brackets. Fewer than 5 nights in a group isn’t much to go on.</p>
      </Card>

      <Card labelledBy="adh-h">
        <CardTitle id="adh-h">Medication</CardTitle>
        <Heatmap map={d.adherenceByDay} start={d.start} end={d.end} />
      </Card>

      {showBathroom && <BathroomMedCard logs={bathroomLogs} meds={d.meds} doseChanges={doseChanges} start={d.start} end={d.end} />}

      <Card labelledBy="trig-h">
        <CardTitle id="trig-h">Triggers you noted</CardTitle>
        {d.triggers.length === 0 ? (
          <p className="text-ink-2">No triggers tagged in this range.</p>
        ) : (
          <HBars data={d.triggers.slice(0, 8).map((t) => ({ label: t.tag.label, value: t.count }))} />
        )}
      </Card>

      <Card labelledBy="tod-h">
        <CardTitle id="tod-h">Time of day</CardTitle>
        <HBars data={d.timeOfDay.map((b) => ({ label: b.label, value: b.count }))} />
      </Card>

      <LinkButton to={`/insights/report?days=${days}`} variant="primary" size="lg" icon={<FileText aria-hidden size={22} />}>
        Make a report for my neurologist
      </LinkButton>
      <Disclaimer>
        Insights show associations in your own records — they can’t prove a cause, and they aren’t medical advice. Seizures where awareness was lost
        may be under-counted. Talk through anything you notice with your care team.
      </Disclaimer>
    </div>
  );
}
