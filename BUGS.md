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

The next free ID is **B-007**.

---

## Open

### P1 — Critical

- [ ] **B-001** · 2026-09-28 · launch · Confirm Steady is **installed to her home screen** (iPhone Safari deletes site data after ~7 days unless the site is installed). Test by opening from the home-screen icon.
- [ ] **B-002** · 2026-09-28 · launch · Make her **first backup** (More → Backup & data → Save backup file) and store the file somewhere safe that isn't the phone.

### P2 — Annoying

- [ ] **B-003** · 2026-09-28 · server · Port **5173** is open to the internet in the droplet firewall (a Vite dev-server port). Close it if nothing needs it: `ufw delete allow 5173`.
- [ ] **B-004** · 2026-09-28 · testing · Manual screen-reader pass not done yet (VoiceOver on iPhone, TalkBack on Android, NVDA on Windows). Automated axe checks pass.

### P3 — Wish list

- [ ] **B-005** · 2026-09-28 · meds · Dated side-effect log: record when each side effect started or stopped, and include per-dose side-effect notes in the neurologist report. (Today: an undated list per medication, plus a free-text note per dose that isn't in the report.)
- [ ] **B-006** · 2026-09-28 · data safety · Add an automated "upgrade" test: data saved by the previous release must open intact in the new release. Run it before every deploy.

---

## Done

- [x] **B-000** · 2026-09-27 · Phase 1 built and deployed to https://steady.example.com → release-2026-09-27
