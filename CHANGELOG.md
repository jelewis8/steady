# Changelog

One entry per deploy. Each release has three matching names:

- **server folder:** `/var/www/steady/releases/<name>`
- **git tag:** `release-<name>`
- **heading below**

Use `YYYY-MM-DD` as the name. For a second release on the same day, add `-2`.

To see exactly what is live on the server:

```bash
ls -l /var/www/steady/current
```

The folder that `current` points at is the release name.

---

## release-2026-10-01

**F-005: one timer for a warning sign (aura) or a seizure.** No data changes: schema stays `1.4.0`, database stays at version 3.

- **One button, "Something's happening — start timer"** (Rescue; on the lock screen it's "Start timer"). Nobody has to decide what it is while it's happening. The timer, the 5-minute emergency alert, the call button, the rescue plan and "how to help" are all as before.
- **When it stops** ("It has stopped"), she (or whoever is with her) chooses:
  - **A seizure**: saved to the seizure log as before.
  - **A warning sign (aura) only**: pick what she noticed (optional) and save. It's saved as a warning sign **with how long it lasted** (the Warning signs list now shows "lasted 52 s"). It is not put in the seizure log.
  - "It started again, keep timing" and "Close without saving" are still there, and "It wasn't a seizure" goes back a step.
- **A warning sign that turns into a seizure:** while it's running, **"It's turning into a seizure"** records how long the warning lasted (measured at that tap) and carries on timing. The result is **one seizure plus a linked warning sign that starts at the same moment** (as agreed). It isn't also counted as a warning sign on its own. The same happens if she stops, picks "warning sign", and then taps "It turned into a seizure after all". The timer keeps running.
- **On the lock screen** the timer works for anyone who needs it, but it never asks what it was or saves anything (as before).
- The timer and what it recorded survive a reload.
- **Fix found along the way:** editing a seizure that began with a timed warning sign (and ticking no warning-sign options) would have quietly removed the warning sign and its duration. It now keeps both.
- **Fix found along the way:** switching a routine to "Every few days" (or editing any routine field) now applies to the latest saved copy of the routine, so two quick edits, such as a rename and a repeat change, can no longer overwrite each other.

## release-2026-09-30-6

**F-006 and F-008: bowel and bladder tracking, and routines that repeat every few days.** Data schema is now `1.4.0` and the database moves to **version 3** (one new table; nothing existing is changed). **Ask her to save a backup first.**

**Bowel and bladder (F-006)** is **off until she turns it on** (More → Bowel & bladder). Private, plain words, never scored.
- **Today card:** "Bowel movement today: Yes, normal / No / Not recorded yet", a quiet "Last bowel movement: 3 days ago", and a one-tap counter "Urinated today: N times" with "Add one" and "Take one off".
- **The daily question as a routine item:** one button adds "Bowel movement today?" to her routines each evening (8:00 PM, changeable in Schedule). Answering it (yes or no) ticks it off. "How was it?" is plain: hard or difficult, normal, loose, not sure. "What did you eat or drink beforehand?" is an optional note.
- **Bathroom break reminders:** times she chooses (add any time, or quick fill: after I wake up, before bed, every 3 hours). They appear in her routine with a reminder, for when she doesn't feel the need to go.
- **Past days:** any day can be filled in from the Day page or "Recent days" on the same screen.
- **Report** ("Bowel and bladder", also in the text summary): days with a bowel movement, days recorded as none, the longest stretch without one, how they were, and the average number of urinations on the days counted. **Calendar:** a "Bowel movement" symbol with words.
- The knowledge base doesn't cover bowel or bladder, so Steady makes no claims about them. It records, and the screen says to tell her doctor or pharmacist about ongoing constipation or worries.

**Routines that repeat, and planned medication shifts (F-008)**
- In Schedule, a routine can be used **"Every few days"** (every N days, counting from a start date) instead of on weekdays. It shows the next three dates. On its days it is used instead of her weekday routine. Use "New routine" to make a copy of her usual day first, then add the toilet-day items.
- A routine can **move medication times later** on the days it's used: morning doses only, or all doses, by 15 minutes to 2 hours. Reminders, the checklist and her record all use the moved times, so **a dose taken at the moved time counts as on time.** Today says, for example, "Medication times are 1 hour later today, as set in 'Toilet day'."
- She sets this herself. The screen says to only use it if her doctor has agreed, and Steady never suggests changing a medication time.
- Routines saved before this release behave exactly as they did (no repeat, no shift).

**Safety of the upgrade:** upgrade tests now cover a database from every earlier release (Dexie version 1 and version 2), in unit tests and in a real browser. Older backups open with routines and preferences filled in with defaults.

## release-2026-09-30-5

**F-003 and F-004: log past days clearly, and a calendar.** No data changes: schema stays `1.3.0`, database stays at version 2.

- **Log from an earlier day** (button on Today, and in the Calendar): pick yesterday, the day before, or any past date. The day shows its routine and medications, and she can tick off doses and routine items, skip them, or leave them. Nothing is marked as a failure ("Not recorded yet").
  - Things are recorded **at the time they were scheduled for that day**, not "now". A past breakfast or glass of water belongs to that day, and a past dose counts as taken on time. "I took it at…" is there for a different time.
  - The day also has: seizures that day (and "Log a seizure on this day", which starts at noon on that day), sleep for the night before, and a check-in for that day.
  - A day she has never opened starts empty, with an explicit "Add this day's routine and medications" button. Just looking at a day never changes her records or her adherence numbers.
  - Medications she has **since stopped** are included on the days before she stopped them.
  - A medication added to Steady recently is only scheduled from its "Started on" date. The day says so and links to the medication. If she was already taking it, she sets an earlier "Started on" and the day catches up.
- **Sleep for any night:** Sleep → "Log a different night".
- **Calendar** (Today, and More → Calendar): a month grid, weeks starting Monday. Each day shows symbols **with words**: seizure, warning sign, dose skipped or not sure, dose not recorded, short sleep the night before, period. Every day is a link with a full spoken description ("Tuesday, September 15: 1 seizure, 2 doses not recorded"). A **List** view shows the same as a table, in words. Tap a day to open it. No animation, and tap targets are 48 px or more.
- Adherence numbers: doses on past days she chooses to fill in are added as "not recorded" until she ticks them, the same as on a day she opened the app but didn't tick.
- Not included yet: bowel days on the calendar (F-006).

## release-2026-09-30-4

**F-001 and F-007: a dated side-effect log, and medications that didn't work out.** Data schema is now `1.3.0`, and the database moves to **version 2** (one new table; nothing existing is changed). **Ask her to save a backup first.**

- **Side effects have dates.** Each entry has what she noticed, which medication (or "I'm not sure which one"), when it started and stopped (both optional, "date unknown" is fine), how strong it was (mild, moderate, severe, or not sure), and notes. Find them under Medications → Side effects log, and on each medication's page. Entries can be edited, removed, and undone.
- **Her existing side effects are kept.** On first opening after the update, each medication's old undated side effects become entries marked "Start date unknown". The old list is left untouched in the database, so nothing is lost even if this release is rolled back. Restoring an older backup does the same, without duplicates.
- **"I no longer take this"** now asks when she stopped and, if she wants to say, why: didn't control seizures, side effects, allergic reaction, cost or access, another reason, or "I'd rather not say". Nothing is required. She can also add a reason later to a medication she stopped before (open it from Past medications). Past medications show when and why.
- **Neurologist report:** new sections "Side effects noted" (all dates, with when each started and stopped) and "Past medications and why they were stopped" (with the side effects logged against each). Both are in the text summary too.
- **Action plan:** medications stopped after an allergic reaction are listed under Allergies.
- New upgrade tests: a database written by the previous release is upgraded in a real browser and in unit tests (with her real backup), and old backups migrate without duplicates.
- Not done here: per-dose notes are still shown in their own report section (B-011) and aren't merged into the side-effect log.

## release-2026-09-30-3

**F-002: support for thoughts of suicide or self-harm.** Data schema is now `1.2.0`. There is no database change, only new optional fields, and old data and old backups open unchanged (upgrade test passes).

- **Support page** ("I'm having thoughts of hurting myself" on the Rescue screen, also in Calm & grounding and More). It is calm and non-judgmental: call emergency services; crisis lines for her country, each with Call and Text buttons; call or text a trusted person with a message that is already written; her safety plan; a link to grounding.
- **Crisis lines for 14 countries** (Australia, Canada, France, Germany, India, Ireland, Italy, Netherlands, New Zealand, Philippines, South Africa, Spain, UK, US). Every number was checked against an official source; see `docs/CRISIS-LINES.md`. Anyone else can choose "Somewhere else" and add their own number, and there is a link to an international directory.
- **Country** is asked during setup (it fills the emergency number), and can be changed in Settings or on the Support page. A number she set herself is never overwritten.
- **Safety plan** (More → Support & safety plan): warning signs, things that help, people and places, people to ask, professionals, making the space safer, what matters most, and the text to send. Free text in her own words. Stays on the device and is included in backups.
- **Trusted people:** one main person plus as many others as she wants, chosen from her contacts. "Text everyone" when there is more than one.
- **Lock screen:** "I need support right now" shows the crisis lines, emergency call and trusted people without unlocking. The safety plan stays private unless she turns on "Show this plan on the lock screen" (off by default).
- Nothing is recorded, scored or sent. Every call or text is started by her tap and opens the phone's own app.
- Restoring a backup in "Add to what's here" mode now also brings in a safety plan, country and own numbers when the device has none (it never overwrites what is on the device).
- **Not included yet:** a note about low mood in the neurologist report (now F-009).

## release-2026-09-30-2

Three small fixes. No data changes; schema stays `1.1.0`.

- **B-007:** "Used per dose" (pills per dose) can now be cleared and retyped, so she can set 2. Half and decimal amounts work too. It is checked when saving, it is also in the setup screen's medication form, and the refill countdown uses it. **After changing it on an existing medication, re-check "Pills/doses left".** Past doses were counted as 1 pill each.
- **B-009:** the seizure type is now labelled "Focal to bilateral tonic-clonic (formerly grand mal)" everywhere it appears.
- **B-011:** the neurologist report and its text summary now include "Notes recorded with doses" (date, medication, note or side effect).

## release-2026-09-30

Fixes the unclear message after restoring a backup. No data changes; schema stays `1.1.0`.

- **B-008:** restoring a backup now shows a clear confirmation on the page itself, and it stays until dismissed. It lists what is now on the device ("Backup restored: 0 seizure events, 2 medications, 9 dose records, …") after checking it against what was actually stored. A failed restore shows a visible error and says nothing was changed. On the welcome screen the page no longer reloads before it can be read; she taps "Open Steady". Backup & data also shows "Last restore: …".
- **B-006:** new automated upgrade test. Data and backup files written by the previous release must open, export and import intact, in merge and replace modes. It runs with `npm test` before every deploy.

## release-2026-09-27

First release: Phase 1 complete, as specified in `CLAUDE.md` and `app-blueprint.md`.

- Today checklist, medications and adherence, two-tap seizure log, seizure timer and SOS, safe mode, sleep, food and water, schedule editor, insights, neurologist report, backup and restore, passcode.
- Deployed on the existing Apache server with a Let's Encrypt certificate.
- Data schema: `1.1.0`.
