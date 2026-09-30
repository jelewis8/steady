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

The next free ID is **F-010**.

---

## Open

### Safety

_(none open)_

### High

- [ ] **F-003** · 2026-09-30 · requested by: Jeremiah · **Log things after the fact, clearly**
  - What already exists (it's hard to find):
    - Seizure log → "Log past one"; the quick log's "Other" time option.
    - "I took it earlier, at…" on today's doses.
    - Editing past nights in the Sleep diary.
  - Missing:
    - Opening **any past day** to tick off doses and routine items.
    - Logging sleep for **any night**, not just last night.
  - Make the path obvious. For example, "Log something from earlier" on Today, and a day picker (ties into F-004).

- [ ] **F-004** · 2026-09-30 · requested by: Jeremiah (suggested by a user) · **Calendar view, like a period-tracking app**
  - A month grid. Each day shows markers for seizures, auras, missed or unsure doses, short sleep, period days, and bowel days (F-006). Markers use icons plus text, never colour alone.
  - Tap a day to see its details and edit them (F-003).
  - Needs a table/list alternative for screen readers. No animation.

- [ ] **F-006** · 2026-09-30 · requested by: Jeremiah's friend (first user) · **Bowel and bladder tracking**
  - Her words: medications can cause lasting constipation. She has a planned "toilet day" every 6 days (passion fruit tea, papaya). Dystonia means she doesn't feel the need to urinate, so she schedules bathroom times. "It would be important to ask if we pooped for the day."
  - **Bowel:** a daily question, "Did you have a bowel movement today?", then "How was it?" (simple choices; consider plain-language labels rather than a clinical scale) and "What did you eat or drink beforehand?" (notes). Show "days since last bowel movement" discreetly.
  - **Bladder:** "Did you urinate today? How many times?" A one-tap counter, plus optional scheduled bathroom reminders (after waking, before bed, every N hours).
  - Include both in the report (frequency over the period), the calendar (F-004), and possibly insights (e.g. against medication changes).
  - Keep it private and matter-of-fact. It could sit in the evening check-in and/or as routine items.

### Normal

- [ ] **F-009** · 2026-09-30 · requested by: Jeremiah · **Low-mood note in the neurologist report** (split out of F-002)
  - A gentle note in the report when low mood has been logged often. All anti-seizure medications carry a label warning about suicidal thoughts, so mood matters to the prescriber (`knowledge-base.md` §1.6 notes the FDA warning and a 2–5× increased risk).
  - **Verify the wording against the knowledge base or a clinical source before shipping.** Explore after release 3. Decide what counts as "often" and what the note says, with no scoring or diagnosis.

- [ ] **F-005** · 2026-09-30 · requested by: Jeremiah · **Aura timer, or one timer for both auras and seizures**
  - Today the seizure timer only logs seizures, and warning signs are logged without a duration.
  - Proposal: a single "Something's happening — start timer" button. When it's stopped, she chooses **Warning sign (aura)** or **Seizure**, and it saves with the duration. The 5-minute emergency alert still applies. The aura branch should also offer "it turned into a seizure", which links the two records.

- [ ] **F-008** · 2026-09-30 · requested by: Jeremiah's friend · **Routines that repeat every N days, and timing rules**
  - Her "toilet day" repeats **every 6 days**. Today, routines can only be tied to weekdays. Add "repeats every N days, starting from…" to routines.
  - On toilet day she must finish her tea at least **an hour before** her medication, so her morning doses move an hour later. Allow a routine to **shift medication reminder times** on those days, or add a "keep X and Y an hour apart" reminder.
  - **Never suggest changing medication timing.** Only schedule what she and her doctor decided.
  - Open question: should shifted doses count as on time for adherence? (Suggestion: yes, if the shift is part of her planned routine.)

---

## Done

- [x] **F-001** · 2026-09-30 · Dated side-effect log (medication or "not sure which", start and stop dates, severity, notes), in the neurologist report; the old undated list was migrated to "date unknown" → release-2026-09-30-4
- [x] **F-007** · 2026-09-30 · Medications that didn't work out: "I no longer take this" asks the date and (optionally) why; the report has "Past medications and why they were stopped"; allergic reactions also appear on the action plan under Allergies → release-2026-09-30-4

- [x] **F-002** · 2026-09-30 · Support for thoughts of suicide or self-harm: Support page (crisis lines by country, call/text a trusted person, emergency call), personal safety plan, reachable from Rescue, Calm & grounding, More and the lock screen → release-2026-09-30-3. _Wording still needs review by a clinician or peer-support organisation._
