# Working on Steady: bugs, git, releases

This is the day-to-day process. For server details, see [DEPLOY.md](DEPLOY.md).

## The loop

```
She reports something  →  add it to BUGS.md  →  fix (P1 alone, P2 in small batches)
      →  tests pass  →  commit  →  deploy a new release  →  tag + CHANGELOG  →  tick it off in BUGS.md
```

## 1. Record it

Add a line to [BUGS.md](../BUGS.md) with the next free ID, the date, and what happened. Pick P1, P2 or P3. When in doubt, anything touching reminders, doses, the seizure timer, SOS, or her data is **P1**.

## 2. Fix it

- Work on the `main` branch for small fixes. For anything bigger than an afternoon, use a branch:
  ```bash
  git switch -c fix/B-012-dose-notes
  ```
- Add or update a test for the fix: `src/**/*.test.ts` for logic, `e2e/critical.spec.ts` for flows.
- Before committing, all three must pass:
  ```bash
  npm test
  ```
  ```bash
  npm run lint
  ```
  ```bash
  npm run e2e
  ```

## 3. Commit

One commit per fix. Mention the bug ID in the message:

```bash
git add -A
```
```bash
git commit -m "Fix B-012: dose notes not saving from the Today screen"
```
```bash
git push
```

## 4. Release

1. Build and deploy using one of the two methods in [DEPLOY.md](DEPLOY.md):
   - **Manual:** WinSCP upload.
   - **Scripted:** `deploy/deploy.ps1`, which also tags the release for you.
2. If you deployed manually, tag the release yourself. The name must match the server folder:
   ```bash
   git tag release-2026-09-30
   ```
   ```bash
   git push --tags
   ```
3. Add an entry to [CHANGELOG.md](../CHANGELOG.md), then tick the items off in BUGS.md with ` → release-2026-09-30`.

To see the code for anything that was live, check out its tag, e.g. `git checkout release-2026-09-27`.

## Rules that protect her data

Her data lives in her phone's browser, not on the server. Deploying never touches it, **unless new code misreads old data**. So:

| Change | Safe? | What to do |
|---|---|---|
| Screens, wording, layout, new features | ✅ Yes | Nothing special |
| New **optional** field, or one with a default | ✅ Yes | Give it a default wherever it's read |
| Rename or remove a stored field | ⚠️ Risky | Needs a Dexie upgrade step that converts old records (`db.version(n+1)...upgrade()` in `src/data/db.ts`), **plus** a migration in `parseEnvelope` (`src/core/exportSchema.ts`) and a `SCHEMA_VERSION` bump |
| New or changed database index | ⚠️ Risky | New `db.version(n+1).stores({...})` in `src/data/db.ts`. **Never edit an existing version block.** |
| Delete a table | ❌ No | Don't. Leave it in place. |

**Before a risky release:** ask her to save a backup first (More → Backup & data).

## Handing off to a new Claude session

A new session automatically reads `CLAUDE.md`, which points to everything else. A good opening message:

> Read CLAUDE.md, BUGS.md, FEATURES.md and CHANGELOG.md. Then fix the open P1 items in BUGS.md one at a time, following docs/WORKFLOW.md.

Feature requests go in [FEATURES.md](../FEATURES.md), not BUGS.md. The same commit → release → tick-off rules apply.

Or name specific items:

> Fix B-005 from BUGS.md.
