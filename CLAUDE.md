# Epilepsy Management App — Project Guide

## What This Project Is

A local-first web application (PWA) that helps people with focal (partial) epilepsy manage daily routines, track seizures, adhere to medications, and reduce seizure triggers. Phase 1 is browser-based with no backend. Phase 2 targets iOS/Android via React Native or Flutter.

The first user is an adult with partial epilepsy who struggles to maintain daily routines. Design for her worst day, not her best.

## Current Status (keep this section up to date)

- **Phase 1 is built and live** at https://steady.example.com, and **in use by the first user** since 2026-09-28. Real health data now exists on her phone, so every change must follow the data-safety rules in `docs/WORKFLOW.md`.
- **Work queue:** `BUGS.md` (things that are broken: P1 critical / P2 annoying / P3 wish list) and `FEATURES.md` (new features: Safety / High / Normal). Start any new session by reading both.
- **What's live:** `CHANGELOG.md`. Each release is also a server folder and a git tag `release-YYYY-MM-DD`.
- **Code:** git repo, `main` branch, pushed to the private GitHub repo https://github.com/jelewis8/steady. One commit per fix, with the bug ID in the message (`Fix B-012: …`).

## Reference Documents

- `knowledge-base.md` — Clinical reference: focal epilepsy pathophysiology, triggers, treatments, devices, diagnostics. Source-aware (ILAE, AAN, NICE). Not medical advice.
- `app-blueprint.md` — Application blueprint: design principles, modules, data model (JSON schemas), workflows, UI sketches, privacy architecture, tech stack, build order.
- `BUGS.md` — Bugs and tasks list. Add items and tick them off; the next free ID is noted at the top.
- `FEATURES.md` — Feature requests with design notes and open questions (IDs `F-###`).
- `CHANGELOG.md` — One entry per deploy.
- `docs/WORKFLOW.md` — Bug → fix → commit → release loop, data-safety rules for schema changes, and session handoff.
- `docs/DEPLOY.md` — Production server details (Apache on the shared droplet) and release steps.
- `docs/DATA-MODEL.md` — Entities and extensions to the blueprint schema.

## Hard Constraints (Never Violate)

1. **No backend in Phase 1.** All data stays in IndexedDB on the user's device. No network requests for data storage. No analytics, no telemetry, no error reporting to any server.
2. **No flashing or strobing content.** No animations faster than 300ms. Respect `prefers-reduced-motion`. This is a seizure safety issue, not a preference.
3. **WCAG 2.2 AA minimum.** All interactive elements must have accessible labels. No information by color alone. Keyboard-navigable. Screen-reader tested.
4. **No punitive UI.** Missed items say "Let's pick back up" — never "streak broken," "you failed," or red error states for routine items. The user may be post-ictal.
5. **Medical disclaimer everywhere treatment is discussed.** This app tracks and reminds — it does not diagnose, prescribe, or recommend treatment.
6. **Export must always work.** The user can export all their data as JSON at any time. Never ship a version where export is broken.

## Architecture Decisions

- **Framework**: React 19 + TypeScript + Vite, React Router, Zustand (UI state only)
- **Storage**: Dexie.js (IndexedDB) behind a `StorageAdapter` interface. Only `src/data/` touches Dexie.
- **Styling**: Tailwind CSS v4 with CSS custom properties for theming (light/dark/high-contrast), Atkinson Hyperlegible (self-hosted)
- **Notifications**: Web Notification API + Service Worker, behind a `NotificationScheduler` interface. **Limitation:** the web has no reliable way to schedule local notifications while the app is fully closed, and a push relay would need a server. Reminders fire while the app is open or backgrounded, and are echoed in-app. Phase 2 native fixes this.
- **Charting**: Static, dependency-free HTML/SVG charts (`src/ui/charts.tsx`) with a table-view toggle. Recharts was rejected because it animates by default and adds weight.
- **Encryption**: Web Crypto. AES-256-GCM with PBKDF2 (310k) for **exports**; PBKDF2 hash for the passcode. **Field-level encryption at rest is deliberately deferred.** A 4–8 digit PIN-derived key can be brute-forced offline in seconds, so it would add data-loss risk (a forgotten PIN after a seizure means unreadable records) without real protection. The protection model is device lock + OS disk encryption + app passcode gate + encrypted backups. Revisit only with a strong passphrase or platform keystore (Phase 2).
- **PWA**: Workbox via vite-plugin-pwa (`injectManifest`, `src/sw.ts`). Updates are user-initiated (“Update now”).
- **Testing**: Vitest (unit), Playwright (e2e, uses installed Edge on Windows), axe-core (accessibility)
- **Hosting**: Static files served by the **existing Apache** on the shared DigitalOcean droplet `id_ed25519` (203.0.113.10) at `https://steady.example.com`. Files are in `/var/www/steady/releases/<name>`, with `current` as a symlink. The config is `deploy/steady.conf`, using an IP-based vhost to match the other sites. HTTPS is via certbot. See `docs/DEPLOY.md`. The CSP `connect-src 'self'` technically enforces “no data leaves the device”.

All platform-specific APIs are behind interfaces (`StorageAdapter`, `NotificationScheduler`, `AudioRecorder`, `EncryptionProvider`, `ShareProvider`, `AuthGate`) so Phase 2 swaps the implementation without touching business logic.

## Data Model

Entities are defined as JSON schemas in `app-blueprint.md` §2.3:
`UserProfile`, `SeizureEvent`, `AuraLog`, `Medication`, `MedicationDose`, `MealLog`, `SleepEntry`, `RoutineTemplate`, `RoutineChecklistItem`, `TriggerTag`, `RescueProtocol`, `EmergencyContact`, `InsightRule`.

Extensions (schema 1.1.0): `HydrationLog`, `DailyCheckIn` (stress/mood/cycle; the blueprint's insights needed them), `DayPlan`, `VoiceNote`, plus extra preference fields. All are documented in `docs/DATA-MODEL.md`. Any schema change must bump `SCHEMA_VERSION` in `src/core/defaults.ts` and add a migration in `parseEnvelope`.

All timestamps are ISO 8601. All IDs are UUIDs v4. Schema version field required on every export.

## Module Map

| Module | Purpose | Core Entity |
|---|---|---|
| Seizure Tracking | Log and trend seizure events | SeizureEvent, AuraLog |
| Medication Mgmt | Schedule, remind, track adherence | Medication, MedicationDose |
| Sleep | Sleep diary, wind-down routines | SleepEntry |
| Diet & Hydration | Meal timing, hydration, trigger foods | MealLog |
| Daily Checklist | Hour-by-hour routine (the spine of the app) | RoutineTemplate, RoutineChecklistItem |
| Rescue Protocol | Seizure action plan, SOS, emergency contacts | RescueProtocol, EmergencyContact |
| Insights | Correlations, trends, clinician report | InsightRule |

## Key UX Patterns

- **Quick seizure log**: FAB on every screen → bottom sheet → 2 taps to save.
- **Post-ictal safe mode**: Strips UI to essentials, enlarges targets, silences non-critical notifications.
- **Checklist auto-population**: Medication doses and scheduled meals auto-insert into the daily checklist from their respective modules.
- **Voice notes**: MediaRecorder API for low-effort seizure documentation.

## What Not to Build

- No social features in Phase 1.
- No AI/ML features in Phase 1 — insights use simple statistical correlations.
- No medication interaction checker that gives clinical advice.
- No symptom-to-diagnosis engine.
- No cloud sync.
- No user accounts or authentication (beyond local passcode).

## Build Order

See `app-blueprint.md` — "Build Order Checklist" at the end. Phase 1 (steps 1–5) is implemented. Open work is tracked in `BUGS.md`, not here.

## Commands

- `npm run dev`: dev server (sample data from the welcome screen)
- `npm test`: Vitest unit tests (core logic, storage, export/import)
- `npm run e2e`: Playwright against the production build under the production CSP. Covers critical flows, axe WCAG 2.2 AA, a <300 ms animation guard, offline, and a no-foreign-requests privacy check.
- `npm run lint`: ESLint + jsx-a11y (strict) + a no-pulse/bounce rule
- `./deploy/deploy.ps1 -Server 203.0.113.10 -KeyFile <openssh-key>`: test, build, publish a new release, and tag it in git. Refuses to run with uncommitted changes. Manual WinSCP steps are in `docs/DEPLOY.md`.

## Working Rules for Changes

1. Every fix corresponds to a `BUGS.md` item, and every feature to a `FEATURES.md` item. Add one if it doesn't exist.
2. **P1 items** (safety or data: reminders, doses, seizure timer, SOS, export, data loss) ship alone, the same day. **P2 items** ship in small batches of 3–5.
3. Add or adjust a test for each fix. `npm test`, `npm run lint` and `npm run e2e` must pass before committing.
4. **Never break existing user data.** New fields need defaults. Renames, removals and index changes need a new `db.version(n+1)` with an `.upgrade()` in `src/data/db.ts`, **and** a migration in `parseEnvelope` with a `SCHEMA_VERSION` bump. Never edit an existing Dexie version block or delete a table. Details are in `docs/WORKFLOW.md`.
5. After deploying: tag `release-<name>`, add a `CHANGELOG.md` entry, and tick the items off in `BUGS.md` with the release name.

## Code Conventions

- Business logic goes in `src/core/` (pure TS). Platform APIs go behind `src/platform/interfaces.ts`.
- Every mutating action in `src/data/repo.ts` returns an `Undo`; surface it through `toast(message, undo)`. Toasts never auto-dismiss.
- Sheets use `<Sheet>` from `src/ui/kit.tsx` (native `<dialog>`, mounted only while open).
- Insight statements must pass the exact binomial test in `core/insights.ts` and use “associated with” language.

## When You're Unsure

- **Clinical accuracy**: Check `knowledge-base.md` first. If it doesn't cover it, say "I'm not sure — verify with the knowledge base or a clinical source." Do not invent medical facts.
- **UX decisions**: Default to the simplest option that a confused, fatigued person could use one-handed. When in doubt, remove a feature rather than adding complexity.
- **Privacy**: When in doubt, don't collect the data. When in doubt, don't send it anywhere.
