import { describe, expect, it } from 'vitest';
import { pageTitle } from './pageTitle';

describe('pageTitle (B-004)', () => {
  it('gives each page its own title, ending in the app name', () => {
    expect(pageTitle('/meds', 'Medications')).toBe('Medications – Steady');
    expect(pageTitle('/support', '  Support \n')).toBe('Support – Steady');
  });
  it('says Today on the home page, not the greeting with her name', () => {
    expect(pageTitle('/', 'Good evening, Sam')).toBe('Today – Steady');
  });
  it('falls back to the app name when there is no heading', () => {
    expect(pageTitle('/x', null)).toBe('Steady');
    expect(pageTitle('/x', '   ')).toBe('Steady');
  });
});
