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

## release-2026-09-30

Fixes the unclear message after restoring a backup. No data changes; schema stays `1.1.0`.

- **B-008:** restoring a backup now shows a clear confirmation on the page itself, and it stays until dismissed. It lists what is now on the device ("Backup restored: 0 seizure events, 2 medications, 9 dose records, …") after checking it against what was actually stored. A failed restore shows a visible error and says nothing was changed. On the welcome screen the page no longer reloads before it can be read; she taps "Open Steady". Backup & data also shows "Last restore: …".
- **B-006:** new automated upgrade test. Data and backup files written by the previous release must open, export and import intact, in merge and replace modes. It runs with `npm test` before every deploy.

## release-2026-09-27

First release: Phase 1 complete, as specified in `CLAUDE.md` and `app-blueprint.md`.

- Today checklist, medications and adherence, two-tap seizure log, seizure timer and SOS, safe mode, sleep, food and water, schedule editor, insights, neurologist report, backup and restore, passcode.
- Deployed on the existing Apache server with a Let's Encrypt certificate.
- Data schema: `1.1.0`.
