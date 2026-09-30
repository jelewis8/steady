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
