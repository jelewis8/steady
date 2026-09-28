import { useRegisterSW } from 'virtual:pwa-register/react';
import { Button } from './kit';

/** A new version never reloads on its own — the user chooses when (no surprises mid-task). */
export function UpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({ immediate: true });
  if (!needRefresh) return null;
  return (
    <div role="status" className="no-print fixed inset-x-0 top-16 z-40 px-4">
      <div className="mx-auto flex max-w-2xl flex-wrap items-center gap-3 rounded-2xl border-2 border-accent bg-accent-soft p-3">
        <p className="min-w-0 flex-1 font-bold">A new version of Steady is ready.</p>
        <Button variant="primary" onClick={() => updateServiceWorker(true)}>
          Update now
        </Button>
        <Button variant="ghost" onClick={() => setNeedRefresh(false)}>
          Later
        </Button>
      </div>
    </div>
  );
}
