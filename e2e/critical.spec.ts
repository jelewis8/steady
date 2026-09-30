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
  await page.getByRole('button', { name: 'The seizure has stopped' }).click();
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
  realBackup && existsSync(realBackup) ? [{ label: 'real backup', path: join(process.cwd(), realBackup), expect: /0 seizure events, 2 medications, 9 dose records, 2 sleep entries/ }] : [],
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
  expect(db.version).toBe(20);
  expect(db.old).toEqual(['Irritability', 'Tiredness']); // the old field is left exactly as it was
});
