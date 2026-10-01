import { useState } from 'react';
import { Minus, Plus, Toilet } from 'lucide-react';
import { BOWEL_HOW_LABELS, daysAgoText, daysSinceLastBowel } from '../../core/bathroom';
import { useBathroomLogs, usePrefs } from '../../data/hooks';
import { adjustUrination } from '../../data/repo';
import { Button, Card, CardTitle } from '../../ui/kit';
import { BathroomSheet } from './BathroomSheet';

/** Today card for bowel and bladder. Shown only if the user turned tracking on. Quiet, plain, private. */
export function BathroomCard({ today }: { today: string }) {
  const prefs = usePrefs();
  const logs = useBathroomLogs();
  const [open, setOpen] = useState(false);
  if (!prefs?.trackBathroom) return null;
  const log = logs.find((l) => l.date === today);
  const since = daysSinceLastBowel(logs, today);
  const count = log?.urinationCount ?? 0;
  const bowel = log?.bowel === true ? `Yes${log.bowelHow ? `, ${BOWEL_HOW_LABELS[log.bowelHow].toLowerCase()}` : ''}` : log?.bowel === false ? 'No' : 'Not recorded yet';

  return (
    <Card labelledBy="bath-h">
      <CardTitle id="bath-h" icon={<Toilet aria-hidden size={20} />}>
        Bathroom
      </CardTitle>
      <div className="grid gap-3">
        <div>
          <p>
            Bowel movement today: <strong>{bowel}</strong>
          </p>
          {since != null && <p className="text-sm text-ink-2">Last bowel movement: {daysAgoText(since)}</p>}
          <Button className="mt-2" onClick={() => setOpen(true)}>
            {log?.bowel == null ? 'Record' : 'Edit'}
          </Button>
        </div>
        <div>
          <p aria-live="polite">
            Urinated today: <strong>{count}</strong> {count === 1 ? 'time' : 'times'}
          </p>
          {/* A counter is tapped often, so it has its own "take one off" button instead of a toast each time. */}
          <div className="mt-2 flex gap-2">
            <Button variant="primary" icon={<Plus aria-hidden size={20} />} aria-label="Add one urination" onClick={() => adjustUrination(today, 1)}>
              Add one
            </Button>
            <Button icon={<Minus aria-hidden size={20} />} aria-label="Take one off" disabled={count === 0} onClick={() => adjustUrination(today, -1)}>
              Take one off
            </Button>
          </div>
        </div>
      </div>
      <BathroomSheet date={today} open={open} onClose={() => setOpen(false)} />
    </Card>
  );
}
