import { APP_VERSION, SCHEMA_VERSION } from '../../core/defaults';
import { Card, Disclaimer, PageHeader } from '../../ui/kit';

export function PrivacyPage() {
  return (
    <div className="grid gap-4 pb-6">
      <PageHeader title="Privacy" back="/more" subtitle="Short version: your data stays on your device. Nobody else can see it — not even us." />
      <Card>
        <div className="grid gap-4 leading-relaxed">
          <section>
            <h2 className="text-lg font-bold">What Steady stores</h2>
            <p>
              Everything you enter: seizures and warning signs, voice notes, medications and doses, sleep, meals and water, your routine,
              check-ins, your action plan and emergency contacts, your safety plan and support numbers, and your settings. All of it is health information, and we treat it that way.
            </p>
          </section>
          <section>
            <h2 className="text-lg font-bold">Where it’s stored</h2>
            <p>
              Only in this browser, on this device (in a local database called IndexedDB). Steady has no server, no accounts and no cloud sync. The
              website only delivers the app itself; after that, Steady works offline.
            </p>
          </section>
          <section>
            <h2 className="text-lg font-bold">What we collect</h2>
            <p>
              Nothing. No analytics, no tracking, no advertising, no crash reports, no cookies. The app is built so it cannot send your data
              anywhere — the site’s security policy blocks connections to any other server.
            </p>
          </section>
          <section>
            <h2 className="text-lg font-bold">When data leaves your device</h2>
            <p>Only when you choose to:</p>
            <ul className="mt-1 list-disc pl-6">
              <li>saving a backup or CSV file, or sharing your action plan or report;</li>
              <li>tapping Call or Text on the rescue screen, which opens your phone’s own app;</li>
              <li>adding your location to an emergency text, which asks your browser for your position first.</li>
            </ul>
          </section>
          <section>
            <h2 className="text-lg font-bold">Keeping it safe</h2>
            <p>
              Use a screen lock on your device. You can add a passcode to Steady (More → Passcode lock) and protect backup files with a
              passphrase. Backup files contain your health data — store them somewhere private.
            </p>
          </section>
          <section>
            <h2 className="text-lg font-bold">Your control</h2>
            <p>You can export everything at any time, and erase everything at any time, from More → Backup & data.</p>
          </section>
        </div>
      </Card>
    </div>
  );
}

export function AboutPage() {
  return (
    <div className="grid gap-4 pb-6">
      <PageHeader title="About Steady" back="/more" />
      <Card>
        <div className="grid gap-4 leading-relaxed">
          <p>
            Steady helps people living with focal epilepsy keep a steady daily routine: medication on time, regular sleep and meals, and a clear
            record of seizures to share with their care team. It was designed for hard days — big buttons, no pressure, and nothing that
            flashes.
          </p>
          <section>
            <h2 className="text-lg font-bold">Quick tips</h2>
            <ul className="list-disc pl-6">
              <li>“Log seizure” is on every screen. Two taps is enough — add details later, or never.</li>
              <li>After a seizure, safe mode keeps only the essentials on screen.</li>
              <li>The SOS button opens a timer for a seizure or a warning sign, your people, and your action plan.</li>
              <li>Having a rough day? Switch today to your “Rest day” routine, or turn on Essentials only.</li>
              <li>Install Steady to your home screen for offline use and more reliable reminders.</li>
              <li>Keyboard: Tab moves between controls, Enter or Space presses, arrow keys choose options, Escape closes panels.</li>
            </ul>
          </section>
          <section>
            <h2 className="text-lg font-bold">Seizure-safe design</h2>
            <p>
              No flashing or strobing, no fast animation (nothing faster than 300 ms), no auto-playing motion, and your device’s “reduce motion”
              setting is always respected. Text is set in Atkinson Hyperlegible, a typeface designed for low-vision readers.
            </p>
          </section>
          <p className="text-sm text-ink-2">
            Version {APP_VERSION} · data format {SCHEMA_VERSION}
          </p>
        </div>
      </Card>
      <Disclaimer>
        Steady is a personal tracking and reminder tool. It is not a medical device, and it does not diagnose, prescribe, or recommend
        treatment. In an emergency, call your local emergency number.
      </Disclaimer>
    </div>
  );
}
