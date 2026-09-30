# Bugs & Tasks

The single running list of bugs, requests, and to-dos for Steady. Add anything here, then tick it off when it's done and shipped.

## How to use this list

**Add an item.** Copy this line into the right priority section and give it the next free ID:

```
- [ ] **B-000** · 2026-09-28 · reported by: Dylan · What happened, and where (screen / button). Steps if known.
```

**Priorities**

| Level | Meaning | How it's handled |
|---|---|---|
| **P1 — Critical** | Affects safety or her data: reminders, dose records, the seizure timer, SOS, export/backup, data loss | Fix immediately, **on its own**, and deploy the same day |
| **P2 — Annoying** | Wrong or confusing, but safe | Fix in a small batch of 3–5 related items |
| **P3 — Wish list** | New ideas and improvements | Pick up when there's time |

**When it's fixed:**
1. Change `[ ]` to `[x]` and move the line to **Done**.
2. Add the release it shipped in, e.g. ` → release-2026-09-30`.
3. Mention the ID in the commit message, e.g. `Fix B-004: dose note not saving`.

The next free ID is **B-012**.

New features and larger requests go in [FEATURES.md](FEATURES.md) (IDs `F-###`). This file is for things that are broken or wrong.

---

## Open

### P1 — Critical

- [ ] **B-001** · 2026-09-28 · launch · Confirm Steady is **installed to her home screen** (iPhone Safari deletes site data after ~7 days unless the site is installed). Test by opening from the home-screen icon.
- [ ] **B-002** · 2026-09-28 · launch · Make her **first backup** (More → Backup & data → Save backup file) and store the file somewhere safe that isn't the phone.

### P2 — Annoying

- [ ] **B-003** · 2026-09-28 · server · Port **5173** is open to the internet in the droplet firewall (a Vite dev-server port). Close it if nothing needs it: `ufw delete allow 5173`.
- [ ] **B-004** · 2026-09-28 · testing · Manual screen-reader pass not done yet (VoiceOver on iPhone, TalkBack on Android, NVDA on Windows). Automated axe checks pass.

### P3 — Wish list


---

## Done

- [x] **B-010** · 2026-09-30 · Side effects now have a start and stop date (and severity), and the old undated ones are kept as "date unknown" → release-2026-09-30-4 (F-001)
- [x] **B-005** · 2026-09-28 · Dated side-effect log → release-2026-09-30-4 (F-001)
- [x] **B-007** · 2026-09-30 · "Used per dose" can now be cleared and set to 2 (or 0.5, 1.5…); it is checked on save, added to the onboarding medication form, and the refill countdown uses it → release-2026-09-30-2
- [x] **B-009** · 2026-09-30 · Seizure type now reads "Focal to bilateral tonic-clonic (formerly grand mal)" in the quick log, full form, list, insights and report → release-2026-09-30-2
- [x] **B-011** · 2026-09-30 · Neurologist report (and its text summary) has a "Notes recorded with doses" section: date, medication, note / side effect → release-2026-09-30-2
- [x] **B-008** · 2026-09-30 · Restoring a backup now shows a clear confirmation that stays on the page ("Backup restored: 0 seizure events, 2 medications, 9 dose records, …"), checked against what is actually stored, plus a visible error if it fails. The welcome screen no longer reloads before she can read it. Tested with a real backup in merge and replace modes → release-2026-09-30
- [x] **B-006** · 2026-09-28 · Automated upgrade test (`src/data/upgrade.test.ts`): data and backups from the previous release must open intact; runs with `npm test` before every deploy → release-2026-09-30 (test only)
- [x] **B-000** · 2026-09-27 · Phase 1 built and deployed to https://steady.example.com → release-2026-09-27
