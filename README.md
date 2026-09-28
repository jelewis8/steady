# Steady

A calm, local-first daily companion for people living with focal epilepsy: an hour-by-hour routine, medication reminders with a clear “did I take it?” record, two-tap seizure logging, a seizure timer and rescue plan, and plain-language insights for the neurologist.

**Your data never leaves the device.** No backend, no accounts, no analytics. The site's Content-Security-Policy blocks connections to any other origin, and an end-to-end test checks that on every page.

Live target: **https://steady.example.com**

---

## Quick start (Windows)

```powershell
npm install
npm run dev          # http://localhost:5173
```

On the welcome screen, pick **“Just look around with sample data”** to load 90 days of realistic sample data, including a sleep–seizure pattern for Insights to find. Tap **“Start fresh with my own data”** on Today to clear it.

| Command | What it does |
|---|---|
| `npm run dev` | Dev server with hot reload |
| `npm run build` | Type-check + production build to `dist/` (with service worker) |
| `npm run preview` | Serve the production build with the production security headers |
| `npm test` | Unit tests: checklist generation, insights and statistics, export/import, storage (Vitest) |
| `npm run e2e` | End-to-end tests against the production build, using installed Microsoft Edge (Playwright + axe) |
| `npm run lint` | ESLint, including `jsx-a11y` strict and a seizure-safety rule |

## What's in it

| Area | Highlights |
|---|---|
| **Today** | Checklist merged from the routine and medication doses. “Still open from earlier” (never “missed”). Progress plus consistency messages that don't punish gaps. “Did I take it?” card, water tracker, sleep card, evening check-in, a 7-day summary and the top insight. |
| **Log seizure** | A button on every screen. **Two taps** (button → Save), with type and strength learned from your last entry. The full form autosaves as a draft and has chips for aura, trigger (most-used first) and post-ictal symptoms, plus voice notes and observer notes. |
| **Rescue / SOS** | Full-screen **seizure timer** that survives reloads and escalates at your plan's threshold (default 5 min). One-tap call to emergency services. Call/text contacts with a prefilled message and optional location. Grounding and slow-breathing tools. A shareable/printable **seizure action plan**. |
| **Safe mode** | After a seizure: +25% text, +50% touch targets, essentials only, non-medication reminders paused, and a big “I'm OK” button. Turns itself off after the set time. |
| **Medications** | Schedules, dose history, taken / taken late / skipped / not sure, 7/30/90-day adherence, refill countdown, side-effect notes, rescue medications. |
| **Schedule** | Hour-by-hour routine editor with multiple routines (weekdays, a “Rest day”…), a per-day switch, and “rebuild from my times”. |
| **Insights** | Seizures over time, seizure rate by sleep length, adherence heatmap, triggers, time of day. Plain-language associations checked with an exact binomial test, so chance patterns stay hidden. Every chart has a table view. |
| **Clinician report** | Printable/PDF summary or plain text for the neurologist, with the self-report caveat built in. |
| **Data** | JSON export (optionally AES-256-GCM encrypted), CSV exports, import with merge or replace, checksum verification, erase. |
| **Privacy & security** | Optional passcode (PBKDF2) with a recovery code and auto-lock. The lock screen can show emergency info for a caregiver. |
| **PWA** | Installable and fully offline. Updates wait for the user (“Update now”) and never reload mid-task. |

## Seizure-safe and accessible by construction

- No flashing, strobing, pulsing or auto-playing motion. Transitions are ≥300 ms and slow; `prefers-reduced-motion` and an in-app switch turn off all motion. An E2E test fails the build if any element animates faster than 300 ms.
- WCAG 2.2 AA: axe reports zero violations across every screen in the light, dark and high-contrast themes, including with sheets open. Targets are at least 48 px (72 px in safe mode). Status never relies on colour alone (✓ / — / ? plus text). Keyboard access and focus return are handled throughout.
- The font is Atkinson Hyperlegible, designed for low-vision readers and self-hosted. Text size goes up to 150%.
- Wording is never punitive: “Let's pick back up today”, “Still open — no rush”.

## Architecture

```
src/
  core/        Pure TypeScript business logic (no DOM, no React): types, checklist
               generation, stats, insight engine, export schema. Reusable in React Native.
  platform/    Interfaces from the blueprint (StorageAdapter, NotificationScheduler,
               AudioRecorder, EncryptionProvider, ShareProvider, AuthGate) + web implementations.
  data/        Dexie (IndexedDB) database, StorageAdapter implementation, domain actions
               (every mutation returns an undo), live-query hooks, sample data.
  features/    Screens: today, seizures, meds, sleep, diet, routine, rescue, safemode,
               insights, reminders, lock, onboarding, settings.
  ui/          Accessible component kit, charts (static, with table views), shell.
  sw.ts        Service worker: precache app shell, offline navigation, notification taps.
e2e/           Playwright: critical workflows, axe, animation-speed guard, offline, privacy.
deploy/        steady.conf (Apache vhost used in production), deploy.ps1, plus Caddy/nginx
               alternatives for a fresh server.
```

See [docs/DATA-MODEL.md](docs/DATA-MODEL.md) for the entities, including the documented extensions to the blueprint schema.

## Project management

| File | What it's for |
|---|---|
| [BUGS.md](BUGS.md) | Running list of bugs and tasks. Add items and tick them off. |
| [CHANGELOG.md](CHANGELOG.md) | What shipped in each release |
| [docs/WORKFLOW.md](docs/WORKFLOW.md) | Report → fix → commit → release loop, and the rules that protect user data |
| [docs/DEPLOY.md](docs/DEPLOY.md) | The production server and how to release |
| [CLAUDE.md](CLAUDE.md) | Project brief and rules. New Claude sessions read this first. |

## Deploy

Steady runs on the existing Apache server on the `id_ed25519` droplet, with files in `/var/www/steady/`. Each release is uploaded to its own dated folder, and the `current` symlink is switched to it. Rollback means pointing `current` back at the previous folder.

- **Manual:** upload the contents of `dist\` with WinSCP.
- **Scripted:** `./deploy/deploy.ps1 -Server 203.0.113.10 -KeyFile <key>`.

Full steps are in [docs/DEPLOY.md](docs/DEPLOY.md).

## Medical disclaimer

Steady is a personal tracking and reminder tool. It is not a medical device, and it does not diagnose, prescribe, or recommend treatment. In an emergency, call your local emergency number.
