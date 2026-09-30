import { Card, Disclaimer, PageHeader } from '../../ui/kit';
import { SideEffectsList } from './SideEffects';

/** Every side effect she has noted, grouped by medication, with when each started and stopped. */
export function SideEffectsPage() {
  return (
    <div className="grid gap-4 pb-6">
      <PageHeader title="Side effects" back="/meds" subtitle="What you’ve noticed, and when. It goes into the report for your neurologist." />
      <Card>
        <SideEffectsList />
      </Card>
      <Disclaimer>
        Steady keeps the record. It can’t tell you whether something is caused by a medication. Tell your doctor or pharmacist about anything that worries you.
      </Disclaimer>
    </div>
  );
}
