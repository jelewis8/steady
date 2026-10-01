# Features & Requests

New features and bigger improvements for Steady. Bugs go in [BUGS.md](BUGS.md).

## How to use this list

**Add a feature:**

```
- [ ] **F-000** · 2026-09-30 · requested by: … · Short title
  - What and why, in the requester's words where possible.
  - Design notes / open questions.
```

- **Priority:** **Safety** (protects life or health; do first) · **High** · **Normal**.
- **When shipped:** tick it, move it to **Done**, add ` → release-YYYY-MM-DD`, and mention the ID in the commit (`Add F-003: past-day logging`).
- **Data model:** any feature that adds stored data must follow the data-safety rules in [docs/WORKFLOW.md](docs/WORKFLOW.md): a new Dexie version with an upgrade step, a `SCHEMA_VERSION` bump, and an import migration. Do **B-006** (the upgrade test) first.

The next free ID is **F-013**.

---

## Open

### Safety

_(none open)_

### High

_(none open)_

### Normal

- [ ] **F-012** · 2026-10-01 · from F-010 · **Label-backed notes about a drug and bowel or bladder** (parked until a clinical reviewer is available)
  - "Drug X lists constipation / urinary retention among adverse reactions in its prescribing information." This is the only part of F-010 that says something about a drug, so it is **not built**. Plan: for each recognised medication, copy the GI and urinary lines from the current DailyMed label (store the label date, section and citation next to each string), show it only when the user's records overlap a start or dose change of that drug, and have a clinical pharmacist or epileptologist approve the strings and the report footnote before it ships. Sources and wording rules are in the F-010 notes below. Never treat a FAERS signal as a labelled reaction.

---

## Done

- [x] **F-011** · 2026-10-01 · Dated dose changes. Editing a dose now asks "A new dose (from which day)" or "Fixing a mistake" (a correction adds nothing); the medication screen has a "Dose changes" history with add, edit and remove (undo offered), so past changes can be entered by hand too. Dose changes are comparison dates in the F-010 bowel and bladder card (shown as "dose changed on … (100 mg to 150 mg)"), and the neurologist report lists them. New table (Dexie version 4, schema 1.6.0); nothing existing is changed; older backups open with no dose changes → release-2026-10-01-5
- [x] **F-010** · 2026-10-01 · Bowel and bladder next to medication dates: an Insights card with a day grid (bowel movement per day, ▲ on days a medication was started or stopped, with a table view) and, for each start or stop date, the user's own counts for the 14 days before and from that day (days recorded, bowel movements, longest stretch without one, average urinations), only when each side has at least 5 recorded days. Other starts or stops in the same weeks are named. The same table is in the neurologist report. **Plain counts only, with a fixed non-causal note, no test, no claim about any drug, no dose advice, so it needs no clinical sign-off.** Label-backed statements are parked as F-012; dose-change dates as F-011 → release-2026-10-01-4

- [x] **F-009** · 2026-10-01 · Mood, depression and anxiety: the daily check-in gains "how low or depressed" and "how anxious" (1 to 5) and a private "why" diary note; Day page shows them; the neurologist report gets "Mood and anxiety" (counts and averages only, notes only if the user chooses); a support link is always in the check-in, never triggered by a score → release-2026-10-01-2

- [x] **F-005** · 2026-10-01 · One timer for a warning sign or a seizure: "Something's happening — start timer"; when stopped the user chooses a seizure or a warning sign (saved with how long it lasted); "It's turning into a seizure" records the warning's length, keeps timing, and saves one seizure with a linked warning sign at the same start → release-2026-10-01

- [x] **F-006** · 2026-09-30 · Bowel and bladder tracking (off until turned on): Today card with a quiet "days since last bowel movement" and a one-tap counter, the daily bowel question as a routine item, plain-language texture choices, optional notes on what the user ate or drank, their own bathroom-break reminder times, calendar marker, report section → release-2026-09-30-6
- [x] **F-008** · 2026-09-30 · Routines that repeat every N days from a start date, and planned medication shifts (morning or all doses, 15 min to 2 h later); shifted doses count as on time; Steady never suggests a shift → release-2026-09-30-6
- [x] **F-003** · 2026-09-30 · Log things after the fact, clearly: "Log from an earlier day" on Today opens any past day (doses, routine, seizures, sleep, check-in), recorded at that day's times; sleep for any night → release-2026-09-30-5
- [x] **F-004** · 2026-09-30 · Calendar: Monday-start month grid with icon-plus-words markers (seizures, warning signs, missed/unsure/unrecorded doses, short sleep, period) and a table list view; bowel days come with F-006 → release-2026-09-30-5
- [x] **F-001** · 2026-09-30 · Dated side-effect log (medication or "not sure which", start and stop dates, severity, notes), in the neurologist report; the old undated list was migrated to "date unknown" → release-2026-09-30-4
- [x] **F-007** · 2026-09-30 · Medications that didn't work out: "I no longer take this" asks the date and (optionally) why; the report has "Past medications and why they were stopped"; allergic reactions also appear on the action plan under Allergies → release-2026-09-30-4
- [x] **F-002** · 2026-09-30 · Support for thoughts of suicide or self-harm: Support page (crisis lines by country, call/text a trusted person, emergency call), personal safety plan, reachable from Rescue, Calm & grounding, More and the lock screen → release-2026-09-30-3. _Wording still needs review by a clinician or peer-support organisation._

## Notes kept from F-010 (for F-012)

Sources suggested for any wording about a drug: the **official prescribing information** (DailyMed, Drugs@FDA; or EMA SmPC / BNF) is the citable source for "listed adverse reaction"; the AES *Summary of Antiseizure Medications Available in the United States* (4th ed., April 2024) is a starting table compiled from those labels; reviews: Gabrielsson et al., "Poo Matters!", *Seizure* 2023 (PubMed 37146516); Li et al., FAERS bladder and urethral symptoms, *Expert Opin Drug Saf* 2025 (PubMed 38871672; a reporting signal, not proof); Brickel et al. on retigabine/ezogabine (PubMed 22428574); "Managing the patient with epilepsy and renal impairment", *Seizure* 2020. Constipation is described as a commonly reported effect for several ASMs; urinary symptoms are more drug-specific. **These were supplied by Jeremiah and have not been checked against the sources by Claude.** Allowed shape of any sentence: a label-backed statement plus an explicit non-causal frame, never "caused by", never "stop or reduce".
