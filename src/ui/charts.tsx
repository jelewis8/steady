/**
 * Accessible, static SVG charts. No animation, patterns + labels in addition to colour,
 * and every chart has a "View as table" alternative (blueprint §2.5 Screen 4).
 */
import { useId, useState, type ReactNode } from 'react';
import { Button } from './kit';

export function ChartFrame({
  title,
  description,
  table,
  children,
}: {
  title: string;
  description: string;
  table: { columns: string[]; rows: (string | number)[][] };
  children: ReactNode;
}) {
  const [asTable, setAsTable] = useState(false);
  const id = useId();
  return (
    <figure aria-labelledby={`${id}-t`} className="m-0">
      <figcaption id={`${id}-t`} className="sr-only">
        {title}. {description}
      </figcaption>
      {asTable ? (
        <div className="max-h-96 overflow-auto rounded-xl border border-line">
          <table className="w-full border-collapse text-left">
            <caption className="sr-only">{title}</caption>
            <thead className="sticky top-0 bg-surface-2">
              <tr>
                {table.columns.map((c) => (
                  <th key={c} scope="col" className="border-b border-line px-3 py-2">
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {table.rows.map((r, i) => (
                <tr key={i} className="border-b border-line">
                  {r.map((c, j) =>
                    j === 0 ? (
                      <th key={j} scope="row" className="px-3 py-1.5 font-normal">
                        {c}
                      </th>
                    ) : (
                      <td key={j} className="px-3 py-1.5 tabular-nums">
                        {c}
                      </td>
                    ),
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div aria-hidden>{children}</div>
      )}
      <Button variant="ghost" className="mt-2" aria-pressed={asTable} onClick={() => setAsTable((v) => !v)}>
        {asTable ? 'View as chart' : 'View as table'}
      </Button>
    </figure>
  );
}

const HATCH = 'repeating-linear-gradient(45deg, var(--chart-2) 0 3px, transparent 3px 7px)';

/** Vertical bar chart with value labels, drawn with plain boxes (crisp at any size, no stretching text). */
export function BarChart({
  data,
  height = 180,
  valueLabel = (v: number) => String(v),
  target,
}: {
  data: { label: string; value: number; highlight?: boolean }[];
  height?: number;
  valueLabel?: (v: number) => string;
  target?: { value: number; label: string };
}) {
  const max = Math.max(1, target?.value ?? 0, ...data.map((d) => d.value)) * 1.12;
  const labelEvery = Math.ceil(data.length / 7);
  const showValues = data.length <= 16;
  return (
    <div className="w-full">
      <div className="relative flex items-end gap-[2px] border-b-2 border-line-strong" style={{ height }}>
        {target && (
          <div className="pointer-events-none absolute inset-x-0 border-t-2 border-dashed border-ink-2" style={{ bottom: `${(target.value / max) * 100}%` }}>
            <span className="absolute -top-5 right-0 text-xs text-ink-2">{target.label}</span>
          </div>
        )}
        {data.map((d, i) => (
          <div key={i} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end">
            {showValues && d.value > 0 && <span className="mb-0.5 text-xs font-bold">{valueLabel(d.value)}</span>}
            <div
              className="w-full max-w-10 rounded-t-md"
              style={{
                height: `${(d.value / max) * 100}%`,
                background: d.highlight ? HATCH : 'var(--chart-1)',
                border: d.highlight ? '2px solid var(--chart-2)' : 'none',
              }}
            />
          </div>
        ))}
      </div>
      <div className="mt-1 flex gap-[2px]">
        {data.map((d, i) => (
          <div key={i} className="min-w-0 flex-1 overflow-visible text-xs whitespace-nowrap text-ink-2">
            {i % labelEvery === 0 ? d.label : ''}
          </div>
        ))}
      </div>
    </div>
  );
}
/** Horizontal bars — rankings. Labels are text; bars are decoration. */
export function HBars({ data, unit = '' }: { data: { label: string; value: number; sub?: string }[]; unit?: string }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <ul className="grid gap-2">
      {data.map((d) => (
        <li key={d.label} className="grid grid-cols-[minmax(7rem,40%)_1fr] items-center gap-3">
          <span className="truncate font-bold" title={d.label}>
            {d.label}
            {d.sub && <span className="block text-sm font-normal text-ink-2">{d.sub}</span>}
          </span>
          <span className="flex items-center gap-2">
            <span className="h-6 rounded-md border-2 border-accent bg-accent" style={{ width: `${(d.value / max) * 85}%`, minWidth: d.value > 0 ? 6 : 0 }} />
            <span className="font-bold tabular-nums">
              {d.value}
              {unit}
            </span>
          </span>
        </li>
      ))}
    </ul>
  );
}
