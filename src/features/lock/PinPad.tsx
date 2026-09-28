import { Delete } from 'lucide-react';
import { useEffect } from 'react';

/** Large on-screen number pad (also accepts a physical keyboard). */
export function PinPad({ value, onChange, onSubmit, max = 8, label }: { value: string; onChange: (v: string) => void; onSubmit: () => void; max?: number; label: string }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (/^\d$/.test(e.key) && value.length < max) onChange(value + e.key);
      else if (e.key === 'Backspace') onChange(value.slice(0, -1));
      else if (e.key === 'Enter' && value.length >= 4) onSubmit();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [value, onChange, onSubmit, max]);

  const key = 'tap flex h-16 items-center justify-center rounded-2xl border-2 border-line-strong bg-surface text-2xl font-bold hover:bg-surface-2';
  return (
    <div className="grid gap-4">
      <div className="flex justify-center gap-3" role="img" aria-label={`${label}: ${value.length} digits entered`}>
        {Array.from({ length: Math.max(4, value.length) }, (_, i) => (
          <span key={i} className={`h-5 w-5 rounded-full border-2 border-ink ${i < value.length ? 'bg-ink' : ''}`} />
        ))}
      </div>
      <div className="mx-auto grid w-full max-w-xs grid-cols-3 gap-3">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
          <button key={d} type="button" className={key} onClick={() => value.length < max && onChange(value + d)}>
            {d}
          </button>
        ))}
        <button type="button" className={key} aria-label="Delete last digit" onClick={() => onChange(value.slice(0, -1))}>
          <Delete aria-hidden size={26} />
        </button>
        <button type="button" className={key} onClick={() => value.length < max && onChange(value + '0')}>
          0
        </button>
        <button type="button" className={`${key} border-accent bg-accent text-accent-ink`} disabled={value.length < 4} onClick={onSubmit}>
          OK
        </button>
      </div>
    </div>
  );
}
