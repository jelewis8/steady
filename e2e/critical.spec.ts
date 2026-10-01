import { expect, test, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

async function onboard(page: Page) {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Welcome to Steady' })).toBeVisible();
  await page.getByRole('button', { name: /Set up/ }).click();
  await page.getByLabel(/First name/).fill('Dylan');
  await page.getByRole('button', { name: 'Next', exact: true }).click(); // your day
  await page.getByRole('button', { name: 'Next', exact: true }).click(); // meds
  await page.getByRole('button', { name: 'Add a medication' }).click();
  await page.getByLabel('Name').fill('Lamotrigine');
  await page.getByLabel('Dose', { exact: true }).fill('100');
  await page.getByRole('button', { name: 'Next', exact: true }).click(); // safety
  await page.getByLabel('Their name').fill('Alex');
  await page.getByLabel('Their phone number').fill('+1 555 0100');
  await page.getByRole('button', { name: 'Next', exact: true }).click(); // reminders
  await page.getByRole('button', { name: 'Finish' }).click();
  await expect(page.getByRole('heading', { level: 1, name: /Dylan/ })).toBeVisible();
}

test('onboarding builds a routine with medication doses on the checklist', async ({ page }) => {
  await onboard(page);
  await expect(page.getByText(/Today’s routine/)).toBeVisible();
  await page.goto('/meds');
  await expect(page.getByText('Lamotrigine')).toBeVisible();
  await page.goto('/rescue');
  await expect(page.getByText('Alex', { exact: true })).toBeVisible();
});

test('log a seizure in two taps, with undo', async ({ page }) => {
  await onboard(page);
  await page.getByRole('button', { name: 'Log seizure' }).click();
  await expect(page.getByRole('dialog', { name: 'Log a seizure' })).toBeVisible();
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByText(/Seizure logged/)).toBeVisible();
  await page.getByRole('button', { name: 'No thanks' }).click();
  await page.goto('/seizures');
  await expect(page.getByText(/Quick log/)).toBeVisible();
});

test('complete a checklist item and see progress move', async ({ page }) => {
  await onboard(page);
  const progress = page.getByRole('progressbar');
  const before = Number(await progress.getAttribute('aria-valuenow'));
  const firstCheck = page.getByRole('button', { name: /^Mark .* as (done|taken)$/ }).first();
  await firstCheck.click();
  await expect.poll(async () => Number(await progress.getAttribute('aria-valuenow'))).toBeGreaterThan(before);
});

test('export always works and produces a versioned JSON envelope', async ({ page }) => {
  await onboard(page);
  await page.goto('/settings/data');
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Save backup file' }).click();
  const file = await download;
  const path = await file.path();
  const fs = await import('node:fs/promises');
  const env = JSON.parse(await fs.readFile(path!, 'utf8'));
  expect(env.schemaVersion).toMatch(/^\d+\.\d+\.\d+$/);
  expect(env.checksum).toHaveLength(64);
  expect(env.data.medications[0].name).toBe('Lamotrigine');
});

test('seizure timer escalates at the plan threshold', async ({ page }) => {
  await onboard(page);
  await page.goto('/rescue');
  await expect(page.getByRole('heading', { name: 'Rescue' })).toBeVisible();
  await page.evaluate(() => localStorage.setItem('steady.seizureTimerStart', String(Date.now() - 6 * 60_000)));
  await page.getByRole('button', { name: /start timer/ }).click();
  await expect(page.getByRole('alert')).toContainText('5 minutes');
  await page.getByRole('button', { name: 'It has stopped' }).click();
  await page.getByRole('button', { name: 'A seizure', exact: true }).click();
  await page.getByRole('button', { name: 'Save to seizure log' }).click();
  await expect(page.getByRole('heading', { name: 'Seizure details' })).toBeVisible();
});

test('no accessibility violations on key screens (axe, WCAG 2.2 AA)', async ({ page }) => {
  await onboard(page);
  for (const path of ['/', '/insights', '/schedule', '/meds', '/rescue', '/settings', '/settings/data', '/seizures/new']) {
    await page.goto(path);
    await page.waitForTimeout(400);
    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
    expect(results.violations, `${path}: ${results.violations.map((v) => v.id).join(', ')}`).toEqual([]);
  }
});

test('seizure safety: no CSS animation or transition faster than 300ms', async ({ page }) => {
  await onboard(page);
  const fast = await page.evaluate(() => {
    const bad: string[] = [];
    for (const el of Array.from(document.querySelectorAll('*'))) {
      const cs = getComputedStyle(el);
      const durations = [...cs.transitionDuration.split(','), ...cs.animationDuration.split(',')]
        .map((d) => d.trim())
        .map((d) => (d.endsWith('ms') ? parseFloat(d) : parseFloat(d) * 1000));
      if (durations.some((ms) => ms > 0 && ms < 300)) bad.push(el.tagName + '.' + el.className);
      if (cs.animationName !== 'none') bad.push('animation:' + el.tagName);
    }
    return bad;
  });
  expect(fast).toEqual([]);
});

test('works offline after first load (service worker)', async ({ page, context }) => {
  await onboard(page);
  await page.waitForFunction(() => navigator.serviceWorker?.controller != null, null, { timeout: 15_000 }).catch(() => undefined);
  await page.reload();
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('button', { name: 'Log seizure' })).toBeVisible();
  await context.setOffline(false);
});

test('privacy: never contacts another origin and triggers no CSP violations', async ({ page }) => {
  const foreign: string[] = [];
  const csp: string[] = [];
  page.on('request', (r) => {
    const u = new URL(r.url());
    if (!['localhost', '127.0.0.1'].includes(u.hostname) && !u.protocol.startsWith('blob') && !u.protocol.startsWith('data')) foreign.push(r.url());
  });
  page.on('console', (m) => /Content Security Policy/i.test(m.text()) && csp.push(m.text()));
  await page.goto('/');
  await page.getByRole('button', { name: /sample data/ }).click();
  await expect(page.getByText(/exploring sample data/)).toBeVisible({ timeout: 15_000 });
  for (const path of ['/', '/insights', '/insights/report', '/rescue', '/rescue/plan/print', '/rescue/calm', '/meds', '/sleep', '/diet', '/schedule', '/seizures', '/settings/data']) {
    await page.goto(path);
    await page.waitForTimeout(300);
  }
  expect(foreign).toEqual([]);
  expect(csp).toEqual([]);
});

// ---- B-008: restoring a backup must give a clear, persistent confirmation ----
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const FIXTURE = join(process.cwd(), 'src/test/fixtures/backup-release-2026-09-27.json');
const realBackup = readdirSync(process.cwd()).find((f) => /^steady-backup-.*\.json$/.test(f) && !f.includes('.encrypted'));
const backups = [{ label: 'frozen fixture', path: FIXTURE, expect: /30 seizure events|\d+ seizure events/ }].concat(
  realBackup && existsSync(realBackup) ? [{ label: 'real backup', path: join(process.cwd(), realBackup), expect: /0 seizure events, 2 medications, \d+ dose records, 2 sleep entries/ }] : [],
);

for (const b of backups) {
  test(`welcome screen: restoring the ${b.label} shows a confirmation that stays put`, async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'I have a backup file to restore' }).click();
    await page.getByLabel('Choose a Steady backup file').setInputFiles(b.path);
    await page.getByRole('radio', { name: /Replace everything/ }).check();
    await page.getByRole('button', { name: 'Replace and restore' }).click();
    const status = page.getByRole('status').filter({ has: page.getByRole('heading') });
    await expect(status.getByRole('heading', { name: 'Backup restored' })).toBeVisible();
    await expect(status).toContainText(b.expect);
    await page.waitForTimeout(3000); // it must NOT vanish or redirect by itself
    const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
    expect(axe.violations.map((v) => v.id)).toEqual([]);
    await expect(status.getByRole('heading', { name: 'Backup restored' })).toBeVisible();
    await page.getByRole('button', { name: 'Open Steady' }).click();
    await expect(page.getByRole('button', { name: 'Log seizure' })).toBeVisible();
  });

  for (const mode of ['Replace everything', 'Add to what’s here'] as const) {
    test(`Backup & data: restoring the ${b.label} (${mode}) shows what is now on the device`, async ({ page }) => {
      await onboard(page);
      await page.goto('/settings/data');
      await page.getByLabel('Choose a Steady backup file').setInputFiles(b.path);
      await page.getByRole('radio', { name: new RegExp(mode) }).check();
      await page.getByRole('button', { name: /Replace and restore|^Import$/ }).click();
      const status = page.getByRole('status').filter({ has: page.getByRole('heading') });
      await expect(status.getByRole('heading', { name: /Backup restored|Backup added to your data/ })).toBeVisible();
      if (mode === 'Replace everything') await expect(status).toContainText(b.expect);
      await expect(status.getByRole('heading')).toBeFocused();
      await page.waitForTimeout(3000);
      await expect(status).toBeVisible();
      await page.getByRole('button', { name: 'Done' }).click();
      await expect(page.getByText(/Last restore:/)).toBeVisible();
    });
  }
}

test('restoring something that is not a backup shows a visible error and changes nothing', async ({ page }) => {
  await onboard(page);
  await page.goto('/settings/data');
  await page.getByLabel('Choose a Steady backup file').setInputFiles({ name: 'notes.json', mimeType: 'application/json', buffer: Buffer.from('{"hello":1}') });
  await expect(page.getByRole('alert')).toContainText(/not a Steady export|missing a schema version/);
  await page.getByLabel('Choose a Steady backup file').setInputFiles({ name: 'bad.json', mimeType: 'application/json', buffer: Buffer.from('not json at all') });
  await expect(page.getByRole('alert')).toContainText('couldn’t be read');
  await page.goto('/meds');
  await expect(page.getByText('Lamotrigine')).toBeVisible();
});

// ---- Release 2: B-007, B-009, B-011 ----
test('B-007: "Used per dose" can be cleared and set to 2, and is remembered', async ({ page }) => {
  await onboard(page);
  await page.goto('/meds');
  await page.getByRole('link', { name: /Lamotrigine/ }).first().click();
  const units = page.getByLabel('Used per dose');
  await units.fill('');
  await expect(units).toHaveValue('');
  await expect(page.getByText(/Enter how many you take each time/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Save changes' })).toBeDisabled();
  await units.fill('2');
  await expect(units).toHaveValue('2');
  await page.getByRole('button', { name: 'Save changes' }).click();
  await page.goto('/meds');
  await page.getByRole('link', { name: /Lamotrigine/ }).first().click();
  await expect(page.getByLabel('Used per dose')).toHaveValue('2');
});

test('B-007: pills per dose can be set during onboarding', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /Set up/ }).click();
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await page.getByRole('button', { name: 'Add a medication' }).click();
  await page.getByLabel('Name').fill('Keppra');
  await page.getByLabel('Dose', { exact: true }).fill('500');
  await page.getByLabel('Used per dose').fill('2');
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await page.getByRole('button', { name: 'Finish' }).click();
  await expect(page.getByText(/Today’s routine/)).toBeVisible();
  await page.goto('/meds');
  await page.getByRole('link', { name: /Keppra/ }).first().click();
  await expect(page.getByLabel('Used per dose')).toHaveValue('2');
});

test('B-009: the convulsive seizure type says "formerly grand mal" in the quick log', async ({ page }) => {
  await onboard(page);
  await page.getByRole('button', { name: 'Log seizure' }).click();
  await expect(page.getByRole('radio', { name: 'Focal to bilateral tonic-clonic (formerly grand mal)' })).toBeVisible();
});

test('B-011: a note recorded with a dose appears in the neurologist report', async ({ page }) => {
  await onboard(page);
  await page.getByRole('button', { name: /More options for Lamotrigine/ }).first().click();
  await page.getByLabel('Note or side effect').fill('Felt dizzy an hour after');
  await page.getByRole('button', { name: 'Save note' }).click();
  await page.goto('/insights/report');
  await expect(page.getByRole('heading', { name: 'Notes recorded with doses' })).toBeVisible();
  await expect(page.getByRole('cell', { name: /Felt dizzy an hour after/ })).toBeVisible();
});

// ---- Release 3: F-002 support for thoughts of suicide or self-harm ----
async function setPasscodeAndLock(page: Page) {
  await page.goto('/settings/passcode');
  await page.getByRole('button', { name: 'Set up a passcode' }).click();
  const enterPin = async () => {
    for (const d of '1234') await page.getByRole('button', { name: d, exact: true }).click();
    await page.getByRole('button', { name: 'OK', exact: true }).click();
  };
  await enterPin(); // choose
  await enterPin(); // confirm
  await page.getByRole('button', { name: /turn on passcode/ }).click();
  // Steady locks as soon as a passcode is first turned on
  await expect(page.getByRole('heading', { name: 'Steady is locked' })).toBeVisible();
}

test('F-002: reachable from Rescue; choosing a country shows its verified lines and emergency number', async ({ page }) => {
  await onboard(page);
  await page.goto('/rescue');
  await page.getByRole('link', { name: /thoughts of hurting myself/ }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Support' })).toBeVisible();
  await expect(page.getByText('You’re not alone.')).toBeVisible();
  // no country yet: it asks, and the emergency call still works
  await expect(page.locator('a[href="tel:911"]').first()).toBeVisible();
  await page.getByLabel('Which country are you in?').selectOption('PH');
  await expect(page.getByText('NCMH Crisis Hotline', { exact: true })).toBeVisible();
  await expect(page.locator('a[href="tel:1553"]')).toBeVisible();
  await page.getByLabel('Change country').selectOption('US');
  await expect(page.locator('a[href="tel:988"]')).toBeVisible();
  await expect(page.locator('a[href^="sms:741741"]')).toHaveAttribute('href', /body=HOME/);
  await page.getByLabel('Change country').selectOption('DE');
  await expect(page.locator('a[href="tel:08001110111"]')).toBeVisible();
  await expect(page.getByRole('link', { name: /Call emergency services on 112/ })).toBeVisible(); // the number followed the country
  await expect(page.getByText(/not a crisis or emergency service/)).toBeVisible();
});

test('F-002: a country not in the list can add its own number', async ({ page }) => {
  await onboard(page);
  await page.goto('/support');
  await page.getByLabel('Which country are you in?').selectOption('other');
  await expect(page.getByText(/findahelpline\.com/).first()).toBeVisible();
  await page.getByRole('button', { name: 'Add a number' }).click();
  await page.getByLabel('Name of the line or service').fill('Local helpline');
  await page.getByLabel('Phone number').fill('0800 123 456');
  await page.getByRole('button', { name: 'Save number' }).click();
  await expect(page.locator('a[href="tel:0800123456"]')).toBeVisible();
});

test('F-002: safety plan and a trusted person, with a prefilled text and nothing sent by the app', async ({ page }) => {
  const posts: string[] = [];
  page.on('request', (r) => ['POST', 'PUT'].includes(r.method()) && posts.push(r.url()));
  await onboard(page);
  await page.goto('/support/plan');
  await page.getByRole('switch', { name: /Alex/ }).click();
  await page.getByLabel('My warning signs').fill('Not sleeping for two nights');
  await page.getByLabel('What matters most to me').fill('My sister');
  await page.getByLabel('The message I’d send').fill('Please call me now');
  await page.getByRole('button', { name: 'Save my plan' }).click();
  await expect(page.getByText('Safety plan saved.')).toBeVisible();
  await page.goto('/support');
  await expect(page.getByText('Alex', { exact: true })).toBeVisible();
  await expect(page.locator('a[href^="tel:+15550100"]')).toBeVisible();
  await expect(page.locator('a[href^="sms:+15550100"]')).toHaveAttribute('href', /body=Please%20call%20me%20now/);
  await expect(page.getByText('Not sleeping for two nights')).toBeVisible();
  await expect(page.getByText('My sister')).toBeVisible();
  expect(posts).toEqual([]);
});

test('F-002: reachable from the lock screen; the detailed plan stays private unless she allows it', async ({ page }) => {
  await onboard(page);
  await page.goto('/support/plan');
  await page.getByRole('switch', { name: /Alex/ }).click();
  await page.getByLabel('My warning signs').fill('Private warning signs');
  await page.getByRole('button', { name: 'Save my plan' }).click();
  await expect(page.getByText('Safety plan saved.')).toBeVisible();
  await page.goto('/support');
  await page.getByLabel('Which country are you in?').selectOption('GB');
  await expect(page.locator('a[href="tel:116123"]')).toBeVisible();
  await setPasscodeAndLock(page);
  await page.getByRole('button', { name: 'I need support right now' }).click();
  await expect(page.getByText('You’re not alone.')).toBeVisible();
  await expect(page.locator('a[href="tel:999"]').first()).toBeVisible();
  await expect(page.locator('a[href="tel:116123"]')).toBeVisible();
  await expect(page.locator('a[href^="tel:+15550100"]')).toBeVisible();
  await expect(page.getByText('Private warning signs')).toHaveCount(0);
  await expect(page.getByText(/Unlock Steady to read it/)).toBeVisible();
  const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
  expect(axe.violations.map((v) => v.id)).toEqual([]);
});

test('F-002: if she allows it, the plan is shown on the lock screen', async ({ page }) => {
  await onboard(page);
  await page.goto('/support/plan');
  await page.getByLabel('My warning signs').fill('Visible warning signs');
  await page.getByRole('switch', { name: /Show this plan on the lock screen/ }).click();
  await page.getByRole('button', { name: 'Save my plan' }).click();
  await expect(page.getByText('Safety plan saved.')).toBeVisible();
  await setPasscodeAndLock(page);
  await page.getByRole('button', { name: 'I need support right now' }).click();
  await expect(page.getByText('Visible warning signs')).toBeVisible();
});

test('F-002: onboarding asks for a country and fills the emergency number', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /Set up/ }).click();
  for (let i = 0; i < 3; i++) await page.getByRole('button', { name: 'Next', exact: true }).click(); // name, day, meds, then safety
  await page.getByLabel('Country').selectOption('GB');
  await expect(page.getByLabel('Emergency number where you live')).toHaveValue('999');
  await page.getByLabel('Country').selectOption('DE');
  await expect(page.getByLabel('Emergency number where you live')).toHaveValue('112');
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await page.getByRole('button', { name: 'Finish' }).click();
  await expect(page.getByText(/Today’s routine/)).toBeVisible();
  await page.goto('/support');
  await expect(page.locator('a[href="tel:08001110111"]')).toBeVisible();
  await page.goto('/settings');
  await expect(page.getByLabel('Country')).toHaveValue('DE');
});

test('F-002: support pages have no accessibility violations and never contact another origin', async ({ page }) => {
  const foreign: string[] = [];
  page.on('request', (r) => {
    const u = new URL(r.url());
    if (!['localhost', '127.0.0.1'].includes(u.hostname) && !u.protocol.startsWith('blob') && !u.protocol.startsWith('data')) foreign.push(r.url());
  });
  await onboard(page);
  await page.goto('/support');
  await page.getByLabel('Which country are you in?').selectOption('PH');
  for (const path of ['/support', '/support/plan', '/rescue', '/rescue/calm']) {
    await page.goto(path);
    await page.waitForTimeout(400);
    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
    expect(results.violations, `${path}: ${results.violations.map((v) => v.id).join(', ')}`).toEqual([]);
  }
  expect(foreign).toEqual([]);
});

// ---- Release 4: F-001 dated side-effect log, F-007 medications that didn't work out ----
test('F-001: add a dated side effect to a medication, edit it, and remove it with undo', async ({ page }) => {
  await onboard(page);
  await page.goto('/meds');
  await page.getByRole('link', { name: /Lamotrigine/ }).first().click();
  await page.getByRole('button', { name: 'Add a side effect' }).click();
  const dialog = page.getByRole('dialog', { name: 'Add a side effect' });
  await dialog.getByLabel('What did you notice?').fill('Dizziness');
  await dialog.getByLabel('When did it start?').fill('2026-09-01');
  await dialog.getByRole('radio', { name: 'Moderate' }).click();
  await dialog.getByRole('button', { name: 'Save', exact: true }).click();
  const entry = page.getByRole('listitem').filter({ hasText: 'Dizziness' });
  await expect(entry).toContainText('Moderate');
  await expect(entry).toContainText(/Started .*Sep.* · still happening/);

  // a stop date before the start date is caught
  await page.getByRole('button', { name: 'Edit Dizziness' }).click();
  const edit = page.getByRole('dialog', { name: 'Edit side effect' });
  await edit.getByLabel('When did it stop?').fill('2026-08-01');
  await expect(edit.getByRole('alert')).toContainText('before the start date');
  await edit.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(edit).toBeVisible(); // not saved
  await edit.getByLabel('When did it stop?').fill('2026-09-10');
  await edit.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(entry).toContainText(/stopped .*10/);

  await page.getByRole('button', { name: 'Edit Dizziness' }).click();
  await page.getByRole('button', { name: 'Remove this entry' }).click();
  await expect(page.getByText('Nothing noted for this medication.')).toBeVisible();
  await page.getByRole('button', { name: 'Undo' }).last().click(); // the newest toast
  await expect(page.getByRole('listitem').filter({ hasText: 'Dizziness' })).toBeVisible();
});

test('F-001: "not sure which medication" and "date unknown" are fine, and show in the report', async ({ page }) => {
  await onboard(page);
  await page.goto('/meds/side-effects');
  await expect(page.getByRole('heading', { level: 1, name: 'Side effects' })).toBeVisible();
  await page.getByRole('button', { name: 'Add a side effect' }).click();
  const dialog = page.getByRole('dialog', { name: 'Add a side effect' });
  await dialog.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(dialog.getByText(/Add a few words/)).toBeVisible(); // gentle, not red-error wording
  await dialog.getByLabel('What did you notice?').fill('Headaches');
  await dialog.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Not sure which medication' })).toBeVisible();
  await expect(page.getByText('Start date unknown')).toBeVisible();

  await page.goto('/insights/report');
  await expect(page.getByRole('heading', { name: 'Side effects noted' })).toBeVisible();
  await expect(page.getByRole('cell', { name: 'Headaches' })).toBeVisible();
  await expect(page.getByRole('cell', { name: 'Start date unknown' })).toBeVisible();
});

test('F-007: stopping a medication asks why (optionally) and the report lists it', async ({ page }) => {
  await onboard(page);
  await page.goto('/meds');
  await page.getByRole('link', { name: /Lamotrigine/ }).first().click();
  await page.getByRole('button', { name: 'Add a side effect' }).click();
  await page.getByLabel('What did you notice?').fill('Rash');
  await page.getByRole('dialog').getByRole('button', { name: 'Save', exact: true }).click();
  await page.getByRole('button', { name: 'I no longer take this' }).click();
  const dialog = page.getByRole('dialog', { name: /Stopping Lamotrigine/ });
  await expect(dialog.getByText(/Never stop an anti-seizure medication without talking to your doctor/)).toBeVisible();
  await dialog.getByRole('radio', { name: 'Allergic reaction' }).click();
  await dialog.getByLabel(/Anything you’d like to add/).fill('Hives after two days');
  await dialog.getByRole('button', { name: 'Save and move to past medications' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Medications' })).toBeVisible();
  await page.getByText(/Past medications \(1\)/).click();
  await expect(page.getByRole('link', { name: /Lamotrigine/ })).toContainText('Allergic reaction');

  await page.goto('/insights/report');
  await expect(page.getByRole('heading', { name: 'Past medications and why they were stopped' })).toBeVisible();
  const row = page.getByRole('row', { name: /Lamotrigine/ }).filter({ hasText: 'Allergic reaction' });
  await expect(row).toContainText('Hives after two days');
  await expect(row).toContainText('Rash');
  await expect(page.getByRole('heading', { name: 'Side effects noted' })).toBeVisible();
});

test('F-007: she can skip the reason, and add it later', async ({ page }) => {
  await onboard(page);
  await page.goto('/meds');
  await page.getByRole('link', { name: /Lamotrigine/ }).first().click();
  await page.getByRole('button', { name: 'I no longer take this' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Save and move to past medications' }).click(); // nothing chosen
  await page.getByText(/Past medications \(1\)/).click();
  await expect(page.getByRole('link', { name: /Lamotrigine/ })).toContainText('Reason not recorded');
  await page.getByRole('link', { name: /Lamotrigine/ }).click();
  await expect(page.getByRole('heading', { name: 'Why it was stopped' })).toBeVisible();
  await page.getByRole('button', { name: 'Add a reason' }).click();
  await page.getByRole('dialog').getByRole('radio', { name: /control my seizures/ }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByText('Did not control seizures')).toBeVisible();
});

test('F-001: side-effect screens have no accessibility violations (including the open sheet)', async ({ page }) => {
  await onboard(page);
  await page.goto('/meds/side-effects');
  await page.waitForTimeout(300);
  let r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
  expect(r.violations.map((v) => v.id)).toEqual([]);
  await page.getByRole('button', { name: 'Add a side effect' }).click();
  await page.waitForTimeout(300);
  r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
  expect(r.violations.map((v) => v.id)).toEqual([]);
  await page.getByRole('button', { name: 'Cancel' }).click();
  await page.goto('/meds');
  await page.getByRole('link', { name: /Lamotrigine/ }).first().click();
  await page.getByRole('button', { name: 'I no longer take this' }).click();
  await page.waitForTimeout(300);
  r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
  expect(r.violations.map((v) => v.id)).toEqual([]);
});

test('upgrade in a real browser: a database saved by the previous release opens and its side effects are kept as "date unknown"', async ({ page }) => {
  await page.goto('/favicon.svg'); // same origin, no app running, so nothing has opened the database yet
  await page.evaluate(async () => {
    // The release-2026-09-30-3 database: schema version 1 (IndexedDB version 10), exactly as that release created it.
    const stores: Record<string, string> = {
      profile: 'id',
      seizureEvents: 'id, timestamp',
      auraLogs: 'id, timestamp, seizureEventId',
      medications: 'id, isActive',
      medicationDoses: 'id, medicationId, scheduledTime, [medicationId+scheduledTime]',
      mealLogs: 'id, timestamp',
      hydrationLogs: 'id, timestamp',
      sleepEntries: 'id, &date',
      routineTemplates: 'id',
      routineChecklistItems: 'id, date, [date+templateItemId]',
      triggerTags: 'id, label',
      rescueProtocol: 'id',
      emergencyContacts: 'id, sortOrder',
      insightRules: 'id, correlationType',
      dailyCheckIns: 'id, &date',
      dayPlans: 'date',
      voiceNotes: 'id, seizureEventId',
      meta: 'key',
    };
    const db: IDBDatabase = await new Promise((resolve, reject) => {
      const req = indexedDB.open('steady', 10);
      req.onupgradeneeded = () => {
        for (const [name, spec] of Object.entries(stores)) {
          const parts = spec.split(',').map((x) => x.trim());
          const store = req.result.createObjectStore(name, { keyPath: parts[0] });
          for (const p of parts.slice(1)) {
            const unique = p.startsWith('&');
            const n = p.replace('&', '');
            const keyPath = n.startsWith('[') ? n.slice(1, -1).split('+') : n;
            store.createIndex(n, keyPath, { unique });
          }
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    const now = new Date().toISOString();
    const tx = db.transaction(['profile', 'medications'], 'readwrite');
    tx.objectStore('profile').put({
      id: 'p1', displayName: 'Test', dateOfBirth: null, epilepsyType: 'focal', seizureFocus: null, diagnosisDate: null, timezone: 'America/New_York',
      preferences: { theme: 'system', emergencyNumber: '911' }, onboarded: true, isSampleData: false, createdAt: now, updatedAt: now,
    });
    tx.objectStore('medications').put({
      id: 'm1', name: 'Keppra', genericName: null, dosage: '500', unit: 'mg', frequency: 'twice daily', scheduledTimes: ['08:00', '20:00'],
      prescriber: null, pharmacy: null, remainingCount: 20, unitsPerDose: 1, refillDate: null, refillReminderDays: 7, isActive: true, isRescue: false,
      startDate: '2026-01-01', endDate: null, sideEffectsNoted: ['Irritability', 'Tiredness'], notes: null, createdAt: now, updatedAt: now,
    });
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  });

  await page.goto('/meds/side-effects');
  await expect(page.getByRole('heading', { level: 1, name: 'Side effects' })).toBeVisible();
  await expect(page.getByRole('heading', { name: /Keppra/ })).toBeVisible();
  await expect(page.getByText('Irritability')).toBeVisible();
  await expect(page.getByText('Tiredness')).toBeVisible();
  await expect(page.getByText('Start date unknown')).toHaveCount(2);
  // the rest of her data is untouched and the app works
  await page.goto('/meds');
  await expect(page.getByText('Keppra')).toBeVisible();
  const db = await page.evaluate(async () => {
    const d: IDBDatabase = await new Promise((res, rej) => {
      const r = indexedDB.open('steady');
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
    const med: { sideEffectsNoted: string[] } = await new Promise((res) => {
      const g = d.transaction('medications').objectStore('medications').get('m1');
      g.onsuccess = () => res(g.result);
    });
    const v = d.version;
    d.close();
    return { version: v, old: med.sideEffectsNoted };
  });
  expect(db.version).toBe(30); // upgraded from version 1 through 2 to 3
  expect(db.old).toEqual(['Irritability', 'Tiredness']); // the old field is left exactly as it was
});

// ---- Release 5: F-003 log past days, F-004 calendar ----
const dayKey = (page: Page, offset: number) =>
  page.evaluate((o) => {
    const d = new Date();
    d.setDate(d.getDate() + o);
    const p = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  }, offset);

test('F-003: a medication that starts later is explained on the day, and doses appear once its start date is earlier', async ({ page }) => {
  await onboard(page);
  const d = await dayKey(page, -2);
  await page.goto(`/day/${d}`);
  await page.getByRole('button', { name: 'Add this day’s routine and medications' }).click();
  await expect(page.getByText('Some medications start after this day')).toBeVisible();
  await expect(page.getByText(/Lamotrigine was added to Steady on a later date/)).toBeVisible();
  await expect(page.getByRole('button', { name: /^Mark Lamotrigine .* as taken$/ })).toHaveCount(0);
  await page.getByRole('link', { name: 'Open Lamotrigine' }).click();
  await page.getByLabel('Started on').fill(await dayKey(page, -10));
  await page.getByRole('button', { name: 'Save changes' }).click();
  await page.goto(`/day/${d}`); // a day she already opened catches up
  await expect(page.getByRole('button', { name: /^Mark Lamotrigine .* as taken$/ }).first()).toBeVisible();
  await expect(page.getByText('Some medications start after this day')).toHaveCount(0);
});

test('F-003: from Today, open an earlier day, add its routine, and tick a dose and a meal as that day', async ({ page }) => {
  await onboard(page);
  await page.goto('/meds');
  await page.getByRole('link', { name: /Lamotrigine/ }).first().click();
  await page.getByLabel('Started on').fill(await dayKey(page, -10)); // she was taking it before she added it to Steady
  await page.getByRole('button', { name: 'Save changes' }).click();
  await page.goto('/');
  await page.getByRole('button', { name: 'Log from an earlier day' }).click();
  await page.getByRole('button', { name: /^Yesterday/ }).click();
  const yesterday = await dayKey(page, -1);
  await expect(page).toHaveURL(new RegExp(`/day/${yesterday}$`));
  await expect(page.getByText('Nothing is recorded for this day yet')).toBeVisible();
  await page.getByRole('button', { name: 'Add this day’s routine and medications' }).click();
  await expect(page.getByRole('heading', { name: 'Not recorded yet' })).toBeVisible();
  await expect(page.getByText('Not recorded yet').first()).toBeVisible();

  // a dose: recorded at its scheduled time, not "now"
  await page.getByRole('button', { name: /^Mark Lamotrigine .* as taken$/ }).first().click();
  await expect(page.getByRole('heading', { name: 'Recorded', exact: true })).toBeVisible();
  const taken = page.getByRole('listitem').filter({ hasText: 'Lamotrigine' }).filter({ hasText: /Taken at/ });
  await expect(taken).toHaveCount(1);
  await expect(taken).toContainText(/(8:00|08:00)/);

  // a meal: the meal log belongs to yesterday, not today
  await page.getByRole('button', { name: /^Mark Breakfast .* as done$/ }).first().click();
  const where = await page.evaluate(async () => {
    const db: IDBDatabase = await new Promise((res, rej) => {
      const r = indexedDB.open('steady');
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
    const rows: { timestamp: string }[] = await new Promise((res) => {
      const g = db.transaction('mealLogs').objectStore('mealLogs').getAll();
      g.onsuccess = () => res(g.result);
    });
    const dose: { scheduledTime: string; actualTime: string | null; status: string }[] = await new Promise((res) => {
      const g = db.transaction('medicationDoses').objectStore('medicationDoses').getAll();
      g.onsuccess = () => res(g.result);
    });
    db.close();
    const key = (iso: string) => {
      const d = new Date(iso);
      const p = (n: number) => String(n).padStart(2, '0');
      return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
    };
    return { meals: rows.map((r) => key(r.timestamp)), takenDoses: dose.filter((d) => d.status === 'taken').map((d) => [key(d.scheduledTime), d.actualTime && key(d.actualTime), d.actualTime === d.scheduledTime]) };
  });
  expect(where.meals).toEqual([yesterday]);
  expect(where.takenDoses).toEqual([[yesterday, yesterday, true]]);

  // back to today: nothing from yesterday leaked into today's progress
  await page.getByRole('link', { name: 'Back to today' }).click();
  await expect(page.getByText(/Today’s routine/)).toBeVisible();
});

test('F-003: add a seizure to a past day, and it returns to that day', async ({ page }) => {
  await onboard(page);
  const d = await dayKey(page, -3);
  await page.goto(`/day/${d}`);
  await expect(page.getByText('No seizures logged for this day.')).toBeVisible();
  await page.getByRole('link', { name: 'Log a seizure on this day' }).click();
  await expect(page.getByLabel('Started')).toHaveValue(`${d}T12:00`);
  await page.getByRole('button', { name: 'Save seizure' }).click();
  await expect(page).toHaveURL(new RegExp(`/day/${d}$`));
  await expect(page.getByRole('link', { name: /Focal aware/ })).toBeVisible();
});

test('F-003: sleep for any night, and a check-in for a past day', async ({ page }) => {
  await onboard(page);
  await page.goto('/sleep');
  await page.getByRole('button', { name: 'Log a different night' }).click();
  const night = await dayKey(page, -4);
  await page.getByLabel('Which night?').fill(night);
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('button', { name: 'Save sleep' }).click();
  await expect(page.getByText(/Night of/).first()).toBeVisible();

  // the day after that night shows it
  await page.goto(`/day/${await dayKey(page, -3)}`);
  await expect(page.getByText(/^\d{1,2}:\d{2}.* to \d{1,2}:\d{2}/)).toBeVisible();
  await page.getByRole('button', { name: 'Add a check-in' }).click();
  await expect(page.getByRole('dialog', { name: /^How was .*?$/ })).toBeVisible();
  await expect(page.getByRole('dialog', { name: 'How was today?' })).toHaveCount(0);
});

test('F-003: today and future days are not past days', async ({ page }) => {
  await onboard(page);
  await page.goto(`/day/${await dayKey(page, 0)}`);
  await expect(page.getByText(/Today’s routine/)).toBeVisible();
  await page.goto(`/day/${await dayKey(page, 3)}`);
  await expect(page.getByText(/Today’s routine/)).toBeVisible();
  await page.goto('/day/not-a-date');
  await expect(page.getByText(/Today’s routine/)).toBeVisible();
});

test('F-003: a medication she has since stopped appears on the days before she stopped it', async ({ page }) => {
  await onboard(page);
  const started = await dayKey(page, -10);
  const stopped = await dayKey(page, -2);
  await page.goto('/meds');
  await page.getByRole('link', { name: /Lamotrigine/ }).first().click();
  await page.getByLabel('Started on').fill(started);
  await page.getByRole('button', { name: 'Save changes' }).click();
  await page.getByRole('link', { name: /Lamotrigine/ }).first().click();
  await page.getByRole('button', { name: 'I no longer take this' }).click();
  await page.getByRole('dialog').getByLabel('When did you stop?').fill(stopped);
  await page.getByRole('dialog').getByRole('button', { name: 'Save and move to past medications' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Medications' })).toBeVisible();

  await page.goto(`/day/${await dayKey(page, -5)}`);
  await page.getByRole('button', { name: 'Add this day’s routine and medications' }).click();
  await expect(page.getByRole('listitem').filter({ hasText: 'Lamotrigine' }).first()).toBeVisible();

  await page.goto(`/day/${await dayKey(page, -1)}`); // after she stopped it
  await page.getByRole('button', { name: 'Add this day’s routine and medications' }).click();
  await expect(page.getByRole('heading', { name: 'Not recorded yet' })).toBeVisible();
  await expect(page.getByRole('listitem').filter({ hasText: 'Lamotrigine' })).toHaveCount(0);
});

test('F-004: the calendar shows markers as words, opens a day, and has a list view and month navigation', async ({ page }) => {
  await onboard(page);
  const d = await dayKey(page, -1);
  const month = d.slice(0, 7);
  // give yesterday a seizure
  await page.goto(`/day/${d}`);
  await page.getByRole('link', { name: 'Log a seizure on this day' }).click();
  await page.getByRole('button', { name: 'Save seizure' }).click();
  await expect(page).toHaveURL(new RegExp(`/day/${d}$`));

  await page.goto(`/calendar?m=${month}`);
  await expect(page.getByRole('heading', { level: 1, name: 'Calendar' })).toBeVisible();
  const cell = page.getByRole('link', { name: /: 1 seizure$/ });
  await expect(cell).toHaveCount(1);
  await expect(page.getByRole('columnheader').first()).toContainText('Monday'); // weeks start on Monday
  await expect(page.getByText('What the symbols mean')).toBeVisible();

  // list view: a real table with the same information in words
  await page.getByRole('radio', { name: 'List' }).click();
  const row = page.getByRole('row').filter({ hasText: '1 seizure' });
  await expect(row).toHaveCount(1);
  await expect(row.getByRole('link')).toBeVisible();
  await page.getByRole('radio', { name: 'Calendar' }).click();

  // open the day from the calendar
  await page.getByRole('link', { name: /: 1 seizure$/ }).click();
  await expect(page).toHaveURL(new RegExp(`/day/${d}$`));
  await page.goBack();

  // months: previous works, next is unavailable for the current month
  await page.getByRole('button', { name: 'Previous month' }).click();
  await expect(page.getByRole('button', { name: 'Back to this month' })).toBeVisible();
  await page.getByRole('button', { name: 'Back to this month' }).click();
  const thisMonth = (await dayKey(page, 0)).slice(0, 7);
  await page.goto(`/calendar?m=${thisMonth}`);
  await expect(page.getByRole('button', { name: 'Next month' })).toBeDisabled();
});

test('F-004: calendar and day pages have no accessibility violations and no animation', async ({ page }) => {
  await onboard(page);
  await page.goto(`/day/${await dayKey(page, -1)}`);
  await page.getByRole('button', { name: 'Add this day’s routine and medications' }).click();
  for (const path of ['/calendar', '/calendar?view=list', `/day/${await dayKey(page, -1)}`]) {
    await page.goto(path);
    await page.waitForTimeout(400);
    const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
    expect(r.violations, `${path}: ${r.violations.map((v) => v.id).join(', ')}`).toEqual([]);
  }
  await page.goto('/calendar');
  const fast = await page.evaluate(() => {
    const bad: string[] = [];
    for (const el of Array.from(document.querySelectorAll('*'))) {
      const cs = getComputedStyle(el);
      const durations = [...cs.transitionDuration.split(','), ...cs.animationDuration.split(',')].map((d) => d.trim()).map((d) => (d.endsWith('ms') ? parseFloat(d) : parseFloat(d) * 1000));
      if (durations.some((ms) => ms > 0 && ms < 300)) bad.push(el.tagName);
      if (cs.animationName !== 'none') bad.push('animation:' + el.tagName);
    }
    return bad;
  });
  expect(fast).toEqual([]);
  await page.goto('/');
  await page.getByRole('button', { name: 'Log from an earlier day' }).click();
  await page.waitForTimeout(300);
  const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
  expect(r.violations.map((v) => v.id)).toEqual([]);
});

// ---- Release 6: F-006 bowel and bladder, F-008 routines every N days with planned dose shifts ----
async function enableBathroom(page: Page) {
  await page.goto('/bathroom');
  await page.getByRole('switch', { name: /Keep track of bowel and bladder/ }).click();
  await expect(page.getByRole('heading', { name: 'A daily question in my routine' })).toBeVisible();
}

test('F-006: off by default; turning it on adds a quiet Today card with a one-tap counter and the bowel question', async ({ page }) => {
  await onboard(page);
  await expect(page.getByRole('heading', { name: 'Bathroom' })).toHaveCount(0); // nothing shown until she chooses it
  await enableBathroom(page);
  await page.goto('/');
  const card = page.getByRole('region', { name: 'Bathroom' });
  await expect(card).toContainText('Not recorded yet');
  await card.getByRole('button', { name: 'Add one urination' }).click();
  await card.getByRole('button', { name: 'Add one urination' }).click();
  await card.getByRole('button', { name: 'Add one urination' }).click();
  await expect(card).toContainText('Urinated today: 3 times');
  await card.getByRole('button', { name: 'Take one off' }).click();
  await expect(card).toContainText('Urinated today: 2 times');

  await card.getByRole('button', { name: 'Record' }).click();
  const sheet = page.getByRole('dialog', { name: 'Bowel and bladder today' });
  await sheet.getByRole('radio', { name: 'Yes' }).click();
  await sheet.getByRole('radio', { name: 'Hard or difficult' }).click();
  await sheet.getByLabel('What did you eat or drink beforehand? (optional)').fill('Papaya and tea');
  await sheet.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(card).toContainText('Yes, hard or difficult');
  await expect(card).toContainText('Last bowel movement: today');
});

test('F-006: the daily question is a routine item, and answering it ticks it off', async ({ page }) => {
  await onboard(page);
  await enableBathroom(page);
  await page.getByRole('button', { name: 'Add it to my routine' }).click();
  await expect(page.getByText('It’s in your routine.')).toBeVisible();
  await page.goto('/');
  await page.getByRole('button', { name: /Show later today/ }).click().catch(() => undefined);
  const item = page.getByRole('listitem').filter({ hasText: 'Bowel movement today?' });
  await expect(item).toBeVisible();
  await item.getByRole('button', { name: /^Mark Bowel movement today\? .* as done$/ }).click();
  const sheet = page.getByRole('dialog', { name: 'Bowel and bladder today' });
  await sheet.getByRole('radio', { name: 'No' }).click();
  await sheet.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByRole('region', { name: 'Bathroom' })).toContainText('Bowel movement today: No');
  const status = await page.evaluate(async () => {
    const db: IDBDatabase = await new Promise((res, rej) => {
      const r = indexedDB.open('steady');
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
    const rows: { category: string; status: string }[] = await new Promise((res) => {
      const g = db.transaction('routineChecklistItems').objectStore('routineChecklistItems').getAll();
      g.onsuccess = () => res(g.result);
    });
    db.close();
    return rows.filter((r) => r.category === 'bowel').map((r) => r.status);
  });
  expect(status).toEqual(['done']);
});

test('F-006: days since the last bowel movement is shown quietly, and past days can be filled in', async ({ page }) => {
  await onboard(page);
  await enableBathroom(page);
  const d = await dayKey(page, -3);
  await page.goto(`/day/${d}`);
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  const sheet = page.getByRole('dialog');
  await sheet.getByRole('radio', { name: 'Yes' }).click();
  await sheet.getByRole('radio', { name: 'Normal' }).click();
  await sheet.getByRole('button', { name: 'Save', exact: true }).click();
  await page.goto('/');
  await expect(page.getByRole('region', { name: 'Bathroom' })).toContainText('Last bowel movement: 3 days ago');
});

test('F-006: she chooses her own bathroom-break reminders', async ({ page }) => {
  await onboard(page);
  await enableBathroom(page);
  await page.getByLabel('Add a time').fill('10:00');
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  await page.getByRole('button', { name: 'Before bed' }).click();
  await expect(page.getByRole('button', { name: /Remove the 10:00 AM reminder/ })).toBeVisible();
  await expect(page.getByRole('button', { name: /Remove the .* reminder/ })).toHaveCount(2);
  await page.goto('/schedule');
  await expect(page.getByText(/Bathroom break/).first()).toBeVisible();
  await page.goto('/bathroom');
  await page.getByRole('button', { name: 'Clear all' }).click();
  await expect(page.getByText('No bathroom break reminders yet.')).toBeVisible();
});

test('F-006: bowel days show on the calendar as words, and in the report', async ({ page }) => {
  await onboard(page);
  await enableBathroom(page);
  const d = await dayKey(page, -2);
  await page.goto(`/day/${d}`);
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  await page.getByRole('dialog').getByRole('radio', { name: 'Yes' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Save', exact: true }).click();

  await page.goto(`/calendar?m=${d.slice(0, 7)}`);
  await expect(page.getByRole('link', { name: /: bowel movement$/ })).toHaveCount(1);
  await expect(page.getByText('Bowel movement', { exact: true })).toBeVisible(); // legend
  await page.getByRole('radio', { name: 'List' }).click();
  await expect(page.getByRole('row').filter({ hasText: 'bowel movement' })).toHaveCount(1);

  await page.goto('/insights/report');
  await expect(page.getByRole('heading', { name: 'Bowel and bladder' })).toBeVisible();
  await expect(page.getByText(/Bowel movements recorded on 1 day/)).toBeVisible();
});

test('F-006: the calendar does not mention bowel movements for someone who does not track them', async ({ page }) => {
  await onboard(page);
  await page.goto('/calendar');
  await expect(page.getByText('What the symbols mean')).toBeVisible();
  await expect(page.getByText('Bowel movement', { exact: true })).toHaveCount(0);
});

test('F-008: a routine that repeats every 6 days moves morning doses an hour later, and explains it', async ({ page }) => {
  await onboard(page);
  await page.goto('/schedule');
  await page.getByRole('button', { name: 'New routine' }).click();
  await expect(page.getByRole('button', { name: /^New routine/, pressed: true })).toBeVisible(); // wait until the new routine is the selected one
  await page.getByLabel('Routine name').fill('Toilet day');
  await page.waitForTimeout(900); // the name saves after a short pause
  await page.getByRole('radio', { name: 'Every few days' }).click();
  await expect(page.getByText('Use on these days')).toHaveCount(0); // weekdays don't apply to it
  await expect(page.getByLabel('Every how many days?')).toHaveValue('6');
  await expect(page.getByText(/Next:/)).toBeVisible();
  await page.getByLabel('Medication times on these days').selectOption('morning');
  await expect(page.getByLabel('How much later')).toHaveValue('60');
  await expect(page.getByText(/Only use this if your doctor has agreed/)).toBeVisible();
  await expect(page.getByText(/counts as on time/)).toBeVisible();

  // today is day 1 of the cycle: the dose is at 9:00, and Today says so
  await page.goto('/');
  await expect(page.getByText(/Using “Toilet day”/)).toBeVisible();
  await expect(page.getByText(/Medication times are 1 hour later today/)).toBeVisible();
  const dose = page.getByRole('listitem').filter({ hasText: 'Lamotrigine' }).first();
  await expect(dose).toContainText(/(9:00|09:00)/);
  await expect(dose).not.toContainText(/(8:00 AM|08:00)/);

  // taking it counts as a normal, on-time dose
  await dose.getByRole('button', { name: /^Mark Lamotrigine .* as taken$/ }).click();
  await page.getByRole('button', { name: /earlier today/ }).click(); // finished items are tucked away
  await expect(page.getByRole('listitem').filter({ hasText: 'Lamotrigine' }).filter({ hasText: /Taken at/ })).toHaveCount(1);
  const taken = await page.evaluate(async () => {
    const db: IDBDatabase = await new Promise((res, rej) => {
      const r = indexedDB.open('steady');
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
    const rows: { status: string; scheduledTime: string }[] = await new Promise((res) => {
      const g = db.transaction('medicationDoses').objectStore('medicationDoses').getAll();
      g.onsuccess = () => res(g.result);
    });
    db.close();
    // the dose that was taken is the one scheduled for 9:00, not 8:00
    return rows.filter((r) => r.status === 'taken' || r.status === 'taken_late').map((r) => new Date(r.scheduledTime).getHours());
  });
  expect(taken).toEqual([9]);
});

test('F-008: switching a routine back to weekdays turns the repeat off, and the usual day is unaffected', async ({ page }) => {
  await onboard(page);
  await page.goto('/schedule');
  await page.getByRole('button', { name: 'New routine' }).click();
  await expect(page.getByRole('button', { name: /^New routine/, pressed: true })).toBeVisible(); // wait until the new routine is the selected one
  await page.getByRole('radio', { name: 'Every few days' }).click();
  await page.getByLabel('Every how many days?').fill('1'); // not a usable number
  await expect(page.getByText('Use a whole number from 2 to 60.')).toBeVisible();
  await page.getByLabel('Every how many days?').fill('4');
  await page.getByRole('radio', { name: 'On certain weekdays' }).click();
  await expect(page.getByText('Use on these days')).toBeVisible();
  await page.goto('/');
  await expect(page.getByText(/Medication times are .* later today/)).toHaveCount(0);
  const dose = page.getByRole('listitem').filter({ hasText: 'Lamotrigine' }).first();
  await expect(dose).toContainText(/(8:00|08:00)/);
});

test('F-006/F-008: the new screens have no accessibility violations (including the open sheet)', async ({ page }) => {
  test.setTimeout(90_000);
  await onboard(page);
  await enableBathroom(page);
  await page.getByRole('button', { name: 'Add it to my routine' }).click();
  await page.getByRole('button', { name: 'Before bed' }).click();
  for (const path of ['/bathroom', '/']) {
    await page.goto(path);
    await page.waitForTimeout(400);
    const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
    expect(r.violations, `${path}: ${r.violations.map((v) => v.id).join(', ')}`).toEqual([]);
  }
  await page.getByRole('button', { name: 'Record' }).click();
  await page.getByRole('dialog').getByRole('radio', { name: 'Yes' }).click();
  await page.waitForTimeout(300);
  let r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
  expect(r.violations.map((v) => v.id)).toEqual([]);
  await page.keyboard.press('Escape');

  await page.goto('/schedule');
  await page.getByRole('button', { name: 'New routine' }).click();
  await expect(page.getByRole('button', { name: /^New routine/, pressed: true })).toBeVisible(); // wait until the new routine is the selected one
  await page.getByRole('radio', { name: 'Every few days' }).click();
  await page.getByLabel('Medication times on these days').selectOption('all');
  await page.waitForTimeout(300);
  r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
  expect(r.violations.map((v) => v.id), 'schedule').toEqual([]);
});

test('upgrade in a real browser (from version 2): a database saved by the previous release opens, keeps everything, and gets the bathroom table', async ({ page }) => {
  await page.goto('/favicon.svg');
  await page.evaluate(async () => {
    // release-2026-09-30-5: Dexie schema version 2 (IndexedDB version 20), with the sideEffects table.
    const stores: Record<string, string> = {
      profile: 'id', seizureEvents: 'id, timestamp', auraLogs: 'id, timestamp, seizureEventId', medications: 'id, isActive',
      medicationDoses: 'id, medicationId, scheduledTime, [medicationId+scheduledTime]', mealLogs: 'id, timestamp', hydrationLogs: 'id, timestamp',
      sleepEntries: 'id, &date', routineTemplates: 'id', routineChecklistItems: 'id, date, [date+templateItemId]', triggerTags: 'id, label',
      rescueProtocol: 'id', emergencyContacts: 'id, sortOrder', insightRules: 'id, correlationType', dailyCheckIns: 'id, &date',
      dayPlans: 'date', voiceNotes: 'id, seizureEventId', meta: 'key', sideEffects: 'id, medicationId, startDate',
    };
    const db: IDBDatabase = await new Promise((resolve, reject) => {
      const req = indexedDB.open('steady', 20);
      req.onupgradeneeded = () => {
        for (const [name, spec] of Object.entries(stores)) {
          const parts = spec.split(',').map((x) => x.trim());
          const store = req.result.createObjectStore(name, { keyPath: parts[0] });
          for (const p of parts.slice(1)) {
            const unique = p.startsWith('&');
            const n = p.replace('&', '');
            store.createIndex(n, n.startsWith('[') ? n.slice(1, -1).split('+') : n, { unique });
          }
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    const now = new Date().toISOString();
    const tx = db.transaction(['profile', 'medications', 'sideEffects', 'routineTemplates'], 'readwrite');
    tx.objectStore('profile').put({
      id: 'p1', displayName: 'Test', dateOfBirth: null, epilepsyType: 'focal', seizureFocus: null, diagnosisDate: null, timezone: 'America/New_York',
      preferences: { theme: 'system', emergencyNumber: '911' }, onboarded: true, isSampleData: false, createdAt: now, updatedAt: now,
    });
    tx.objectStore('medications').put({
      id: 'm1', name: 'Keppra', genericName: null, dosage: '500', unit: 'mg', frequency: 'twice daily', scheduledTimes: ['08:00', '20:00'], prescriber: null, pharmacy: null,
      remainingCount: 20, unitsPerDose: 1, refillDate: null, refillReminderDays: 7, isActive: true, isRescue: false, startDate: '2026-01-01', endDate: null,
      sideEffectsNoted: [], stopReason: null, stopReasonNote: null, notes: null, createdAt: now, updatedAt: now,
    });
    tx.objectStore('sideEffects').put({ id: 'se1', medicationId: 'm1', name: 'Tiredness', startDate: '2026-08-01', endDate: null, severity: 'mild', notes: null, createdAt: now, updatedAt: now });
    tx.objectStore('routineTemplates').put({
      id: 'r1', name: 'Everyday', isDefault: true, applicableDays: [0, 1, 2, 3, 4, 5, 6], createdAt: now, updatedAt: now,
      items: [{ id: 'i1', hour: 7, minute: 0, label: 'Wake up', category: 'sleep', linkedEntityId: null, reminderEnabled: true, reminderOffsetMinutes: 0, isOptional: false }],
    });
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  });

  await page.goto('/meds/side-effects');
  await expect(page.getByText('Tiredness')).toBeVisible(); // what she had is still there
  await page.goto('/');
  await expect(page.getByText('Wake up')).toBeVisible(); // a routine saved without the new settings behaves as before
  await page.goto('/bathroom');
  await page.getByRole('switch', { name: /Keep track of bowel and bladder/ }).click();
  await expect(page.getByRole('switch', { name: /Keep track of bowel and bladder/ })).toHaveAttribute('aria-checked', 'true'); // saved before we leave
  await page.goto('/');
  await page.getByRole('region', { name: 'Bathroom' }).getByRole('button', { name: 'Add one urination' }).click();
  await expect(page.getByRole('region', { name: 'Bathroom' })).toContainText('Urinated today: 1 time');
  const version = await page.evaluate(async () => {
    const d: IDBDatabase = await new Promise((res, rej) => {
      const r = indexedDB.open('steady');
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
    const v = { version: d.version, hasBathroom: d.objectStoreNames.contains('bathroomLogs') };
    d.close();
    return v;
  });
  expect(version).toEqual({ version: 30, hasBathroom: true });
});

// ---- Release 7: F-005 one timer for a warning sign or a seizure ----
const TIMER_START = 'steady.seizureTimerStart';
const TIMER_AURA = 'steady.seizureTimerAuraSec';

async function startTimerAgo(page: Page, secondsAgo: number) {
  await page.goto('/rescue');
  await expect(page.getByRole('heading', { level: 1, name: 'Rescue' })).toBeVisible(); // let the app finish loading first
  await page.evaluate(([k, s]) => localStorage.setItem(k as string, String(Date.now() - (s as number) * 1000)), [TIMER_START, secondsAgo]);
  await page.getByRole('button', { name: /start timer/ }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
}

test('F-005: the Rescue button is one timer for whatever is happening', async ({ page }) => {
  await onboard(page);
  await page.goto('/rescue');
  await expect(page.getByRole('button', { name: 'Something’s happening — start timer' })).toBeVisible();
  await page.getByRole('button', { name: /start timer/ }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Timer' })).toBeVisible();
  await expect(page.getByRole('link', { name: /Call 911/ })).toBeVisible();
  await expect(page.getByRole('button', { name: 'It has stopped' })).toBeVisible();
});

test('F-005: a warning sign only: stop, choose it, say what she noticed, and it is saved with how long it lasted', async ({ page }) => {
  await onboard(page);
  await startTimerAgo(page, 52);
  await page.getByRole('button', { name: 'It has stopped' }).click();
  await expect(page.getByRole('heading', { name: /What was it\?/ })).toBeVisible();
  await page.getByRole('button', { name: 'A warning sign (aura) only' }).click();
  await expect(page.getByRole('heading', { name: /A warning sign that lasted/ })).toBeVisible();
  await page.getByRole('button', { name: 'Déjà vu' }).click();
  await page.getByRole('button', { name: 'Save warning sign' }).click();
  await expect(page.getByText('Warning sign saved, with how long it lasted.')).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCount(0);

  await page.goto('/seizures');
  await page.getByRole('radio', { name: /Warning signs \(1\)/ }).click();
  const row = page.getByRole('listitem').filter({ hasText: 'Déjà vu' });
  await expect(row).toContainText(/lasted .*(5\d|1m)/);
  // nothing was put in the seizure log
  await page.getByRole('radio', { name: /Seizures \(0\)/ }).click();
  await expect(page.getByText('No seizures logged')).toBeVisible();
});

test('F-005: a warning sign that turns into a seizure is saved as one seizure with a linked warning sign at the same start', async ({ page }) => {
  await onboard(page);
  await startTimerAgo(page, 45);
  await page.getByRole('button', { name: 'It’s turning into a seizure' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Seizure timer' })).toBeVisible();
  await expect(page.getByText(/It began with a warning sign that lasted/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'It’s turning into a seizure' })).toHaveCount(0); // once only
  await page.getByRole('button', { name: 'It has stopped' }).click();
  // she already said it was a seizure, so no question is asked
  await expect(page.getByRole('heading', { name: /What was it\?/ })).toHaveCount(0);
  await page.getByRole('button', { name: 'Save to seizure log' }).click();
  await expect(page.getByRole('heading', { name: 'Seizure details' })).toBeVisible();

  const saved = await page.evaluate(async () => {
    const db: IDBDatabase = await new Promise((res, rej) => {
      const r = indexedDB.open('steady');
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
    const all = async <T,>(store: string): Promise<T[]> =>
      new Promise((res) => {
        const g = db.transaction(store).objectStore(store).getAll();
        g.onsuccess = () => res(g.result as T[]);
      });
    const seizures = await all<{ id: string; timestamp: string; auraIds: string[] }>('seizureEvents');
    const auras = await all<{ id: string; seizureEventId: string | null; timestamp: string; durationSeconds: number; progressedToSeizure: boolean }>('auraLogs');
    db.close();
    return { seizures, auras };
  });
  expect(saved.seizures).toHaveLength(1);
  expect(saved.auras).toHaveLength(1);
  expect(saved.auras[0].seizureEventId).toBe(saved.seizures[0].id);
  expect(saved.auras[0].timestamp).toBe(saved.seizures[0].timestamp); // the same start
  expect(saved.auras[0].durationSeconds).toBeGreaterThanOrEqual(45);
  expect(saved.auras[0].durationSeconds).toBeLessThan(60);
  expect(saved.auras[0].progressedToSeizure).toBe(true);
  expect(saved.seizures[0].auraIds).toEqual([saved.auras[0].id]);
  // it is not also listed as a warning sign on its own
  await page.goto('/seizures');
  await expect(page.getByRole('radio', { name: /Warning signs \(0\)/ })).toBeVisible();
});

test('F-005: after stopping, "it turned into a seizure after all" keeps the timer going', async ({ page }) => {
  await onboard(page);
  await startTimerAgo(page, 30);
  await page.getByRole('button', { name: 'It has stopped' }).click();
  await page.getByRole('button', { name: 'A warning sign (aura) only' }).click();
  await page.getByRole('button', { name: 'It turned into a seizure after all' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Seizure timer' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'It has stopped' })).toBeVisible(); // timing again
  await expect(page.getByText(/It began with a warning sign that lasted/)).toBeVisible();
});

test('F-005: a seizure chosen at the end is saved as before, and "it wasn’t a seizure" goes back to the question', async ({ page }) => {
  await onboard(page);
  await startTimerAgo(page, 6 * 60);
  await expect(page.getByRole('alert')).toContainText('5 minutes'); // the emergency alert still applies
  await page.getByRole('button', { name: 'It has stopped' }).click();
  await page.getByRole('button', { name: 'A seizure', exact: true }).click();
  await page.getByRole('button', { name: 'It wasn’t a seizure' }).click();
  await expect(page.getByRole('heading', { name: /What was it\?/ })).toBeVisible();
  await page.getByRole('button', { name: 'A seizure', exact: true }).click();
  await page.getByRole('button', { name: 'Save to seizure log' }).click();
  await expect(page.getByRole('heading', { name: 'Seizure details' })).toBeVisible();
});

test('F-005: the timer and what it recorded survive a reload', async ({ page }) => {
  await onboard(page);
  await startTimerAgo(page, 20);
  await page.getByRole('button', { name: 'It’s turning into a seizure' }).click();
  await page.reload();
  await expect(page.getByRole('heading', { level: 1, name: 'Seizure timer' })).toBeVisible();
  await expect(page.getByText(/It began with a warning sign that lasted/)).toBeVisible();
  await page.getByRole('button', { name: 'It has stopped' }).click();
  await page.getByRole('button', { name: 'Close without saving' }).click();
  expect(await page.evaluate(([a, b]) => [localStorage.getItem(a as string), localStorage.getItem(b as string)], [TIMER_START, TIMER_AURA])).toEqual([null, null]);
});

test('F-005: on the lock screen anyone can start the timer, but nothing is saved or asked', async ({ page }) => {
  await onboard(page);
  await setPasscodeAndLock(page);
  await page.getByRole('button', { name: 'Emergency info' }).click();
  await page.getByRole('button', { name: 'Start timer' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByRole('button', { name: 'It’s turning into a seizure' })).toHaveCount(0);
  await page.getByRole('button', { name: 'It has stopped' }).click();
  await expect(page.getByRole('button', { name: 'Save to seizure log' })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: /What was it\?/ })).toHaveCount(0);
  await page.getByRole('button', { name: 'Close without saving' }).click();
});

test('F-005: every timer screen has no accessibility violations', async ({ page }) => {
  test.setTimeout(90_000);
  await onboard(page);
  const check = async (label: string) => {
    await page.waitForTimeout(300);
    const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze();
    expect(r.violations.map((v) => v.id), label).toEqual([]);
  };
  await startTimerAgo(page, 20);
  await check('running');
  await page.getByRole('button', { name: 'It has stopped' }).click();
  await check('what was it');
  await page.getByRole('button', { name: 'A warning sign (aura) only' }).click();
  await check('warning sign');
  await page.getByRole('button', { name: 'Back' }).click();
  await page.getByRole('button', { name: 'A seizure', exact: true }).click();
  await check('seizure');
});
