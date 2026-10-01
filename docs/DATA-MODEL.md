# Data model

Types live in `src/core/types.ts` and mirror `app-blueprint.md` §2.3. Timestamps are ISO 8601 UTC, local calendar dates are `YYYY-MM-DD`, and times are `HH:mm`. IDs are UUID v4.

## Export envelope (schema 1.5.0)

```json
{
  "$schema": "https://steady.example.com/schema/export-v1.json",
  "schemaVersion": "1.5.0",
  "exportedAt": "…",
  "appVersion": "1.0.0",
  "checksum": "<sha-256 hex of JSON.stringify(data)>",
  "data": { "userProfile": {}, "seizureEvents": [], "…": [] }
}
```

Encrypted exports wrap the entire envelope:

```json
{ "format": "steady-encrypted-export", "schemaVersion": "1.5.0", "exportedAt": "…",
  "kdf": { "name": "PBKDF2", "hash": "SHA-256", "iterations": 310000, "saltBase64": "…" },
  "cipher": { "name": "AES-GCM", "ivBase64": "…" }, "ciphertextBase64": "…" }
```

Import accepts either format. It rejects files from a newer major version, migrates older minor versions by filling defaults, warns on a checksum mismatch, and offers **merge** (upsert by id; built-in trigger tags are de-duplicated by label) or **replace**.

## Extensions to the blueprint (1.0.0 → 1.1.0)

All additions are optional in imports and are filled with defaults.

| Where | Addition | Why |
|---|---|---|
| `UserProfile.preferences` | `textScale`, `remindersEnabled`, `maxNotificationsPerDay`, `missedDoseWindowMinutes`, `eveningCheckInEnabled`, `showSeizureFreeCount`, `emergencyInfoOnLockScreen`, `targetBedtime`, `targetWakeTime`, `windDownMinutes`, `hydrationGoalMl`, `glassSizeMl`, `hydrationNudgeHours`, `safeModeDurationHours`, `safeModeUntil`, `essentialsOnly`, `emergencyNumber`, `emergencyAfterMinutes`, `trackCycle`, `triggerFoods`; `theme` also accepts `contrast` | These settings are described in the blueprint's prose but were missing from the schema. |
| `UserProfile` | `onboarded`, `isSampleData` | First-run flow; clearly flagging sample data. |
| `Medication` | `unitsPerDose`, `isRescue` | Accurate refill countdown; rescue meds are listed in the plan but never scheduled. |
| `RoutineTemplateItem` | `isEssential`, `mealType` | “Essentials only” mode (§2.7 #1); ticking off a meal item creates a `MealLog` of the right type. |
| `RoutineChecklistItem` | `label`, `category`, `isOptional`, `isEssential`, `mealType`, `deferredUntil`, `isAdHoc` | A snapshot so history survives template edits; “later” deferrals; one-off items for today. |
| `RescueProtocol` | `howToHelp` | Plain first-aid guidance for bystanders, shown on the timer and the lock screen. |
| **New** `HydrationLog` | `{ id, timestamp, amountMl }` | The tap-to-add water widget. The blueprint's `MealLog.hydrationMl` is still read. |
| **New** `DailyCheckIn` | `{ date, stress, mood, onPeriod, illness, alcoholDrinks, seizureActivityReported, notes }` | The blueprint's insights use stress and the menstrual cycle, but no entity captured them. It also stores the answer to “Any seizure activity today?”. |
| **New** `DayPlan` | `{ date, templateId }` | “Use my Rest day routine today”. |
| **New** `VoiceNote` | `{ id, seizureEventId, blob, mimeType, durationMs }`; exported as base64 | `SeizureEvent.voiceNoteUri` is `voicenote:<id>`. |

## Extensions in 1.2.0 (F-002: support for thoughts of suicide or self-harm)

No Dexie version change: nothing is indexed. New fields are optional and read with defaults (`usePrefs` fills preferences from `DEFAULT_PREFERENCES`). `parseEnvelope` migrates 1.1.0 files by filling the same defaults.

| Where | Addition | Notes |
|---|---|---|
| `UserProfile` | `safetyPlan: SafetyPlan | null` | Seven free-text sections in the standard safety-planning structure, the message to send, and `showOnLockScreen` (default off). Written by the user, never analysed. |
| `UserProfile.preferences` | `country` (ISO code, `'other'`, or null), `customSupportLines[]`, `defaultSupportContactId` | Country drives the crisis lines and the default emergency number. |
| `EmergencyContact` | `supportPerson: boolean` | Someone she can reach out to when she isn't feeling safe. |

Crisis-line and emergency-number data is **not** stored per user. It ships in the app (`src/core/crisisLines.ts`, see [CRISIS-LINES.md](CRISIS-LINES.md)).

**Merge-mode import** keeps the device's own profile. The exception is support data: a safety plan, country, own numbers or main person in the backup are adopted when the device has none (`mergeSupportIntoProfile`). Anything already on the device wins.

## Extensions in 1.3.0 (F-001 dated side-effect log, F-007 medications that didn't work out)

**Database:** Dexie version 2 adds one table, `sideEffects: 'id, medicationId, startDate'`. Nothing existing is changed. Its `upgrade()` turns each medication's old undated `sideEffectsNoted` names into `SideEffectLog` rows with `startDate: null` ("date unknown"). The old field is **never** deleted or edited, so rolling back to an earlier release loses nothing.

| Where | Addition | Notes |
|---|---|---|
| **New** `SideEffectLog` | `{ id, medicationId \| null, name, startDate \| null, endDate \| null, severity: 'mild' \| 'moderate' \| 'severe' \| null, notes, createdAt, updatedAt }` | `medicationId: null` = "not sure which medication". `startDate: null` = "date unknown". `endDate: null` = still happening or not known. |
| `Medication` | `stopReason` (`not_controlling` \| `side_effects` \| `allergic_reaction` \| `cost_or_access` \| `other` \| null), `stopReasonNote` | Why it was stopped, if she said. `endDate` is the date she stopped. |
| `Medication.sideEffectsNoted` | **legacy** | Still stored and exported, no longer shown. The log replaces it. |

**Import migration** (`parseEnvelope`): a file without a `sideEffects` list (schema before 1.3.0) gets one built from each medication's `sideEffectsNoted`. Ids are made from the medication id and name (`deterministicId`), the same as the Dexie upgrade, so restoring an old backup never duplicates entries. Files that already carry a `sideEffects` list are not migrated. Medications get `stopReason: null`.

## Extensions in 1.4.0 (F-006 bowel and bladder, F-008 repeating routines)

**Database:** Dexie version 3 adds one table, `bathroomLogs: 'id, &date'` (one record per day). Nothing existing is changed and there is no upgrade step. Routine settings are new optional fields on existing records, so there is no index change.

| Where | Addition | Notes |
|---|---|---|
| **New** `BathroomLog` | `{ id, date, bowel: boolean \| null, bowelHow: 'hard' \| 'normal' \| 'loose' \| null, bowelNotes, urinationCount, createdAt, updatedAt }` | Unique per `date`; on import the imported record wins, as for sleep and check-ins. `bowel: null` = not answered. `bowelHow` is only kept when `bowel` is true. |
| `UserPreferences` | `trackBathroom` (default false) | Shows the Today card, calendar marker and report section. |
| `RoutineTemplate` | `repeatEveryDays` (≥ 2) and `repeatStartDate`; `doseShiftMinutes` (0 = none) and `doseShiftWhich` (`'all'` \| `'morning'`) | Optional. A routine with `repeatEveryDays` is used on the start date and every N days after it, instead of by weekday, and never takes part in the weekday choice. `doseShiftMinutes` moves scheduled medication times **later** on days the routine is used. A day's dose records hold the moved times, so reminders, the checklist and adherence all use them. |
| `RoutineCategory` | adds `bowel` and `bathroom` | "Bowel movement today?" (opens the bowel sheet) and "Bathroom break" (an ordinary reminder item). |

**Import migration** (`parseEnvelope`): routines without the new fields get `repeatEveryDays: null`, `repeatStartDate: null`, `doseShiftMinutes: 0`, `doseShiftWhich: 'all'`; `trackBathroom` defaults to false; `bathroomLogs` defaults to an empty list.

## Extensions in 1.5.0 (F-009 depression, anxiety and a "why" note)

No database change: `dailyCheckIns` keeps its indexes, and the new fields are optional (older check-ins read them as empty).

| Where | Addition | Notes |
|---|---|---|
| `DailyCheckIn` | `depression` and `anxiety` (1 to 5 or null), `feelingsNote` | Self-rated by her. Never scored, interpreted or used to trigger anything. The note is private and only goes in the report if she chooses. |

**Import migration** (`parseEnvelope`): check-ins without the new fields get `depression: null`, `anxiety: null`, `feelingsNote: null`.

**Merge-mode import of routines** (`reconcileTemplates`, B-012): the backup's routines are the ones used. On a never-set-up device its own default routines are removed; on a set-up device they are kept but stop claiming the weekdays and the default flag the backup's routines use. A device that was never set up also takes the backup's profile and settings.

## Linked records

- Ticking off a **meal** checklist item creates a `MealLog` with the **same id**. Undo deletes it exactly.
- Ticking off a **water** item creates a `HydrationLog` with the same id. “Add a glass” also ticks the next open water item.
- A **dose** marked taken decrements `Medication.remainingCount` by `unitsPerDose`. Undo restores it.
- Deleting a medication archives it (`isActive=false`, `endDate=today`) and keeps its dose history.
- Aura chips on a seizure form create or update one linked `AuraLog` (`progressedToSeizure: true`). “Warning sign only” creates a standalone `AuraLog`.
- `InsightRule` rows are refreshed from the latest computation, keyed by type and title, so a dismissal is remembered.
