/**
 * Component library. Every control: ≥48px target, visible focus, accessible name,
 * and never relies on colour alone.
 */
import {
  forwardRef,
  useEffect,
  useId,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ChevronLeft, Info, X } from 'lucide-react';

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ');

type Variant = 'primary' | 'secondary' | 'ghost' | 'sos' | 'quiet';
const variants: Record<Variant, string> = {
  primary: 'bg-accent text-accent-ink border-2 border-accent hover:opacity-90',
  secondary: 'bg-surface text-ink border-2 border-line-strong hover:bg-surface-2',
  ghost: 'bg-transparent text-accent-text border-2 border-transparent hover:bg-accent-soft',
  quiet: 'bg-surface-2 text-ink border-2 border-transparent hover:border-line',
  sos: 'bg-sos text-sos-ink border-2 border-sos hover:opacity-90',
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: 'md' | 'lg' | 'xl';
  icon?: ReactNode;
  block?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'secondary', size = 'md', icon, block, className, children, type = 'button', ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      className={cx(
        'tap ease-calm inline-flex items-center justify-center gap-2 rounded-xl font-bold select-none',
        'disabled:cursor-not-allowed disabled:opacity-50',
        size === 'md' && 'px-4 text-base',
        size === 'lg' && 'px-5 py-3 text-lg',
        size === 'xl' && 'px-6 py-4 text-xl',
        block && 'w-full',
        variants[variant],
        className,
      )}
      {...rest}
    >
      {icon}
      {children}
    </button>
  );
});

export function LinkButton({
  to,
  variant = 'secondary',
  size = 'md',
  icon,
  block,
  className,
  children,
  ...rest
}: { to: string; variant?: Variant; size?: 'md' | 'lg' | 'xl'; icon?: ReactNode; block?: boolean; className?: string; children: ReactNode } & Omit<
  React.AnchorHTMLAttributes<HTMLAnchorElement>,
  'href'
>) {
  return (
    <Link
      to={to}
      className={cx(
        'tap ease-calm inline-flex items-center justify-center gap-2 rounded-xl font-bold no-underline',
        size === 'md' && 'px-4 text-base',
        size === 'lg' && 'px-5 py-3 text-lg',
        size === 'xl' && 'px-6 py-4 text-xl',
        block && 'w-full',
        variants[variant],
        className,
      )}
      {...rest}
    >
      {icon}
      {children}
    </Link>
  );
}

export function IconButton({ label, children, className, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cx('tap ease-calm inline-flex items-center justify-center rounded-xl text-ink hover:bg-surface-2', className)}
      {...rest}
    >
      {children}
    </button>
  );
}

export function Card({
  children,
  className,
  as: As = 'section',
  labelledBy,
  tone = 'default',
}: {
  children: ReactNode;
  className?: string;
  as?: 'section' | 'div' | 'article' | 'li';
  labelledBy?: string;
  tone?: 'default' | 'attn' | 'accent' | 'ok';
}) {
  return (
    <As
      aria-labelledby={labelledBy}
      className={cx(
        'print-plain rounded-2xl border p-4 sm:p-5',
        tone === 'default' && 'border-line bg-surface shadow-[var(--shadow)]',
        tone === 'attn' && 'border-attn-line bg-attn-bg text-attn-ink',
        tone === 'accent' && 'border-accent bg-accent-soft',
        tone === 'ok' && 'border-line bg-ok-bg text-ok-ink',
        className,
      )}
    >
      {children}
    </As>
  );
}

export function CardTitle({ id, children, action, icon }: { id?: string; children: ReactNode; action?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <h2 id={id} className="flex items-center gap-2 text-lg font-bold">
        {icon}
        {children}
      </h2>
      {action}
    </div>
  );
}

export function PageHeader({ title, back, action, subtitle }: { title: string; back?: string | true; action?: ReactNode; subtitle?: string }) {
  const nav = useNavigate();
  return (
    <div className="mb-4 flex items-start gap-2">
      {back && (
        <IconButton label="Go back" onClick={() => (back === true ? nav(-1) : nav(back))} className="-ml-2 shrink-0">
          <ChevronLeft aria-hidden size={28} />
        </IconButton>
      )}
      <div className="min-w-0 flex-1 pt-1.5">
        <h1 className="text-2xl leading-tight font-bold sm:text-3xl">{title}</h1>
        {subtitle && <p className="mt-1 text-ink-2">{subtitle}</p>}
      </div>
      {action && <div className="shrink-0 pt-1">{action}</div>}
    </div>
  );
}

export function Field({ label, hint, children, id }: { label: ReactNode; hint?: ReactNode; children: (id: string, describedBy?: string) => ReactNode; id?: string }) {
  const auto = useId();
  const fid = id ?? auto;
  const hid = hint ? `${fid}-hint` : undefined;
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={fid} className="font-bold">
        {label}
      </label>
      {hint && (
        <p id={hid} className="-mt-1 text-sm text-ink-2">
          {hint}
        </p>
      )}
      {children(fid, hid)}
    </div>
  );
}

const inputClass =
  'tap w-full rounded-xl border-2 border-line-strong bg-surface px-3 py-2 text-base text-ink placeholder:text-ink-2/70 focus:border-accent';

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input({ className, ...rest }, ref) {
  return <input ref={ref} className={cx(inputClass, className)} {...rest} />;
});

export function TextArea({ className, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cx(inputClass, 'min-h-28 leading-relaxed', className)} {...rest} />;
}

export function Select({ className, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={cx(inputClass, 'appearance-auto', className)} {...rest}>
      {children}
    </select>
  );
}

export function TextField({
  label,
  hint,
  value,
  onChange,
  type = 'text',
  ...rest
}: { label: ReactNode; hint?: ReactNode; value: string | number; onChange: (v: string) => void } & Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'>) {
  return (
    <Field label={label} hint={hint}>
      {(id, d) => <Input id={id} aria-describedby={d} type={type} value={value} onChange={(e) => onChange(e.target.value)} {...rest} />}
    </Field>
  );
}

/** On/off switch with a text state label (never colour alone). */
export function Toggle({
  label,
  hint,
  checked,
  onChange,
  disabled,
}: {
  label: ReactNode;
  hint?: ReactNode;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  const id = useId();
  return (
    <div className="flex items-center justify-between gap-4 py-1">
      <div className="min-w-0">
        <label htmlFor={id} className="font-bold">
          {label}
        </label>
        {hint && (
          <p id={`${id}-h`} className="text-sm text-ink-2">
            {hint}
          </p>
        )}
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        aria-describedby={hint ? `${id}-h` : undefined}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cx(
          'tap ease-calm relative inline-flex w-[4.75rem] shrink-0 items-center rounded-full border-2 px-1 disabled:opacity-50',
          checked ? 'border-accent bg-accent text-accent-ink' : 'border-line-strong bg-surface-2 text-ink',
        )}
      >
        <span className={cx('absolute text-xs font-bold', checked ? 'left-2.5' : 'right-2')}>{checked ? 'ON' : 'OFF'}</span>
        <span
          aria-hidden
          className={cx(
            'ease-calm h-8 w-8 rounded-full border-2 bg-surface shadow',
            checked ? 'translate-x-[2.1rem] border-accent-ink' : 'translate-x-0 border-line-strong',
          )}
        />
      </button>
    </div>
  );
}

/** Pill multi-select (aria-pressed). */
export function Chip({ pressed, onClick, children, className }: { pressed: boolean; onClick: () => void; children: ReactNode; className?: string }) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={cx(
        'tap ease-calm inline-flex items-center gap-1.5 rounded-full border-2 px-4 text-base font-bold',
        pressed ? 'border-accent bg-accent text-accent-ink' : 'border-line-strong bg-surface text-ink hover:bg-surface-2',
        className,
      )}
    >
      {pressed && <span aria-hidden>✓</span>}
      {children}
    </button>
  );
}

/** Single-choice group rendered as big buttons (radiogroup semantics). */
export function Segmented<T extends string | number>({
  label,
  options,
  value,
  onChange,
  columns,
  hideLabel,
}: {
  label: string;
  options: { value: T; label: ReactNode; hint?: string }[];
  value: T | null;
  onChange: (v: T) => void;
  columns?: number;
  hideLabel?: boolean;
}) {
  const id = useId();
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const idx = options.findIndex((o) => o.value === value);
  const move = (i: number) => {
    const n = (i + options.length) % options.length;
    onChange(options[n].value);
    refs.current[n]?.focus();
  };
  return (
    <div>
      <div id={id} className={cx('mb-1.5 font-bold', hideLabel && 'sr-only')}>
        {label}
      </div>
      <div
        role="radiogroup"
        aria-labelledby={id}
        className="grid gap-2"
        style={{ gridTemplateColumns: `repeat(${columns ?? options.length}, minmax(0, 1fr))` }}
      >
        {options.map((o, i) => {
          const selected = o.value === value;
          return (
            <button
              key={String(o.value)}
              ref={(el) => {
                refs.current[i] = el;
              }}
              type="button"
              role="radio"
              aria-checked={selected}
              tabIndex={selected || (idx === -1 && i === 0) ? 0 : -1}
              onClick={() => onChange(o.value)}
              onKeyDown={(e) => {
                if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
                  e.preventDefault();
                  move(i + 1);
                } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
                  e.preventDefault();
                  move(i - 1);
                }
              }}
              className={cx(
                'tap ease-calm flex flex-col items-center justify-center rounded-xl border-2 px-2 py-2 text-center font-bold',
                selected ? 'border-accent bg-accent text-accent-ink' : 'border-line-strong bg-surface text-ink hover:bg-surface-2',
              )}
            >
              <span className="flex items-center gap-1">
                {selected && <span aria-hidden>✓</span>}
                {o.label}
              </span>
              {o.hint && <span className={cx('text-xs font-normal', selected ? '' : 'text-ink-2')}>{o.hint}</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function Rating({
  label,
  value,
  onChange,
  low,
  high,
  labels,
}: {
  label: string;
  value: number | null;
  onChange: (v: 1 | 2 | 3 | 4 | 5) => void;
  low: string;
  high: string;
  labels?: readonly string[];
}) {
  return (
    <div>
      <Segmented
        label={label}
        value={value as 1 | 2 | 3 | 4 | 5 | null}
        onChange={onChange}
        options={([1, 2, 3, 4, 5] as const).map((n) => ({ value: n, label: String(n), hint: labels?.[n] }))}
      />
      <div className="mt-1 flex justify-between text-sm text-ink-2" aria-hidden>
        <span>{low}</span>
        <span>{high}</span>
      </div>
    </div>
  );
}

export function Progress({ value, label }: { value: number; label: string }) {
  const v = Math.max(0, Math.min(100, value));
  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={v}
      aria-label={label}
      className="h-4 w-full overflow-hidden rounded-full border border-line-strong bg-surface-2"
    >
      <div className="ease-calm h-full rounded-full bg-accent" style={{ width: `${v}%` }} />
    </div>
  );
}

/** Modal bottom sheet built on the native <dialog> (focus trap + Escape for free). */
export function Sheet({
  open,
  onClose,
  title,
  children,
  footer,
  describedBy,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  describedBy?: string;
}) {
  if (!open) return null;
  return (
    <SheetDialog onClose={onClose} title={title} footer={footer} describedBy={describedBy}>
      {children}
    </SheetDialog>
  );
}

/** Mounted only while open, so pages never carry dozens of hidden dialogs. */
function SheetDialog({
  onClose,
  title,
  children,
  footer,
  describedBy,
}: {
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  describedBy?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const open = true;
  // No close() on cleanup: unmounting removes the dialog from the top layer, and calling close()
  // would fire a "close" event that reports a user dismissal (and breaks StrictMode's re-mount).
  const [opener] = useState(() => document.activeElement as HTMLElement | null);
  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal();
    // Return focus to whatever opened the sheet (WCAG 2.4.3 focus order).
    return () => {
      if (opener && opener.isConnected) setTimeout(() => opener.focus({ preventScroll: true }), 0);
    };
  }, [opener]);
  return (
    // Backdrop click is a mouse convenience; keyboard users close with Escape (native onCancel) or the Close button.
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions
    <dialog
      ref={ref}
      className="sheet"
      aria-labelledby={titleId}
      aria-describedby={describedBy}
      onClose={onClose}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
    >
      {open && (
        <div className="flex max-h-[92dvh] flex-col">
          <div className="flex items-center justify-between gap-2 border-b border-line px-4 py-2">
            <h2 id={titleId} className="text-xl font-bold">
              {title}
            </h2>
            <IconButton label="Close" onClick={onClose}>
              <X aria-hidden size={26} />
            </IconButton>
          </div>
          <div className="overflow-y-auto px-4 py-4">{children}</div>
          {footer && <div className="border-t border-line px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">{footer}</div>}
        </div>
      )}
    </dialog>
  );
}

export function Disclaimer({ children, className }: { children?: ReactNode; className?: string }) {
  return (
    <p className={cx('flex gap-2 rounded-xl border border-line bg-surface-2 p-3 text-sm text-ink-2', className)} role="note">
      <Info aria-hidden size={18} className="mt-0.5 shrink-0" />
      <span>
        {children ??
          'Steady helps you track and remember. It does not diagnose, prescribe, or recommend treatment. Always follow your own care team’s advice.'}
      </span>
    </p>
  );
}

export function Empty({ icon, title, children }: { icon?: ReactNode; title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-line p-6 text-center">
      {icon && <div className="text-ink-2">{icon}</div>}
      <p className="font-bold">{title}</p>
      {children && <div className="text-ink-2">{children}</div>}
    </div>
  );
}

export function Stat({ label, value, sub }: { label: string; value: ReactNode; sub?: ReactNode }) {
  return (
    <div className="rounded-xl bg-surface-2 p-3">
      <div className="text-sm text-ink-2">{label}</div>
      <div className="text-2xl font-bold">{value}</div>
      {sub && <div className="text-sm text-ink-2">{sub}</div>}
    </div>
  );
}

export function Stepper({ label, value, onChange, min = 0, max = 99, unit }: { label: string; value: number; onChange: (v: number) => void; min?: number; max?: number; unit?: string }) {
  const id = useId();
  return (
    <div>
      <div id={id} className="mb-1.5 font-bold">
        {label}
      </div>
      <div role="group" aria-labelledby={id} className="flex items-center gap-3">
        <Button aria-label={`Decrease ${label}`} onClick={() => onChange(Math.max(min, value - 1))} disabled={value <= min} className="text-2xl">
          −
        </Button>
        <output aria-live="polite" className="min-w-16 text-center text-2xl font-bold">
          {value}
          {unit && <span className="ml-1 text-base font-normal text-ink-2">{unit}</span>}
        </output>
        <Button aria-label={`Increase ${label}`} onClick={() => onChange(Math.min(max, value + 1))} disabled={value >= max} className="text-2xl">
          +
        </Button>
      </div>
    </div>
  );
}

export function ListLink({ to, icon, title, sub, badge }: { to: string; icon?: ReactNode; title: string; sub?: string; badge?: ReactNode }) {
  return (
    <Link to={to} className="tap ease-calm flex items-center gap-3 rounded-xl px-3 py-3 no-underline hover:bg-surface-2">
      {icon && (
        <span aria-hidden className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent-text">
          {icon}
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="block font-bold">{title}</span>
        {sub && <span className="block text-sm text-ink-2">{sub}</span>}
      </span>
      {badge}
      <span aria-hidden className="text-ink-2">
        ›
      </span>
    </Link>
  );
}
