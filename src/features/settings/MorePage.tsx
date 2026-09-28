import { BedDouble, BookOpen, Database, FileText, Info, LifeBuoy, List, Pill, Settings, Shield, Utensils } from 'lucide-react';
import { usePrefs } from '../../data/hooks';
import { updatePreferences } from '../../data/repo';
import { Card, ListLink, PageHeader, Toggle } from '../../ui/kit';
import { APP_VERSION } from '../../core/defaults';

export function MorePage() {
  const prefs = usePrefs();
  return (
    <div className="grid gap-4">
      <PageHeader title="More" />
      <Card>
        <Toggle
          label="Essentials only"
          hint="For hard days: show just medications and sleep on your checklist. Everything else waits."
          checked={!!prefs?.essentialsOnly}
          onChange={(v) => updatePreferences({ essentialsOnly: v })}
        />
      </Card>
      <nav aria-label="Sections">
        <Card className="p-2 sm:p-2">
          <ListLink to="/meds" icon={<Pill size={22} />} title="Medications" sub="Doses, supply, adherence" />
          <ListLink to="/seizures" icon={<List size={22} />} title="Seizure log" sub="Every seizure and warning sign" />
          <ListLink to="/sleep" icon={<BedDouble size={22} />} title="Sleep" sub="Diary and targets" />
          <ListLink to="/diet" icon={<Utensils size={22} />} title="Food & water" sub="Meals, hydration, foods to watch" />
          <ListLink to="/rescue" icon={<LifeBuoy size={22} />} title="Rescue plan" sub="Action plan, contacts, calm tools" />
          <ListLink to="/insights/report" icon={<FileText size={22} />} title="Report for my neurologist" sub="Print or share a summary" />
        </Card>
        <Card className="mt-4 p-2 sm:p-2">
          <ListLink to="/settings" icon={<Settings size={22} />} title="Settings" sub="Appearance, reminders, safety, profile" />
          <ListLink to="/settings/passcode" icon={<Shield size={22} />} title="Passcode lock" sub={prefs?.passcodeEnabled ? 'On' : 'Off'} />
          <ListLink to="/settings/data" icon={<Database size={22} />} title="Backup & data" sub="Export, import, erase" />
          <ListLink to="/privacy" icon={<BookOpen size={22} />} title="Privacy" sub="Your data never leaves this device" />
          <ListLink to="/about" icon={<Info size={22} />} title="About & help" sub={`Version ${APP_VERSION}`} />
        </Card>
      </nav>
    </div>
  );
}
