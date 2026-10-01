/**
 * Who the neurologist report is about. Uses the name the user set up, and says "the user" when there is none.
 * Never "the patient": the report is the user's own record, shared on their terms.
 */
export interface ReportWho {
  /** the name as set up, or null */
  name: string | null;
  /** "Sam" / "the user", for "entered by …" */
  by: string;
  /** "Sam’s" / "the user’s", for "… own records" mid-sentence */
  possessive: string;
  /** the same, for the start of a sentence or a heading */
  Possessive: string;
}

export function reportWho(displayName: string | null | undefined): ReportWho {
  const name = (displayName ?? '').trim() || null;
  return {
    name,
    by: name ?? 'the user',
    possessive: name ? `${name}’s` : 'the user’s',
    Possessive: name ? `${name}’s` : 'The user’s',
  };
}
