import { describe, expect, it } from 'vitest';
import { COUNTRIES, CRISIS_LINES_CHECKED, GLOBAL_DIRECTORY, countryByCode, emergencyNumberFor, supportPeople } from './crisisLines';
import type { EmergencyContact } from './types';

describe('crisis line data (F-002)', () => {
  it('every country is complete, has sources, and is unique', () => {
    const codes = new Set<string>();
    for (const c of COUNTRIES) {
      expect(c.code, c.name).toMatch(/^[A-Z]{2}$/);
      expect(codes.has(c.code), `duplicate ${c.code}`).toBe(false);
      codes.add(c.code);
      expect(c.emergency, c.name).toMatch(/^\d{2,5}$/);
      expect(c.lines.length, `${c.name} needs at least one line`).toBeGreaterThan(0);
      expect(c.sources.length, `${c.name} needs a source`).toBeGreaterThan(0);
      for (const s of c.sources) {
        expect(s.url, `${c.name} source`).toMatch(/^https:\/\/\S+$/);
        expect(['official', 'excerpt']).toContain(s.quality);
      }
      // every country has at least one official-page source for its crisis lines
      expect(c.sources.some((s) => s.quality === 'official'), `${c.name} needs an official source`).toBe(true);
    }
    expect(CRISIS_LINES_CHECKED).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('every line can be reached by call or text, with a plausibly formed number', () => {
    for (const c of COUNTRIES) {
      for (const l of c.lines) {
        expect(l.call || l.text, `${c.name}: ${l.name}`).toBeTruthy();
        if (l.call) expect(l.call, `${c.name}: ${l.name}`).toMatch(/^[\d ]{2,16}$/);
        if (l.text) {
          expect(l.text.to, `${c.name}: ${l.name}`).toMatch(/^[\d ]{2,16}$/);
          expect(l.text.label.length).toBeGreaterThan(4);
        }
        if (l.web) expect(l.web).toMatch(/^https:\/\//);
      }
    }
  });

  it('countries are listed alphabetically so the picker is predictable', () => {
    const names = COUNTRIES.map((c) => c.name);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
  });

  /**
   * Golden values. Each was read on the official page named in docs/CRISIS-LINES.md on 2026-09-30.
   * If one of these fails, someone changed a safety number: re-verify it against its source before updating this test.
   */
  it('keeps the verified primary numbers exactly', () => {
    const primary = Object.fromEntries(COUNTRIES.map((c) => [c.code, [c.emergency, c.lines[0].call ?? c.lines[0].text?.to]]));
    expect(primary).toEqual({
      AU: ['000', '13 11 14'],
      CA: ['911', '988'],
      FR: ['112', '3114'],
      DE: ['112', '0800 111 0 111'],
      IN: ['112', '14416'],
      IE: ['112', '1800 247 247'],
      IT: ['112', '02 2327 2327'],
      NL: ['112', '113'],
      NZ: ['111', '1737'],
      PH: ['911', '1553'],
      ZA: ['112', '0800 567 567'],
      ES: ['112', '024'],
      GB: ['999', '116 123'],
      US: ['911', '988'],
    });
    expect(countryByCode('US')?.lines.find((l) => l.text?.to === '741741')?.text?.body).toBe('HOME');
    expect(countryByCode('GB')?.lines.find((l) => l.text?.to === '85258')?.text?.body).toBe('SHOUT');
    expect(countryByCode('IE')?.lines[0].text).toMatchObject({ to: '51444', body: 'HELP' });
    expect(countryByCode('AU')?.lines.find((l) => l.text)?.text?.to).toBe('0477 13 11 14');
  });

  it('only states hours the sources state (no invented hours)', () => {
    const allowed = new Set(['24 hours, every day', '5pm to midnight, every day']);
    for (const c of COUNTRIES) for (const l of c.lines) if (l.hours) expect(allowed.has(l.hours), `${c.name}: ${l.name}: ${l.hours}`).toBe(true);
  });

  it('looks up countries and falls back to 911 before a country is chosen', () => {
    expect(countryByCode('DE')?.name).toBe('Germany');
    expect(countryByCode('other')).toBeNull();
    expect(countryByCode(null)).toBeNull();
    expect(emergencyNumberFor('GB')).toBe('999');
    expect(emergencyNumberFor(null)).toBe('911');
    expect(emergencyNumberFor('other')).toBe('911');
    expect(GLOBAL_DIRECTORY.url).toBe('https://findahelpline.com/');
  });
});

describe('supportPeople', () => {
  const c = (id: string, supportPerson: boolean, phone = '+1 555 0100') => ({ id, name: id, supportPerson, phone }) as EmergencyContact;
  it('lists only people she chose who have a number, main person first', () => {
    const list = supportPeople([c('a', true), c('b', false), c('c', true), c('d', true, '  ')], 'c');
    expect(list.map((x) => x.id)).toEqual(['c', 'a']);
  });
  it('keeps contact order when there is no main person', () => {
    expect(supportPeople([c('a', true), c('b', true)], null).map((x) => x.id)).toEqual(['a', 'b']);
  });
});

describe('inCountry', () => {
  it('reads naturally in a sentence', async () => {
    const { inCountry } = await import('./crisisLines');
    expect(inCountry(countryByCode('PH')!)).toBe('the Philippines');
    expect(inCountry(countryByCode('US')!)).toBe('the United States');
    expect(inCountry(countryByCode('DE')!)).toBe('Germany');
  });
});
