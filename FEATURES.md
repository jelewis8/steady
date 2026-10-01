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

The next free ID is **F-011**.

---

## Open

### Safety

_(none open)_

### High

_(none open)_

### Normal

- [ ] **F-010** · 2026-09-30 · requested by: Jeremiah's friend · **Insights: bowel and bladder over time, against medication changes** (split out of F-006)
  - F-006 lists this as "possibly". With bowel data in place, compare stretches without a bowel movement around dates a medication was started, stopped or changed. "Associated with" wording only, through the exact binomial test in `core/insights.ts`, with enough data first. The knowledge base doesn't cover this topic, so it would need a clinical source for any wording.

---

## Done

- [x] **F-009** · 2026-10-01 · Mood, depression and anxiety: the daily check-in gains "how low or depressed" and "how anxious" (1 to 5) and a private "why" diary note; Day page shows them; the neurologist report gets "Mood and anxiety" (counts and averages only, notes only if she chooses); a support link is always in the check-in, never triggered by a score → release-2026-10-01-2

- [x] **F-005** · 2026-10-01 · One timer for a warning sign or a seizure: "Something's happening — start timer"; when stopped she chooses a seizure or a warning sign (saved with how long it lasted); "It's turning into a seizure" records the warning's length, keeps timing, and saves one seizure with a linked warning sign at the same start → release-2026-10-01

- [x] **F-006** · 2026-09-30 · Bowel and bladder tracking (off until turned on): Today card with a quiet "days since last bowel movement" and a one-tap counter, the daily bowel question as a routine item, plain-language texture choices, optional notes on what she ate or drank, her own bathroom-break reminder times, calendar marker, report section → release-2026-09-30-6
- [x] **F-008** · 2026-09-30 · Routines that repeat every N days from a start date, and planned medication shifts (morning or all doses, 15 min to 2 h later); shifted doses count as on time; Steady never suggests a shift → release-2026-09-30-6
- [x] **F-003** · 2026-09-30 · Log things after the fact, clearly: "Log from an earlier day" on Today opens any past day (doses, routine, seizures, sleep, check-in), recorded at that day's times; sleep for any night → release-2026-09-30-5
- [x] **F-004** · 2026-09-30 · Calendar: Monday-start month grid with icon-plus-words markers (seizures, warning signs, missed/unsure/unrecorded doses, short sleep, period) and a table list view; bowel days come with F-006 → release-2026-09-30-5
- [x] **F-001** · 2026-09-30 · Dated side-effect log (medication or "not sure which", start and stop dates, severity, notes), in the neurologist report; the old undated list was migrated to "date unknown" → release-2026-09-30-4
- [x] **F-007** · 2026-09-30 · Medications that didn't work out: "I no longer take this" asks the date and (optionally) why; the report has "Past medications and why they were stopped"; allergic reactions also appear on the action plan under Allergies → release-2026-09-30-4
- [x] **F-002** · 2026-09-30 · Support for thoughts of suicide or self-harm: Support page (crisis lines by country, call/text a trusted person, emergency call), personal safety plan, reachable from Rescue, Calm & grounding, More and the lock screen → release-2026-09-30-3. _Wording still needs review by a clinician or peer-support organisation._
