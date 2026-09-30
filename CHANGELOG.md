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
