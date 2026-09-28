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

## release-2026-09-27

First release: Phase 1 complete, as specified in `CLAUDE.md` and `app-blueprint.md`.

- Today checklist, medications and adherence, two-tap seizure log, seizure timer and SOS, safe mode, sleep, food and water, schedule editor, insights, neurologist report, backup and restore, passcode.
- Deployed on the existing Apache server with a Let's Encrypt certificate.
- Data schema: `1.1.0`.
