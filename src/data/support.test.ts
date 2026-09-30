// @vitest-environment node
import { beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_PREFERENCES, SCHEMA_VERSION } from '../core/defaults';
import { parseEnvelope, summarizeData, type ExportEnvelope } from '../core/exportSchema';
import type { SafetyPlan } from '../core/types';
import backup20260927 from '../test/fixtures/backup-release-2026-09-27.json?raw';
import { db } from './db';
import { initDatabase, newContact, saveContact, saveSafetyPlan, setCountry, updatePreferences } from './repo';
import { storage } from './storage';

beforeEach(async () => {
  await storage.eraseAll();
  await initDatabase();
});

const plan = (over: Partial<SafetyPlan> = {}): SafetyPlan => ({
  warningSigns: 'Not sleeping',
  copingStrategies: 'Tea',
  distractions: '',
  helpers: '',
  professionals: '',
  makingSafe: '',
  reasonsForLiving: 'My family',
  message: 'Please call me',
  showOnLockScreen: false,
  updatedAt: '',
  ...over,
});

describe('F-002 data: migration 1.1.0 → 1.2.0', () => {
  it('opens the previous release’s backup and fills support fields with safe defaults, changing nothing else', () => {
    const raw = JSON.parse(backup20260927) as ExportEnvelope;
    const parsed = parseEnvelope(raw);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.warnings).toEqual([]);
    expect(parsed.envelope.schemaVersion).toBe(SCHEMA_VERSION);
    expect(SCHEMA_VERSION).toBe('1.2.0');
    const p = parsed.envelope.data.userProfile!;
    expect(p.safetyPlan).toBeNull();
    expect(p.preferences.country).toBeNull();
    expect(p.preferences.customSupportLines).toEqual([]);
    expect(p.preferences.defaultSupportContactId).toBeNull();
    // her existing settings are kept
    expect(p.preferences.emergencyNumber).toBe(raw.data.userProfile!.preferences.emergencyNumber);
    expect(p.displayName).toBe(raw.data.userProfile!.displayName);
    expect(parsed.envelope.data.emergencyContacts.every((c) => c.supportPerson === false)).toBe(true);
    expect(summarizeData(parsed.envelope.data)).toEqual(summarizeData(raw.data));
  });

  it('keeps a safety plan, country, own numbers and support flags through export and import (both modes)', async () => {
    await setCountry('PH');
    const c = { ...newContact(0), name: 'Ana', phone: '+63 900 000 0000', supportPerson: true };
    await saveContact(c);
    await updatePreferences({ defaultSupportContactId: c.id, customSupportLines: [{ id: 'x1', name: 'My counsellor', phone: '555 0101', textNumber: null }] });
    await saveSafetyPlan(plan({ showOnLockScreen: true }));
    const env = await storage.exportAll();

    for (const mode of ['replace', 'merge'] as const) {
      await storage.eraseAll();
      await initDatabase(); // a fresh device: default profile, nothing set
      const parsed = parseEnvelope(JSON.parse(JSON.stringify(env)));
      if (!parsed.ok) throw new Error(parsed.error);
      await storage.importAll(parsed.envelope, mode);
      const after = await storage.exportAll();
      const pf = after.data.userProfile!;
      expect(pf.safetyPlan?.warningSigns, mode).toBe('Not sleeping');
      expect(pf.safetyPlan?.showOnLockScreen).toBe(true);
      expect(pf.preferences.country).toBe('PH');
      expect(pf.preferences.customSupportLines[0].name).toBe('My counsellor');
      expect(pf.preferences.defaultSupportContactId).toBe(c.id);
      expect(after.data.emergencyContacts.find((x) => x.id === c.id)?.supportPerson).toBe(true);
    }
  });

  it('merge never overwrites what is already on the device', async () => {
    await setCountry('PH');
    await saveSafetyPlan(plan({ warningSigns: 'From the backup' }));
    await updatePreferences({ customSupportLines: [{ id: 'b1', name: 'Backup line', phone: '111', textNumber: null }] });
    const env = await storage.exportAll();

    await storage.eraseAll();
    await initDatabase();
    await setCountry('DE');
    await saveSafetyPlan(plan({ warningSigns: 'Already here' }));
    await updatePreferences({ customSupportLines: [{ id: 'd1', name: 'Device line', phone: '222', textNumber: null }] });
    const parsed = parseEnvelope(JSON.parse(JSON.stringify(env)));
    if (!parsed.ok) throw new Error(parsed.error);
    await storage.importAll(parsed.envelope, 'merge');
    const pf = (await db.profile.toCollection().first())!;
    expect(pf.safetyPlan?.warningSigns).toBe('Already here');
    expect(pf.preferences.country).toBe('DE');
    expect(pf.preferences.customSupportLines.map((l) => l.id).sort()).toEqual(['b1', 'd1']);
  });
});

describe('F-002 data: country and safety plan', () => {
  it('works on a profile saved before these fields existed', async () => {
    const p = (await db.profile.toCollection().first())!;
    // the profile exactly as release 2026-09-30-2 saved it: none of the new fields exist at all
    const oldPrefs: Record<string, unknown> = { ...p.preferences };
    for (const k of ['country', 'customSupportLines', 'defaultSupportContactId']) delete oldPrefs[k];
    const oldProfile: Record<string, unknown> = { ...p, preferences: oldPrefs };
    delete oldProfile.safetyPlan;
    await db.profile.put(oldProfile as never);
    await setCountry('DE');
    const after = (await db.profile.toCollection().first())!;
    expect(after.preferences.country).toBe('DE');
    expect(after.preferences.emergencyNumber).toBe('112'); // was the 911 starting value
  });

  it('switches the emergency number with the country only while it is still the default', async () => {
    await setCountry('GB');
    expect((await db.profile.toCollection().first())!.preferences.emergencyNumber).toBe('999');
    await setCountry('AU');
    expect((await db.profile.toCollection().first())!.preferences.emergencyNumber).toBe('000');
    await updatePreferences({ emergencyNumber: '1234' }); // her own choice
    await setCountry('NZ');
    const prefs = (await db.profile.toCollection().first())!.preferences;
    expect(prefs.country).toBe('NZ');
    expect(prefs.emergencyNumber).toBe('1234');
  });

  it('leaves the number alone for "somewhere else" and can be undone', async () => {
    await setCountry('GB');
    const undo = await setCountry('other');
    let prefs = (await db.profile.toCollection().first())!.preferences;
    expect(prefs.country).toBe('other');
    expect(prefs.emergencyNumber).toBe('999');
    await undo();
    prefs = (await db.profile.toCollection().first())!.preferences;
    expect(prefs.country).toBe('GB');
  });

  it('saves a safety plan, stamps it, and undo restores the previous plan', async () => {
    expect((await db.profile.toCollection().first())!.safetyPlan ?? null).toBeNull();
    await saveSafetyPlan(plan());
    const saved = (await db.profile.toCollection().first())!.safetyPlan!;
    expect(saved.warningSigns).toBe('Not sleeping');
    expect(saved.updatedAt).not.toBe('');
    const undo = await saveSafetyPlan(plan({ warningSigns: 'Changed' }));
    expect((await db.profile.toCollection().first())!.safetyPlan!.warningSigns).toBe('Changed');
    await undo();
    expect((await db.profile.toCollection().first())!.safetyPlan!.warningSigns).toBe('Not sleeping');
  });

  it('new installs start with no country, no plan and no extra numbers', () => {
    expect(DEFAULT_PREFERENCES.country).toBeNull();
    expect(DEFAULT_PREFERENCES.customSupportLines).toEqual([]);
    expect(DEFAULT_PREFERENCES.defaultSupportContactId).toBeNull();
  });
});
