import { useEffect, useState } from 'react';
import { Button, Card, CardTitle, Disclaimer, LinkButton, PageHeader } from '../../ui/kit';

const IN = 4;
const OUT = 6;

/** Slow paced breathing: 4 s in, 6 s out (6 breaths/min). Starts only when asked — never auto-plays. */
function Breathing() {
  const [running, setRunning] = useState(false);
  const [t, setT] = useState(0);
  const reduce =
    typeof matchMedia !== 'undefined' &&
    (matchMedia('(prefers-reduced-motion: reduce)').matches || document.documentElement.dataset.motion === 'reduce');

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setT((x) => (x + 1) % (IN + OUT)), 1000);
    return () => clearInterval(id);
  }, [running]);

  const phase = t < IN ? 'in' : 'out';
  const count = phase === 'in' ? IN - t : IN + OUT - t;

  return (
    <Card labelledBy="br-h">
      <CardTitle id="br-h">Slow breathing</CardTitle>
      <p className="text-ink-2">Breathe in through your nose for 4, and out slowly for 6. The circle grows as you breathe in.</p>
      <div className="my-6 flex h-56 items-center justify-center" aria-hidden>
        {!reduce && (
          <div
            data-phase={phase}
            className="breath-circle flex h-52 w-52 items-center justify-center rounded-full border-4 border-accent bg-accent-soft"
            style={{ transform: `scale(${running && phase === 'in' ? 1 : 0.55})` }}
          />
        )}
      </div>
      <p className="text-center text-3xl font-bold" aria-live="polite">
        {running ? (phase === 'in' ? `Breathe in… ${count}` : `Breathe out… ${count}`) : 'Ready when you are'}
      </p>
      <Button className="mt-4" variant={running ? 'secondary' : 'primary'} size="lg" block onClick={() => { setT(0); setRunning((r) => !r); }}>
        {running ? 'Stop' : 'Start breathing guide'}
      </Button>
    </Card>
  );
}

const STEPS = [
  { n: 5, text: 'Look around. Name five things you can see.' },
  { n: 4, text: 'Notice four things you can feel — your feet on the floor, your clothes, the air.' },
  { n: 3, text: 'Listen for three things you can hear.' },
  { n: 2, text: 'Find two things you can smell, or two smells you like.' },
  { n: 1, text: 'Notice one thing you can taste — or take a sip of water.' },
];

function Grounding() {
  const [step, setStep] = useState(-1);
  return (
    <Card labelledBy="gr-h">
      <CardTitle id="gr-h">5-4-3-2-1 grounding</CardTitle>
      {step < 0 ? (
        <>
          <p className="text-ink-2">A gentle way to come back to the present after a warning sign, or when you feel anxious afterwards.</p>
          <Button className="mt-3" variant="primary" size="lg" block onClick={() => setStep(0)}>
            Begin
          </Button>
        </>
      ) : step < STEPS.length ? (
        <div aria-live="polite">
          <p className="text-6xl font-bold">{STEPS[step].n}</p>
          <p className="mt-2 text-2xl">{STEPS[step].text}</p>
          <p className="mt-2 text-ink-2">
            Step {step + 1} of {STEPS.length}. Take as long as you like.
          </p>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <Button size="lg" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0}>
              Back
            </Button>
            <Button variant="primary" size="lg" onClick={() => setStep((s) => s + 1)}>
              Next
            </Button>
          </div>
        </div>
      ) : (
        <div aria-live="polite">
          <p className="text-2xl font-bold">Well done.</p>
          <p className="mt-1">If you still feel unwell, rest somewhere safe and let someone know.</p>
          <Button className="mt-3" onClick={() => setStep(-1)}>
            Start again
          </Button>
        </div>
      )}
    </Card>
  );
}

export function CalmPage() {
  return (
    <div className="grid gap-4">
      <PageHeader title="Calm & grounding" back="/rescue" subtitle="For warning signs, or feeling shaky afterwards. Sit or lie down somewhere safe first." />
      <Breathing />
      <Grounding />
      <LinkButton to="/support" size="lg" block>
        Having thoughts of hurting yourself? Get support
      </LinkButton>
      <Disclaimer>
        These exercises help some people feel calmer. They don’t stop a seizure. Follow your action plan if a seizure starts.
      </Disclaimer>
    </div>
  );
}
