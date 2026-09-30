/**
 * Side-effect log and "medications that didn't work out" (F-001, F-007).
 * Pure logic, shared by the screens, the report, the Dexie upgrade and the import migration.
 */
import { formatDateShort } from './time';
import type { ISODate, Medication, SideEffectLog, SideEffectSeverity, StopReason } from './types';

export const STOP_REASON_LABELS: Record<StopReason, string> = {
  not_controlling: 'It didn’t control my seizures',
  side_effects: 'Side effects',
  allergic_reaction: 'Allergic reaction',
  cost_or_access: 'Cost or access (I couldn’t get or afford it)',
  other: 'Another reason',
};

/** Short form for the report. */
export const STOP_REASON_SHORT: Record<StopReason, string> = {
  not_controlling: 'Did not control seizures',
  side_effects: 'Side effects',
  allergic_reaction: 'Allergic reaction',
  cost_or_access: 'Cost or access',
  other: 'Other reason',
};

export const SEVERITY_TEXT: Record<SideEffectSeverity, string> = { mild: 'Mild', moderate: 'Moderate', severe: 'Severe' };

/**
 * A stable UUID-shaped id made from text. The Dexie upgrade and the import migration both turn an old
 * `sideEffectsNoted` entry into a record; using the same id in both means restoring an old backup never duplicates them.
 */
export function deterministicId(seed: string): string {
  let h1 = 1779033703,
    h2 = 3144134277,
    h3 = 1013904242,
    h4 = 2773480762;
  for (let i = 0; i < seed.length; i++) {
    const k = seed.charCodeAt(i);
    h1 = h2 ^ Math.imul(h1 ^ k, 597399067);
    h2 = h3 ^ Math.imul(h2 ^ k, 2869860233);
    h3 = h4 ^ Math.imul(h3 ^ k, 951274213);
    h4 = h1 ^ Math.imul(h4 ^ k, 2716044179);
  }
  h1 = Math.imul(h3 ^ (h1 >>> 18), 597399067);
  h2 = Math.imul(h4 ^ (h2 >>> 22), 2869860233);
  h3 = Math.imul(h1 ^ (h3 >>> 17), 951274213);
  h4 = Math.imul(h2 ^ (h4 >>> 19), 2716044179);
  h1 ^= h2 ^ h3 ^ h4;
  h2 ^= h1;
  h3 ^= h1;
  h4 ^= h1;
  const hex = [h1, h2, h3, h4].map((n) => (n >>> 0).toString(16).padStart(8, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-${'89ab'[parseInt(hex[16], 16) % 4]}${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

/**
 * Turn the old undated `Medication.sideEffectsNoted` lists into log entries with "date unknown" (startDate = null).
 * The old field is left in place (never deleted), so rolling back to an earlier release loses nothing.
 */
export function sideEffectsFromNotes(meds: Pick<Medication, 'id' | 'sideEffectsNoted' | 'updatedAt'>[]): SideEffectLog[] {
  const out: SideEffectLog[] = [];
  for (const m of meds) {
    const seen = new Set<string>();
    for (const raw of m.sideEffectsNoted ?? []) {
      const name = String(raw ?? '').trim();
      const key = name.toLowerCase();
      if (!name || seen.has(key)) continue;
      seen.add(key);
      const at = m.updatedAt || new Date().toISOString();
      out.push({
        id: deterministicId(`side-effect|${m.id}|${key}`),
        medicationId: m.id,
        name,
        startDate: null,
        endDate: null,
        severity: null,
        notes: null,
        createdAt: at,
        updatedAt: at,
      });
    }
  }
  return out;
}

/** "Started 12 Sep 2026 · stopped 20 Sep 2026", "Start date unknown", "Started 12 Sep 2026 · still happening". */
export function describeSideEffectDates(se: Pick<SideEffectLog, 'startDate' | 'endDate'>): string {
  const start = se.startDate ? `Started ${formatDateShort(se.startDate)}` : 'Start date unknown';
  if (se.endDate) return `${start} · stopped ${formatDateShort(se.endDate)}`;
  return se.startDate ? `${start} · still happening` : start;
}

/** null when fine, otherwise a plain sentence. */
export function sideEffectProblem(startDate: ISODate | null, endDate: ISODate | null): string | null {
  if (startDate && endDate && endDate < startDate) return 'The stop date is before the start date. Check the two dates.';
  return null;
}

/** Newest start first; entries with no date come last. */
export function sortSideEffects(list: SideEffectLog[]): SideEffectLog[] {
  return [...list].sort((a, b) => {
    if (a.startDate && b.startDate) return a.startDate < b.startDate ? 1 : a.startDate > b.startDate ? -1 : a.name.localeCompare(b.name);
    if (a.startDate) return -1;
    if (b.startDate) return 1;
    return a.name.localeCompare(b.name);
  });
}

export interface SideEffectGroup {
  /** null = "not sure which medication" */
  medication: Medication | null;
  entries: SideEffectLog[];
}

/** Side effects grouped by medication (current first, then past, then "not sure which"). */
export function groupSideEffects(effects: SideEffectLog[], meds: Medication[]): SideEffectGroup[] {
  const groups: SideEffectGroup[] = [];
  const ordered = [...meds].sort((a, b) => Number(b.isActive) - Number(a.isActive) || a.name.localeCompare(b.name));
  for (const m of ordered) {
    const entries = sortSideEffects(effects.filter((e) => e.medicationId === m.id));
    if (entries.length) groups.push({ medication: m, entries });
  }
  const known = new Set(meds.map((m) => m.id));
  const loose = sortSideEffects(effects.filter((e) => !e.medicationId || !known.has(e.medicationId)));
  if (loose.length) groups.push({ medication: null, entries: loose });
  return groups;
}

export interface PastMedicationRow {
  medication: Medication;
  reason: StopReason | null;
  reasonText: string;
  note: string;
  period: string;
  sideEffects: SideEffectLog[];
}

/** Medications no longer taken, for the report: what, when, why, and the side effects logged against them. */
export function pastMedicationsForReport(meds: Medication[], effects: SideEffectLog[]): PastMedicationRow[] {
  return meds
    .filter((m) => !m.isActive)
    .sort((a, b) => String(b.endDate ?? '').localeCompare(String(a.endDate ?? '')) || a.name.localeCompare(b.name))
    .map((m) => {
      const reason = m.stopReason ?? null;
      const period = `${m.startDate ? `Started ${formatDateShort(m.startDate)}` : 'Start date unknown'}${m.endDate ? ` · stopped ${formatDateShort(m.endDate)}` : ''}`;
      return {
        medication: m,
        reason,
        reasonText: reason ? STOP_REASON_SHORT[reason] : 'Reason not recorded',
        note: (m.stopReasonNote ?? '').trim(),
        period,
        sideEffects: sortSideEffects(effects.filter((e) => e.medicationId === m.id)),
      };
    });
}
