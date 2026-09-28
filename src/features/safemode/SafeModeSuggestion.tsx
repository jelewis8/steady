import { usePrefs } from '../../data/hooks';
import { updatePreferences } from '../../data/repo';
import { useUI } from '../../state/ui';
import { Button, Sheet } from '../../ui/kit';
import { isSafeMode } from '../../ui/hooks';

export function SafeModeSuggestion() {
  const open = useUI((s) => s.suggestSafeMode);
  const setOpen = useUI((s) => s.setSuggestSafeMode);
  const prefs = usePrefs();
  const hours = prefs?.safeModeDurationHours ?? 4;
  if (isSafeMode(prefs)) return null;
  return (
    <Sheet open={open} onClose={() => setOpen(false)} title="Switch to safe mode?">
      <p className="text-lg">
        Safe mode shows only the essentials with bigger buttons, and pauses non-urgent reminders for {hours} hours. Medication reminders stay on.
      </p>
      <div className="mt-5 grid gap-2">
        <Button
          variant="primary"
          size="xl"
          onClick={async () => {
            await updatePreferences({ safeModeUntil: new Date(Date.now() + hours * 3600_000).toISOString() });
            setOpen(false);
          }}
        >
          Yes, keep it simple
        </Button>
        <Button size="lg" onClick={() => setOpen(false)}>
          No thanks
        </Button>
      </div>
    </Sheet>
  );
}
