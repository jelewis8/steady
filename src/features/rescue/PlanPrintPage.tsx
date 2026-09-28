import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Printer, Share2 } from 'lucide-react';
import { useContacts, useMedications, usePrefs, useProfile, useRescueProtocol } from '../../data/hooks';
import { webShare } from '../../platform/share';
import { toast } from '../../state/ui';
import { Button } from '../../ui/kit';
import { buildPlanDocument } from './planDocument';

export function PlanPrintPage() {
  const nav = useNavigate();
  const profile = useProfile();
  const plan = useRescueProtocol();
  const meds = useMedications();
  const contacts = useContacts();
  const prefs = usePrefs();
  const doc = buildPlanDocument({ profile, plan, meds, contacts, emergencyNumber: prefs?.emergencyNumber ?? '911' });

  return (
    <div className="min-h-dvh bg-white text-black">
      <header className="no-print sticky top-0 z-10 border-b border-line bg-surface px-4 py-2 text-ink">
        <div className="mx-auto flex max-w-3xl flex-wrap items-center gap-2">
          <Button variant="ghost" icon={<ChevronLeft aria-hidden size={24} />} onClick={() => nav('/rescue')}>
            Back
          </Button>
          <div className="flex-1" />
          <Button icon={<Printer aria-hidden size={20} />} onClick={() => window.print()}>
            Print / save PDF
          </Button>
          <Button
            variant="primary"
            icon={<Share2 aria-hidden size={20} />}
            onClick={async () => {
              const r = await webShare.shareFile({ name: doc.fileName, mimeType: 'text/html', content: doc.full }, 'Seizure action plan');
              if (r === 'downloaded') toast('Saved the plan as a file. You can send it to anyone.');
            }}
          >
            Share file
          </Button>
        </div>
        <p className="mx-auto mt-1 max-w-3xl text-sm text-ink-2">Made on this device. Nothing is uploaded — you choose who gets it.</p>
      </header>
      <style>{doc.css.replace(/body\{/, '.plan-doc{')}</style>
      {/* The document body is generated from escaped strings in planDocument.ts. */}
      <main className="plan-doc" dangerouslySetInnerHTML={{ __html: doc.body }} />
    </div>
  );
}
