import { X } from 'lucide-react';
import { useUI } from '../state/ui';

/** Persistent toasts with Undo. They stay until dismissed — nothing on a timer. */
export function Toasts() {
  const toasts = useUI((s) => s.toasts);
  const dismiss = useUI((s) => s.dismissToast);
  return (
    <div role="status" aria-live="polite" className="pointer-events-auto flex w-full flex-col items-stretch gap-2 sm:w-auto sm:min-w-96">
      {toasts.map((t) => (
        <div key={t.id} className="flex items-center gap-2 rounded-2xl border-2 border-ink bg-ink py-1 pr-1 pl-4 text-bg shadow-lg">
          <p className="min-w-0 flex-1 py-2 font-bold">{t.message}</p>
          {t.undo && (
            <button
              type="button"
              className="tap rounded-xl px-3 font-bold underline underline-offset-4"
              onClick={async () => {
                await t.undo?.();
                dismiss(t.id);
              }}
            >
              Undo
            </button>
          )}
          <button type="button" className="tap inline-flex items-center justify-center rounded-xl" aria-label="Dismiss message" onClick={() => dismiss(t.id)}>
            <X aria-hidden size={22} />
          </button>
        </div>
      ))}
    </div>
  );
}
