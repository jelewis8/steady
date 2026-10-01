# Bugs & Tasks

The single running list of bugs, requests, and to-dos for Steady. Add anything here, then tick it off when it's done and shipped.

## How to use this list

**Add an item.** Copy this line into the right priority section and give it the next free ID:

```
- [ ] **B-000** · 2026-09-28 · reported by: a user · What happened, and where (screen / button). Steps if known.
```

**Priorities**

| Level | Meaning | How it's handled |
|---|---|---|
| **P1 — Critical** | Affects safety or the user's data: reminders, dose records, the seizure timer, SOS, export/backup, data loss | Fix immediately, **on its own**, and deploy the same day |
| **P2 — Annoying** | Wrong or confusing, but safe | Fix in a small batch of 3–5 related items |
| **P3 — Wish list** | New ideas and improvements | Pick up when there's time |

**When it's fixed:**
1. Change `[ ]` to `[x]` and move the line to **Done**.
2. Add the release it shipped in, e.g. ` → release-2026-09-30`.
3. Mention the ID in the commit message, e.g. `Fix B-004: dose note not saving`.

The next free ID is **B-015**.

New features and larger requests go in [FEATURES.md](FEATURES.md) (IDs `F-###`). This file is for things that are broken or wrong.

---

## Open

### P1 — Critical


### P2 — Annoying

- [ ] **B-004** · 2026-09-28 · testing · Manual screen-reader pass with a real reader (VoiceOver on iPhone, TalkBack on Android, NVDA on Windows) is still to do: follow `docs/SCREEN-READER-CHECK.md`. Done without a reader on 2026-10-01 (shipped in release-2026-10-01-5): every page now has its own title, focus always lands on the page heading (it was lost on a page opened for the first time), and one skipped heading level was fixed. axe passes.


- [ ] **B-014** · 2026-10-01 · self-audit · The Support page says "Free, private support from trained people" for every country, but not every listed line is free (for example Italy, the Philippine mobile numbers and two hospital lines have no "free" statement in their source). Proposed fix and wording: `docs/SUPPORT-WORDING-AUDIT.md` finding S-1. Waiting for approval; the other audit findings wait for the reviewer.

### P3 — Wish list


---

## Done

- [x] **B-003** · 2026-10-01 · Port 5173 (a development-server port, not used in production) was open to the internet on the droplet firewall. Closed by Jeremiah on 2026-10-01 with `ufw delete allow 5173`
- [x] **B-002** · 2026-10-01 · The user's first backup (More → Backup & data → Save backup file) was tested by Jeremiah and works
- [x] **B-001** · 2026-10-01 · Install to the home screen was tested by Jeremiah and works
- [x] **B-013** · 2026-10-01 · reported by: Jeremiah · Cycle tracking wasn't visible anywhere except as a Settings toggle. Now, with it on, Today has a "Period today?" Yes/No card that works at any hour (it used to appear only inside the evening check-in, after 17:00), every past day page has the same card, the Today check-in summary mentions a period day, and the calendar marks it. Same stored field as before, so no database change and nothing to migrate → release-2026-10-01-4
- [x] **B-012** · 2026-10-01 · reported by: Jeremiah · Restoring a backup changed the user's breakfast from 9:30 back to the default 7:30. A new device's own default routines were kept next to the restored ones and both claimed every weekday, so which one won was random. The restored routines are now the ones used (nothing deleted on a set-up device; the new device's placeholders are removed). Re-restoring the same backup repairs a device already affected → release-2026-10-01-2
- [x] **B-010** · 2026-09-30 · Side effects now have a start and stop date (and severity), and the old undated ones are kept as "date unknown" → release-2026-09-30-4 (F-001)
- [x] **B-005** · 2026-09-28 · Dated side-effect log → release-2026-09-30-4 (F-001)
- [x] **B-007** · 2026-09-30 · "Used per dose" can now be cleared and set to 2 (or 0.5, 1.5…); it is checked on save, added to the onboarding medication form, and the refill countdown uses it → release-2026-09-30-2
- [x] **B-009** · 2026-09-30 · Seizure type now reads "Focal to bilateral tonic-clonic (formerly grand mal)" in the quick log, full form, list, insights and report → release-2026-09-30-2
- [x] **B-011** · 2026-09-30 · Neurologist report (and its text summary) has a "Notes recorded with doses" section: date, medication, note / side effect → release-2026-09-30-2
- [x] **B-008** · 2026-09-30 · Restoring a backup now shows a clear confirmation that stays on the page ("Backup restored: 0 seizure events, 2 medications, 9 dose records, …"), checked against what is actually stored, plus a visible error if it fails. The welcome screen no longer reloads before the user can read it. Tested with a real backup in merge and replace modes → release-2026-09-30
- [x] **B-006** · 2026-09-28 · Automated upgrade test (`src/data/upgrade.test.ts`): data and backups from the previous release must open intact; runs with `npm test` before every deploy → release-2026-09-30 (test only)
- [x] **B-000** · 2026-09-27 · Phase 1 built and deployed to https://steady.example.com → release-2026-09-27
