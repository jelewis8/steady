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
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
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
