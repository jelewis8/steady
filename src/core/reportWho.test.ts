import { describe, expect, it } from 'vitest';
import { reportWho } from './reportWho';

describe('reportWho: the report names the user, never "the patient"', () => {
  it('uses the name that was set up', () => {
    const w = reportWho('  Sam ');
    expect(w).toEqual({ name: 'Sam', by: 'Sam', possessive: 'Sam’s', Possessive: 'Sam’s' });
  });
  it('says "the user" when there is no name', () => {
    for (const n of ['', '   ', null, undefined]) {
      const w = reportWho(n);
      expect(w.name).toBeNull();
      expect(w.by).toBe('the user');
      expect(w.possessive).toBe('the user’s');
      expect(w.Possessive).toBe('The user’s');
    }
  });
  it('never produces the word "patient"', () => {
    expect(JSON.stringify([reportWho('Sam'), reportWho('')])).not.toMatch(/patient/i);
  });
});
