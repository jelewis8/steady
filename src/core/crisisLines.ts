/**
 * Crisis lines and emergency numbers by country (F-002).
 *
 * RULES FOR EDITING THIS FILE
 * - Never add a number from memory. Every number here was read on the source pages listed for its country
 *   (see docs/CRISIS-LINES.md for the verification log and how to re-check).
 * - Only state hours if the source states them. Otherwise leave `hours` out.
 * - When a number changes or a source can't confirm it any more, remove it. A missing number is safer than a wrong one.
 * - Keep `CHECKED` current when you re-verify.
 */

import type { EmergencyContact } from './types';

export const CRISIS_LINES_CHECKED = '2026-09-30';

export interface CrisisLine {
  name: string;
  /** Number to dial, exactly as the source writes it (spaces allowed). */
  call?: string;
  /** A text service: send `body` (if any) to `to`. `label` is the plain-language instruction, e.g. "Text HOME to 741741". */
  text?: { to: string; body?: string; label: string };
  /** Only as stated by the source. */
  hours?: string;
  note?: string;
  /** Service website shown as a link (chat, etc.). */
  web?: string;
}

export interface CountrySource {
  label: string;
  url: string;
  /** official: read on the government/operator's own page. excerpt: confirmed from excerpts of official pages (the page itself was blocked when checked). */
  quality: 'official' | 'excerpt';
}

export interface CountrySupport {
  /** ISO 3166-1 alpha-2 */
  code: string;
  name: string;
  /** Default emergency number for this country. */
  emergency: string;
  emergencyNote?: string;
  lines: CrisisLine[];
  sources: CountrySource[];
}

const EU_112: CountrySource = { label: 'HSE (Ireland): 112 works in any EU country', url: 'https://www2.hse.ie/emergencies/when-to-call-112-or-999/', quality: 'official' };

export const COUNTRIES: CountrySupport[] = [
  {
    code: 'AU',
    name: 'Australia',
    emergency: '000',
    lines: [
      { name: 'Lifeline', call: '13 11 14', hours: '24 hours, every day', web: 'https://www.lifeline.org.au/' },
      { name: 'Lifeline text', text: { to: '0477 13 11 14', label: 'Text 0477 13 11 14' }, hours: '24 hours, every day' },
    ],
    sources: [
      { label: 'Lifeline: call', url: 'https://www.lifeline.org.au/get-help/services/131114', quality: 'official' },
      { label: 'Lifeline: text', url: 'https://www.lifeline.org.au/get-help/services/text', quality: 'official' },
    ],
  },
  {
    code: 'CA',
    name: 'Canada',
    emergency: '911',
    lines: [{ name: '9-8-8 Suicide Crisis Helpline', call: '988', text: { to: '988', label: 'Text 9-8-8' }, hours: '24 hours, every day', web: 'https://988.ca/' }],
    sources: [
      { label: '988.ca', url: 'https://988.ca/', quality: 'official' },
      { label: 'Government of Canada: get help', url: 'https://www.canada.ca/en/public-health/services/mental-health-services/mental-health-get-help.html', quality: 'official' },
    ],
  },
  {
    code: 'FR',
    name: 'France',
    emergency: '112',
    emergencyNote: '112 works across the EU.',
    lines: [{ name: '3114, national suicide prevention number', call: '3114', hours: '24 hours, every day', note: 'Free.' }],
    sources: [{ label: '3114.fr (run by the health ministry)', url: 'https://3114.fr/', quality: 'official' }, EU_112],
  },
  {
    code: 'DE',
    name: 'Germany',
    emergency: '112',
    emergencyNote: '112 works across the EU.',
    lines: [
      { name: 'TelefonSeelsorge', call: '0800 111 0 111', note: 'Free.', web: 'https://www.telefonseelsorge.de/' },
      { name: 'TelefonSeelsorge (second number)', call: '0800 111 0 222', note: 'Free.' },
      { name: 'TelefonSeelsorge (short number)', call: '116 123', note: 'Free.' },
    ],
    sources: [{ label: 'telefonseelsorge.de', url: 'https://www.telefonseelsorge.de/', quality: 'official' }, EU_112],
  },
  {
    code: 'IN',
    name: 'India',
    emergency: '112',
    lines: [{ name: 'Tele-MANAS (Ministry of Health)', call: '14416', hours: '24 hours, every day', note: 'Toll-free.' }],
    sources: [
      { label: 'PIB: Tele-MANAS launch', url: 'https://www.pib.gov.in/PressReleasePage.aspx?PRID=1866498&reg=48&lang=2', quality: 'official' },
      { label: 'Ministry of Home Affairs: 112', url: 'https://www.mha.gov.in/en/commoncontent/emergency-response-support-system-erss', quality: 'official' },
    ],
  },
  {
    code: 'IE',
    name: 'Ireland',
    emergency: '112',
    emergencyNote: '999 also works. Both are free.',
    lines: [
      {
        name: 'Pieta crisis helpline',
        call: '1800 247 247',
        text: { to: '51444', body: 'HELP', label: 'Text HELP to 51444' },
        hours: '24 hours, every day',
        web: 'https://www.pieta.ie/',
      },
    ],
    sources: [
      { label: 'Pieta', url: 'https://www.pieta.ie/', quality: 'official' },
      { label: 'HSE: when to call 112 or 999', url: 'https://www2.hse.ie/emergencies/when-to-call-112-or-999/', quality: 'official' },
    ],
  },
  {
    code: 'IT',
    name: 'Italy',
    emergency: '112',
    emergencyNote: '112 works across the EU.',
    lines: [{ name: 'Telefono Amico Italia', call: '02 2327 2327', hours: '24 hours, every day', web: 'https://www.telefonoamico.it/' }],
    sources: [{ label: 'telefonoamico.it', url: 'https://www.telefonoamico.it/', quality: 'official' }, EU_112],
  },
  {
    code: 'NL',
    name: 'Netherlands',
    emergency: '112',
    emergencyNote: '112 works across the EU.',
    lines: [{ name: '113 Zelfmoordpreventie', call: '113', note: 'Free, and you can stay anonymous.', web: 'https://www.113.nl/' }],
    sources: [{ label: '113.nl', url: 'https://www.113.nl/', quality: 'official' }, EU_112],
  },
  {
    code: 'NZ',
    name: 'New Zealand',
    emergency: '111',
    lines: [{ name: '1737, need to talk?', call: '1737', text: { to: '1737', label: 'Text 1737' }, hours: '24 hours, every day', note: 'Free.', web: 'https://1737.org.nz/' }],
    sources: [{ label: '1737.org.nz', url: 'https://1737.org.nz/', quality: 'official' }],
  },
  {
    code: 'PH',
    name: 'Philippines',
    emergency: '911',
    lines: [
      { name: 'NCMH Crisis Hotline', call: '1553', hours: '24 hours, every day', note: 'National Center for Mental Health.' },
      { name: 'NCMH Crisis Hotline (Globe / TM mobile)', call: '0917 899 8727', hours: '24 hours, every day' },
      { name: 'NCMH Crisis Hotline (Globe / TM mobile)', call: '0966 351 4518', hours: '24 hours, every day' },
      { name: 'NCMH Crisis Hotline (Smart / Sun / TNT mobile)', call: '0908 639 2672', hours: '24 hours, every day' },
      { name: 'NCMH Emergency Section (direct line)', call: '(02) 8531-5275', note: 'The hospital in Mandaluyong.' },
      { name: 'NCMH main line (trunk line)', call: '(02) 8531-9001', note: 'The hospital in Mandaluyong.' },
    ],
    sources: [
      { label: 'PH e-government hotlines: 911', url: 'https://ehotlines.e.gov.ph/', quality: 'official' },
      { label: 'NCMH contact page: trunk line and Emergency Section (text supplied by Jeremiah from the page)', url: 'https://ncmh.gov.ph/contact-us/', quality: 'official' },
      { label: 'Department of Health: NCMH Crisis Hotline', url: 'https://doh.gov.ph/NCMH-Crisis-Hotline', quality: 'excerpt' },
      { label: 'Philippine News Agency / Information Agency: NCMH hotline', url: 'https://www.pna.gov.ph/articles/1068742', quality: 'excerpt' },
    ],
  },
  {
    code: 'ZA',
    name: 'South Africa',
    emergency: '112',
    emergencyNote: '112 works from a mobile phone. Ambulance: 10177. Police: 10111.',
    lines: [{ name: 'SADAG Suicide Crisis Helpline', call: '0800 567 567', hours: '24 hours, every day', note: 'Toll-free.', web: 'https://www.sadag.org/' }],
    sources: [
      { label: 'SADAG', url: 'https://www.sadag.org/', quality: 'official' },
      { label: 'Western Cape Government: emergency numbers', url: 'https://www.westerncape.gov.za/know-who-you-can-call-emergency', quality: 'official' },
    ],
  },
  {
    code: 'ES',
    name: 'Spain',
    emergency: '112',
    emergencyNote: '112 works across the EU.',
    lines: [{ name: '024, suicide behaviour helpline', call: '024', hours: '24 hours, every day', note: 'Free and confidential. Run by the health ministry.' }],
    sources: [{ label: 'Ministerio de Sanidad: línea 024', url: 'https://www.sanidad.gob.es/linea024/home.htm', quality: 'official' }, EU_112],
  },
  {
    code: 'GB',
    name: 'United Kingdom',
    emergency: '999',
    lines: [
      { name: 'Samaritans', call: '116 123', hours: '24 hours, every day', note: 'Free from any phone.', web: 'https://www.samaritans.org/' },
      { name: 'Shout text line', text: { to: '85258', body: 'SHOUT', label: 'Text SHOUT to 85258' }, hours: '24 hours, every day', web: 'https://giveusashout.org/' },
      { name: 'NHS 111', call: '111', hours: '24 hours, every day', note: 'They will help you find the support you need.' },
      { name: 'CALM', call: '0800 58 58 58', hours: '5pm to midnight, every day', web: 'https://www.thecalmzone.net/' },
    ],
    sources: [
      { label: 'Samaritans', url: 'https://www.samaritans.org/how-we-can-help/contact-samaritan/', quality: 'official' },
      { label: 'NHS: help for suicidal thoughts', url: 'https://www.nhs.uk/mental-health/feelings-symptoms-behaviours/behaviours/help-for-suicidal-thoughts/', quality: 'official' },
      { label: 'NHS: when to call 999', url: 'https://www.nhs.uk/nhs-services/urgent-and-emergency-care-services/when-to-call-999/', quality: 'official' },
    ],
  },
  {
    code: 'US',
    name: 'United States',
    emergency: '911',
    lines: [
      { name: '988 Suicide & Crisis Lifeline', call: '988', text: { to: '988', label: 'Text 988' }, hours: '24 hours, every day', web: 'https://988lifeline.org/' },
      { name: 'Crisis Text Line', text: { to: '741741', body: 'HOME', label: 'Text HOME to 741741' }, hours: '24 hours, every day', web: 'https://www.crisistextline.org/' },
    ],
    sources: [
      { label: '988lifeline.org', url: 'https://988lifeline.org/', quality: 'official' },
      { label: 'Crisis Text Line', url: 'https://www.crisistextline.org/', quality: 'official' },
      { label: 'FCC: 911 services', url: 'https://www.fcc.gov/general/9-1-1-and-e9-1-1-services', quality: 'excerpt' },
    ],
  },
];

/** International directory for anyone outside the list. It is a link to read, not something Steady loads. */
export const GLOBAL_DIRECTORY = { name: 'Find A Helpline (international directory)', url: 'https://findahelpline.com/', note: 'Lists helplines in more than 175 countries.' };

/** "the Philippines", "the United States", "Germany": the name as used in a sentence. */
export function inCountry(c: CountrySupport): string {
  return ['PH', 'US', 'GB', 'NL'].includes(c.code) ? `the ${c.name}` : c.name;
}

export function countryByCode(code: string | null | undefined): CountrySupport | null {
  return COUNTRIES.find((c) => c.code === code) ?? null;
}

/** Emergency number for a country, or the US default when none is chosen yet. */
export function emergencyNumberFor(code: string | null | undefined): string {
  return countryByCode(code)?.emergency ?? '911';
}

/** The people she chose to reach out to (with a phone number), the main person first. */
export function supportPeople(contacts: EmergencyContact[], defaultId: string | null): EmergencyContact[] {
  const people = contacts.filter((c) => c.supportPerson && c.phone.trim());
  return [...people].sort((a, b) => Number(b.id === defaultId) - Number(a.id === defaultId));
}
