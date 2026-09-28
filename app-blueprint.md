# Focal Epilepsy Management App — Application Blueprint

---

## 2.1 Design Principles

### Core Principles

1. **Low cognitive load**: Every screen answers one question or completes one action. No decision trees deeper than two taps. Default values everywhere — the user confirms rather than constructs.

2. **One-hand use, large targets**: Minimum touch target 48×48 dp (WCAG 2.2 AA). Primary actions are thumb-reachable in the bottom half of the screen. Swipe gestures are supplementary, never the only path to an action.

3. **High contrast and dark mode**: Default to a dark-on-light theme with a WCAG AAA contrast ratio (≥7:1) for body text. Full dark mode as a first-class option, not an afterthought. No thin or light-weight fonts.

4. **Seizure-safe visual design**:
   - No flashing or strobing content at any frequency. No animated transitions faster than 300ms. No auto-playing animations.
   - No high-saturation red patterns or rapid color alternation.
   - Respect `prefers-reduced-motion`: disable all non-essential animation when the OS setting is active.
   - No parallax scrolling.
   - Loading states use static spinners or progress bars, never pulsing/flickering indicators.

5. **Post-ictal usability**: After a seizure, the user may be confused, fatigued, have impaired vision, or limited fine motor control. Design for this state:
   - One-tap seizure logging from any screen.
   - Voice notes as a fallback for text input.
   - No timed interactions — nothing expires, nothing auto-dismisses.
   - Forgiving input: undo on every destructive action, auto-save on every field change.
   - "Safe mode" that strips the UI to essential actions only (see §2.4).

6. **Accessibility as a hard requirement**:
   - WCAG 2.2 AA minimum compliance. Target AAA where feasible.
   - Full keyboard navigation with visible focus indicators.
   - Screen reader support: all interactive elements labeled, all images have alt text, all charts have tabular fallbacks.
   - No information conveyed by color alone — use icons, patterns, or labels alongside color.

7. **Local-first trust model**: All data stored on-device. No server calls, no analytics, no telemetry. Data export/import as JSON. The user owns everything.

---

## 2.2 Modules

### Module 1: Seizure & Symptom Tracking

**Purpose**: Record seizure events with minimal friction during or after the event, and surface trends over time.

**User Stories**:
- As a user, I can log a seizure in under 10 seconds with a single tap (quick log).
- As a user, I can add detailed information (type, duration, aura, severity, triggers, notes) later.
- As a user, I can record a voice note when typing is too hard.
- As a user, I can see a timeline of my seizures with severity, type, and frequency trends.
- As a user, I can set an alert threshold (e.g., >3 seizures/week) and be notified if I cross it.
- As a caregiver, I can add an observer note to an event the user logged.

**Data Captured**: SeizureEvent (see §2.3): timestamp, type (focal aware / focal impaired awareness / focal to bilateral tonic-clonic / unknown), duration (seconds/minutes), severity (1–5 scale), aura symptoms (multi-select from a predefined + custom list), post-ictal symptoms, suspected trigger(s), location, activity at onset, rescue medication used, observer present (Y/N), observer notes, voice note attachment, free-text notes.

**Reminders/Alerts**:
- No proactive reminders to "log a seizure" — that would be intrusive and inappropriate.
- Threshold-based alerts: "You've logged [N] seizures this week, which is above your threshold of [X]. Consider contacting your neurologist."
- Gentle prompt at end-of-day checklist: "Any seizure activity today?" (optional, user-configured).

**Unified Interface Placement**: Floating action button (FAB) labeled "Log Seizure" available from every screen. The quick-log sheet slides up as a bottom sheet with pre-filled defaults. The seizure timeline appears as a card on the Today view and expands to a full timeline/chart view.

---

### Module 2: Medication Management

**Purpose**: Track medication schedules with hourly precision, support adherence, and help answer "Did I take it?"

**User Stories**:
- As a user, I can define my medication schedule (drug, dose, times) at hour granularity.
- As a user, I get reminders at my scheduled times (configurable: notification, alarm, or silent).
- As a user, I can confirm a dose with one tap from the notification or the app.
- As a user, I can mark a dose as "taken late," "skipped," or "unsure."
- As a user, I can see my adherence percentage over 7/30/90 days.
- As a user, I get a refill countdown (based on remaining supply I entered).
- As a user, I can record side effects linked to specific medications.

**Data Captured**: Medication (name, dose, unit, frequency, scheduled times, prescriber, pharmacy, refill date, remaining count, notes), MedicationDose (medication ID, scheduled time, actual time, status: taken/skipped/late/unsure, side effects noted).

**Reminders/Alerts**:
- Scheduled dose reminders (push notification, configurable lead time: 0/5/15/30 min before).
- Missed-dose alert: if not confirmed within a user-defined window (default: 60 min after scheduled time).
- Refill reminder: configurable days before estimated run-out (default: 7 days).
- Never: shame, streaks-as-punishment, or "you missed your medication!" language. Use: "Reminder: [Drug] [Dose] is scheduled for [Time]."

**Unified Interface Placement**: Medication card on the Today view showing next upcoming dose and today's adherence. Each dose appears as a checklist item in the daily routine (Module 5). Medication detail view accessible from the card.

---

### Module 3: Sleep Optimization

**Purpose**: Track sleep patterns, support consistent sleep hygiene, and correlate sleep with seizure activity.

**User Stories**:
- As a user, I can log my bedtime and wake time (manually or via a start/stop timer).
- As a user, I can set a target bedtime and wake time, and get a wind-down reminder.
- As a user, I can rate my sleep quality (1–5).
- As a user, I can see a chart correlating my sleep patterns with seizure frequency.
- As a user, I can set up a wind-down routine checklist (e.g., dim lights, no screens, relaxation exercise).

**Data Captured**: SleepEntry (date, target bedtime, actual bedtime, target wake time, actual wake time, duration calculated, quality rating, interruptions count, notes, wind-down checklist completion).

**Reminders/Alerts**:
- Wind-down reminder: configurable time before target bedtime (default: 30 min).
- Bedtime reminder: at target bedtime.
- Morning check-in: optional gentle prompt to log sleep quality on wake.
- Correlation alert: "Your seizure frequency increases when you sleep less than [X] hours" (generated after sufficient data, ≥30 days).

**Unified Interface Placement**: Sleep card on the Today view showing last night's sleep duration and quality. Wind-down routine items appear in the evening section of the daily checklist. Sleep–seizure correlation chart accessible from the Insights dashboard.

---

### Module 4: Diet & Meal Planning

**Purpose**: Support consistent meal timing, hydration tracking, and optional dietary protocol adherence.

**User Stories**:
- As a user, I can set scheduled meal times and get reminders.
- As a user, I can log meals with a simple entry (time, meal type, optional notes).
- As a user, I can track daily water intake (tap to add a glass/bottle).
- As a user, I can note trigger foods and see them flagged.
- As a user, I can enable a dietary mode (keto/MAD/LGIT) that adds relevant tracking prompts.
- As a user, I understand that diet features are tracking aids, not prescriptive medical nutrition therapy.

**Data Captured**: MealLog (timestamp, meal type [breakfast/lunch/dinner/snack], foods noted, trigger foods flagged, hydration intake [mL or glasses], diet mode active, carb count if in diet mode, notes).

**Reminders/Alerts**:
- Meal time reminders at user-defined hours.
- Hydration nudge: configurable interval (default: every 2 hours during waking hours, suppressible).
- No calorie counting, no body weight tracking — this is seizure management, not a diet app.

**Unified Interface Placement**: Meal and hydration items appear in the daily checklist at their scheduled hours. Hydration tracker is a persistent widget on the Today view (tap to increment). Diet mode, if enabled, adds a small carb counter to meal entries.

**Privacy note**: Any future shared trigger-food database must be opt-in, anonymized, and clearly separated from personal health data. Phase 1 uses only local, user-defined trigger lists.

---

### Module 5: Daily Routine Checklist

**Purpose**: The core feature. An hour-by-hour customizable checklist that integrates all modules into a single daily plan.

**User Stories**:
- As a user, I can create a daily routine template with items at specific hours.
- As a user, I can have multiple templates (weekday, weekend, sick day, travel).
- As a user, I can check off items as I complete them throughout the day.
- As a user, I see an overall daily completion percentage.
- As a user, I get gentle nudges for overdue items (not punitive).
- As a user, I can add custom items (stretch, journal, call doctor, walk the dog).
- As a user, I see streaks for multi-day consistency, but missing a day does not "break" anything — there is no punishment, only encouragement.

**Data Captured**: RoutineTemplate (name, type [weekday/weekend/custom], items with hour assignments), RoutineChecklistItem (template item ID, date, hour, status [pending/done/skipped/deferred], completion time, auto-populated from modules [medication, meal, hydration, sleep, exercise]).

**Design Rules**:
- Auto-populate from other modules: medication doses, meal times, bedtime, and wake time are automatically placed in the checklist at their scheduled hours.
- Custom items can be added at any hour.
- The checklist scrolls to "now" by default, showing the current and next few items.
- Overdue items float to the top with a gentle visual indicator (not red — use a muted accent).
- Completion state: items show checkmark (done), dash (skipped), or empty (pending). No "failed" state.
- Streaks: "You've completed your full routine for 5 days" — but a missed day says "Let's pick back up today" rather than "Streak broken."

**Reminders/Alerts**:
- Per-item reminders at the scheduled hour (consolidated with module-specific reminders to avoid duplication).
- End-of-day summary: "You completed 18 of 22 items today. Great work." (optional, configurable).

**Unified Interface Placement**: The daily checklist IS the primary view of the Today screen. It is the backbone into which all other modules feed their items.

---

### Module 6: Mitigation / Rescue Protocol

**Purpose**: Provide immediate access to the seizure action plan, grounding exercises, and emergency contacts during or after a seizure.

**User Stories**:
- As a user, I can access my seizure action plan with one tap from any screen.
- As a user, I can share my seizure action plan as a PDF or link with a caregiver.
- As a user, I can access breathing and grounding exercises (for aura or post-ictal anxiety).
- As a user, I can trigger an emergency alert to my listed contacts with one tap.
- As a caregiver, I can view the user's rescue protocol, medication list, and emergency info without needing to unlock the app.

**Data Captured**: RescueProtocol (seizure description, rescue medication instructions, when to call 911, allergies, current medication list, neurologist contact, notes), EmergencyContact (name, relationship, phone, notification preference).

**Reminders/Alerts**:
- No proactive reminders — this module is reactive.
- Emergency alert: sends a pre-written message to emergency contacts (SMS or other configured channel). Message includes: "I may be having a seizure. My location is [if GPS enabled and consented]. My seizure action plan is attached."
- Annual reminder to review and update the rescue protocol.

**Unified Interface Placement**: Persistent "SOS" or "Rescue" button on the Today view (always visible, distinct from other UI). Grounding exercises accessible from a calm, minimal sub-screen. Seizure action plan is viewable even from the lock screen (if platform supports lock-screen widgets — Phase 2).

---

### Module 7: Insights Dashboard

**Purpose**: Surface correlations between daily habits and seizure activity using plain-language explanations.

**User Stories**:
- As a user, I can see my seizure frequency over time (7/30/90 days, custom range).
- As a user, I can see correlations: seizures vs. sleep duration, medication adherence, meal regularity, hydration, stress level, menstrual cycle.
- As a user, I understand insights in plain language: "You had more seizures on days when you slept less than 6 hours."
- As a user, I can generate a summary report (PDF or shareable text) for my neurologist.
- As a user, I can see which triggers appear most frequently in my logged seizure events.

**Data Captured**: InsightRule (computed, not user-entered): correlation type, variables, time range, confidence level, plain-language description, date generated.

**Visualizations** (all with accessible alternatives):
- Seizure frequency timeline (bar or line chart with annotation markers for medication changes, trigger events).
- Adherence heatmap (calendar view, days colored by completion %).
- Correlation scatter plots or paired bar charts (sleep vs. seizures, adherence vs. seizures).
- Trigger frequency ranking (horizontal bar chart).
- All charts: high-contrast colors, no reliance on color alone, tabular data view toggle, screen-reader descriptions.

**Unified Interface Placement**: Summary card on the Today view ("This week: [N] seizures, [X%] adherence, avg [Y] hours sleep"). Full dashboard accessible from a dedicated section, not a separate app tab — it lives below the daily checklist or in a secondary scroll position.

---

## 2.3 Data Model

All timestamps are ISO 8601 (UTC with timezone offset stored separately). All IDs are UUIDs (v4). Schema version is required at the root of every export for migration.

### Export Envelope

```json
{
  "$schema": "https://example.com/epilepsy-app/export-schema/v1.json",
  "schemaVersion": "1.0.0",
  "exportedAt": "2026-09-27T12:00:00Z",
  "appVersion": "1.0.0",
  "data": {
    "userProfile": {},
    "seizureEvents": [],
    "auraLogs": [],
    "medications": [],
    "medicationDoses": [],
    "mealLogs": [],
    "sleepEntries": [],
    "routineTemplates": [],
    "routineChecklistItems": [],
    "triggerTags": [],
    "rescueProtocol": {},
    "emergencyContacts": [],
    "insightRules": []
  }
}
```

### Entity Schemas

#### UserProfile

```json
{
  "type": "object",
  "properties": {
    "id": { "type": "string", "format": "uuid" },
    "displayName": { "type": "string" },
    "dateOfBirth": { "type": "string", "format": "date" },
    "epilepsyType": { "type": "string", "enum": ["focal", "generalized", "combined", "unknown"] },
    "seizureFocus": { "type": "string", "description": "e.g., left temporal, right frontal" },
    "diagnosisDate": { "type": "string", "format": "date" },
    "timezone": { "type": "string", "description": "IANA timezone, e.g., America/New_York" },
    "preferences": {
      "type": "object",
      "properties": {
        "theme": { "type": "string", "enum": ["light", "dark", "system"] },
        "reducedMotion": { "type": "boolean" },
        "reminderLeadMinutes": { "type": "integer", "default": 15 },
        "dailySummaryEnabled": { "type": "boolean", "default": true },
        "dailySummaryTime": { "type": "string", "format": "time" },
        "seizureThresholdPerWeek": { "type": "integer", "nullable": true },
        "dietMode": { "type": "string", "enum": ["none", "keto", "mad", "lgit"], "default": "none" },
        "passcodeEnabled": { "type": "boolean", "default": false },
        "autoLockMinutes": { "type": "integer", "default": 5 }
      }
    },
    "createdAt": { "type": "string", "format": "date-time" },
    "updatedAt": { "type": "string", "format": "date-time" }
  },
  "required": ["id", "timezone", "createdAt", "updatedAt"]
}
```

#### SeizureEvent

```json
{
  "type": "object",
  "properties": {
    "id": { "type": "string", "format": "uuid" },
    "timestamp": { "type": "string", "format": "date-time" },
    "endTimestamp": { "type": "string", "format": "date-time", "nullable": true },
    "type": {
      "type": "string",
      "enum": ["focal_aware", "focal_impaired_awareness", "focal_to_bilateral_tonic_clonic", "unknown"]
    },
    "durationSeconds": { "type": "integer", "nullable": true },
    "severity": { "type": "integer", "minimum": 1, "maximum": 5, "description": "1=minimal, 5=severe" },
    "auraIds": { "type": "array", "items": { "type": "string", "format": "uuid" } },
    "postIctalSymptoms": {
      "type": "array",
      "items": { "type": "string" },
      "description": "Multi-select: confusion, fatigue, headache, todds_paresis, aphasia, mood_change, memory_gap"
    },
    "triggerTagIds": {
      "type": "array",
      "items": { "type": "string", "format": "uuid" }
    },
    "location": { "type": "string", "nullable": true },
    "activityAtOnset": { "type": "string", "nullable": true },
    "rescueMedicationUsed": { "type": "boolean", "default": false },
    "rescueMedicationDetails": { "type": "string", "nullable": true },
    "observerPresent": { "type": "boolean", "nullable": true },
    "observerNotes": { "type": "string", "nullable": true },
    "voiceNoteUri": { "type": "string", "nullable": true, "description": "Local file URI for voice recording" },
    "notes": { "type": "string", "nullable": true },
    "isQuickLog": { "type": "boolean", "default": false, "description": "True if logged via quick-log (details may be incomplete)" },
    "createdAt": { "type": "string", "format": "date-time" },
    "updatedAt": { "type": "string", "format": "date-time" }
  },
  "required": ["id", "timestamp", "type", "severity", "createdAt", "updatedAt"]
}
```

#### AuraLog

```json
{
  "type": "object",
  "properties": {
    "id": { "type": "string", "format": "uuid" },
    "seizureEventId": { "type": "string", "format": "uuid", "nullable": true, "description": "Linked seizure, if one followed" },
    "timestamp": { "type": "string", "format": "date-time" },
    "symptoms": {
      "type": "array",
      "items": { "type": "string" },
      "description": "Multi-select: deja_vu, epigastric_rising, fear, olfactory, gustatory, visual, tingling, numbness, dizziness, other"
    },
    "durationSeconds": { "type": "integer", "nullable": true },
    "progressedToSeizure": { "type": "boolean" },
    "notes": { "type": "string", "nullable": true },
    "createdAt": { "type": "string", "format": "date-time" }
  },
  "required": ["id", "timestamp", "symptoms", "progressedToSeizure", "createdAt"]
}
```

#### Medication

```json
{
  "type": "object",
  "properties": {
    "id": { "type": "string", "format": "uuid" },
    "name": { "type": "string" },
    "genericName": { "type": "string", "nullable": true },
    "dosage": { "type": "string", "description": "e.g., '500mg'" },
    "unit": { "type": "string", "description": "e.g., 'mg', 'mL'" },
    "frequency": { "type": "string", "description": "e.g., 'twice daily'" },
    "scheduledTimes": {
      "type": "array",
      "items": { "type": "string", "format": "time" },
      "description": "ISO time strings, e.g., ['08:00', '20:00']"
    },
    "prescriber": { "type": "string", "nullable": true },
    "pharmacy": { "type": "string", "nullable": true },
    "remainingCount": { "type": "integer", "nullable": true },
    "refillDate": { "type": "string", "format": "date", "nullable": true },
    "refillReminderDays": { "type": "integer", "default": 7 },
    "isActive": { "type": "boolean", "default": true },
    "startDate": { "type": "string", "format": "date" },
    "endDate": { "type": "string", "format": "date", "nullable": true },
    "sideEffectsNoted": { "type": "array", "items": { "type": "string" } },
    "notes": { "type": "string", "nullable": true },
    "createdAt": { "type": "string", "format": "date-time" },
    "updatedAt": { "type": "string", "format": "date-time" }
  },
  "required": ["id", "name", "dosage", "scheduledTimes", "isActive", "startDate", "createdAt", "updatedAt"]
}
```

#### MedicationDose

```json
{
  "type": "object",
  "properties": {
    "id": { "type": "string", "format": "uuid" },
    "medicationId": { "type": "string", "format": "uuid" },
    "scheduledTime": { "type": "string", "format": "date-time" },
    "actualTime": { "type": "string", "format": "date-time", "nullable": true },
    "status": {
      "type": "string",
      "enum": ["pending", "taken", "taken_late", "skipped", "unsure"]
    },
    "sideEffects": { "type": "array", "items": { "type": "string" } },
    "notes": { "type": "string", "nullable": true },
    "createdAt": { "type": "string", "format": "date-time" }
  },
  "required": ["id", "medicationId", "scheduledTime", "status", "createdAt"]
}
```

#### MealLog

```json
{
  "type": "object",
  "properties": {
    "id": { "type": "string", "format": "uuid" },
    "timestamp": { "type": "string", "format": "date-time" },
    "mealType": { "type": "string", "enum": ["breakfast", "lunch", "dinner", "snack"] },
    "foods": { "type": "string", "nullable": true },
    "triggerFoodsFlagged": { "type": "array", "items": { "type": "string" } },
    "hydrationMl": { "type": "integer", "default": 0 },
    "carbsGrams": { "type": "integer", "nullable": true, "description": "Only tracked if dietMode is active" },
    "notes": { "type": "string", "nullable": true },
    "createdAt": { "type": "string", "format": "date-time" }
  },
  "required": ["id", "timestamp", "mealType", "createdAt"]
}
```

#### SleepEntry

```json
{
  "type": "object",
  "properties": {
    "id": { "type": "string", "format": "uuid" },
    "date": { "type": "string", "format": "date", "description": "The night of (e.g., 2026-09-26 for the night of Sep 26–27)" },
    "targetBedtime": { "type": "string", "format": "time" },
    "actualBedtime": { "type": "string", "format": "time", "nullable": true },
    "targetWakeTime": { "type": "string", "format": "time" },
    "actualWakeTime": { "type": "string", "format": "time", "nullable": true },
    "durationMinutes": { "type": "integer", "nullable": true },
    "qualityRating": { "type": "integer", "minimum": 1, "maximum": 5, "nullable": true },
    "interruptions": { "type": "integer", "default": 0 },
    "windDownCompleted": { "type": "boolean", "default": false },
    "notes": { "type": "string", "nullable": true },
    "createdAt": { "type": "string", "format": "date-time" }
  },
  "required": ["id", "date", "targetBedtime", "targetWakeTime", "createdAt"]
}
```

#### RoutineTemplate

```json
{
  "type": "object",
  "properties": {
    "id": { "type": "string", "format": "uuid" },
    "name": { "type": "string", "description": "e.g., 'Weekday', 'Weekend', 'Sick Day'" },
    "isDefault": { "type": "boolean", "default": false },
    "applicableDays": {
      "type": "array",
      "items": { "type": "integer", "minimum": 0, "maximum": 6 },
      "description": "0=Sunday, 6=Saturday. Empty = manually selected."
    },
    "items": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "id": { "type": "string", "format": "uuid" },
          "hour": { "type": "integer", "minimum": 0, "maximum": 23 },
          "minute": { "type": "integer", "minimum": 0, "maximum": 59, "default": 0 },
          "label": { "type": "string" },
          "category": {
            "type": "string",
            "enum": ["medication", "meal", "hydration", "sleep", "exercise", "stress_check", "mood", "custom"]
          },
          "linkedEntityId": {
            "type": "string",
            "format": "uuid",
            "nullable": true,
            "description": "Links to a Medication.id, etc. for auto-populated items"
          },
          "reminderEnabled": { "type": "boolean", "default": true },
          "reminderOffsetMinutes": { "type": "integer", "default": 0 },
          "isOptional": { "type": "boolean", "default": false }
        },
        "required": ["id", "hour", "label", "category"]
      }
    },
    "createdAt": { "type": "string", "format": "date-time" },
    "updatedAt": { "type": "string", "format": "date-time" }
  },
  "required": ["id", "name", "items", "createdAt", "updatedAt"]
}
```

#### RoutineChecklistItem (Daily Instance)

```json
{
  "type": "object",
  "properties": {
    "id": { "type": "string", "format": "uuid" },
    "templateItemId": { "type": "string", "format": "uuid" },
    "templateId": { "type": "string", "format": "uuid" },
    "date": { "type": "string", "format": "date" },
    "scheduledHour": { "type": "integer", "minimum": 0, "maximum": 23 },
    "scheduledMinute": { "type": "integer", "minimum": 0, "maximum": 59, "default": 0 },
    "status": { "type": "string", "enum": ["pending", "done", "skipped", "deferred"] },
    "completedAt": { "type": "string", "format": "date-time", "nullable": true },
    "notes": { "type": "string", "nullable": true },
    "createdAt": { "type": "string", "format": "date-time" }
  },
  "required": ["id", "templateItemId", "templateId", "date", "scheduledHour", "status", "createdAt"]
}
```

#### TriggerTag

```json
{
  "type": "object",
  "properties": {
    "id": { "type": "string", "format": "uuid" },
    "label": { "type": "string", "description": "e.g., 'Sleep deprivation', 'Missed meds', 'Stress', 'Alcohol'" },
    "category": {
      "type": "string",
      "enum": ["sleep", "medication", "diet", "stress", "substance", "hormonal", "illness", "environmental", "other"]
    },
    "isBuiltIn": { "type": "boolean", "description": "True for app-provided defaults; false for user-created" },
    "createdAt": { "type": "string", "format": "date-time" }
  },
  "required": ["id", "label", "category", "createdAt"]
}
```

#### RescueProtocol

```json
{
  "type": "object",
  "properties": {
    "id": { "type": "string", "format": "uuid" },
    "seizureDescription": { "type": "string", "description": "What my seizures typically look like" },
    "rescueMedicationInstructions": { "type": "string", "nullable": true },
    "whenToCall911": { "type": "string", "description": "e.g., 'Seizure lasts >5 minutes, repeated seizures, injury'" },
    "allergies": { "type": "array", "items": { "type": "string" } },
    "currentMedications": { "type": "string", "description": "Free text summary or auto-generated from Medication entities" },
    "neurologistName": { "type": "string", "nullable": true },
    "neurologistPhone": { "type": "string", "nullable": true },
    "additionalNotes": { "type": "string", "nullable": true },
    "lastReviewedAt": { "type": "string", "format": "date-time", "nullable": true },
    "createdAt": { "type": "string", "format": "date-time" },
    "updatedAt": { "type": "string", "format": "date-time" }
  },
  "required": ["id", "seizureDescription", "whenToCall911", "createdAt", "updatedAt"]
}
```

#### EmergencyContact

```json
{
  "type": "object",
  "properties": {
    "id": { "type": "string", "format": "uuid" },
    "name": { "type": "string" },
    "relationship": { "type": "string" },
    "phone": { "type": "string" },
    "email": { "type": "string", "nullable": true },
    "notifyOnEmergency": { "type": "boolean", "default": true },
    "canViewRescueProtocol": { "type": "boolean", "default": true },
    "sortOrder": { "type": "integer" },
    "createdAt": { "type": "string", "format": "date-time" }
  },
  "required": ["id", "name", "phone", "createdAt"]
}
```

#### InsightRule

```json
{
  "type": "object",
  "properties": {
    "id": { "type": "string", "format": "uuid" },
    "correlationType": {
      "type": "string",
      "enum": ["sleep_duration_vs_seizures", "adherence_vs_seizures", "meal_regularity_vs_seizures", "hydration_vs_seizures", "trigger_frequency", "time_of_day_pattern", "day_of_week_pattern", "custom"]
    },
    "timeRangeDays": { "type": "integer" },
    "variables": { "type": "object", "description": "Correlation parameters and computed values" },
    "confidenceLevel": { "type": "string", "enum": ["low", "moderate", "high"] },
    "plainLanguageSummary": { "type": "string" },
    "generatedAt": { "type": "string", "format": "date-time" },
    "dismissedByUser": { "type": "boolean", "default": false }
  },
  "required": ["id", "correlationType", "timeRangeDays", "plainLanguageSummary", "generatedAt"]
}
```

### Relationships

```
UserProfile (1) ── (many) Medication
UserProfile (1) ── (many) RoutineTemplate
UserProfile (1) ── (1)    RescueProtocol
UserProfile (1) ── (many) EmergencyContact

Medication (1)     ── (many) MedicationDose
SeizureEvent (1)   ── (many) AuraLog         [via auraIds / seizureEventId]
SeizureEvent (many)── (many) TriggerTag      [via triggerTagIds]
RoutineTemplate (1)── (many) RoutineChecklistItem [via templateId + templateItemId]
```

### Hour-Granularity Scheduling

Scheduling is represented by the `hour` (0–23) and `minute` (0–59) fields on `RoutineTemplate.items` and `Medication.scheduledTimes`. The daily checklist is generated each day by:

1. Select the applicable `RoutineTemplate` for the current day-of-week.
2. Instantiate a `RoutineChecklistItem` for each template item.
3. Merge in `MedicationDose` entries (auto-generated from active `Medication.scheduledTimes`).
4. Sort by `scheduledHour`, then `scheduledMinute`.

This generation happens locally at the start of each day (or on first app open that day).

---

## 2.4 Workflows

### Workflow 1: Log a Seizure in Under 10 Seconds

```
[Any Screen]
    │
    ├── Tap "Log Seizure" FAB (always visible)
    │
    ├── Bottom sheet slides up:
    │     ┌─────────────────────────────┐
    │     │  Quick Seizure Log          │
    │     │                             │
    │     │  Type: [Focal Aware ▼]      │
    │     │  Severity: [● ● ● ○ ○]     │
    │     │  Time: [Now]                │
    │     │                             │
    │     │  [Save]  [Add Details →]    │
    │     └─────────────────────────────┘
    │
    ├── Tap [Save] → event saved with isQuickLog=true, sheet dismisses.
    │   Total: 2 taps (FAB + Save) if defaults are acceptable.
    │
    └── Tap [Add Details →] → expands to full event capture sheet (§2.5 Screen 2).
```

### Workflow 2: Complete a Day's Checklist

```
[Morning: Open App]
    │
    ├── Today view loads, checklist scrolled to current hour.
    │
    ├── For each item (medication, meal, hydration, custom):
    │     ├── Tap checkbox → status = "done", timestamp recorded.
    │     ├── Long press → options: skip, defer, add note.
    │     └── Swipe right → quick "done" (if enabled in settings).
    │
    ├── Overdue items: appear at top of visible area with muted accent.
    │     └── Tap → mark done (late) or skip. No alarm, no shame.
    │
    ├── Progress bar at top: "14 of 20 items completed."
    │
    └── [End of day] Optional summary notification: "18/22 done. Rest well."
```

### Workflow 3: Set Up a Daily Schedule

```
[Settings → Routines]
    │
    ├── Select template (Weekday / Weekend / + New)
    │
    ├── Hour-by-hour grid:
    │     06:00  [Wake up]          [sleep]
    │     06:30  [Levetiracetam]    [medication] ← auto from Medication
    │     07:00  [Breakfast]        [meal]
    │     08:00  [Water]            [hydration]
    │     ...
    │     22:00  [Wind-down]        [sleep]
    │     22:30  [Levetiracetam]    [medication]
    │     23:00  [Bedtime]          [sleep]
    │
    ├── Tap any row to edit time, label, category, reminder.
    ├── Tap [+] at any hour to add a custom item.
    ├── Drag to reorder within the same hour.
    ├── Assign template to days of week (checkboxes: M T W T F S S).
    │
    └── [Save] → template saved, daily generation updated.
```

### Workflow 4: Export Data

```
[Settings → Data]
    │
    ├── [Export All Data]
    │     ├── Format: JSON (default) or CSV (tabular subset)
    │     ├── Optional: encrypt with passphrase
    │     ├── Preview: "Exporting 342 seizure events, 2,847 dose records..."
    │     └── [Export] → file saved to device downloads / share sheet.
    │
    ├── [Import Data]
    │     ├── Select JSON file
    │     ├── Schema version check → auto-migrate if older version
    │     ├── Preview: "This file contains 342 seizure events..."
    │     ├── Option: merge with existing or replace all
    │     └── [Import] → data loaded, confirmation shown.
    │
    └── [Generate Clinician Report]
          ├── Date range selector
          ├── Preview of PDF-like summary
          └── [Share] → PDF or plaintext via share sheet.
```

### Workflow 5: Caregiver Handoff

```
[Rescue Protocol screen]
    │
    ├── [Share Seizure Action Plan]
    │     ├── Generates a standalone HTML or PDF document containing:
    │     │   - Patient name (display name only)
    │     │   - Seizure type description
    │     │   - What a seizure looks like for this person
    │     │   - Rescue medication instructions
    │     │   - When to call 911
    │     │   - Current medication list
    │     │   - Allergies
    │     │   - Emergency contacts
    │     │   - Neurologist contact
    │     │
    │     └── Share via: AirDrop, message, email, print, save to files.
    │         No data is sent to any server. The document is generated locally.
    │
    └── [Emergency Contacts]
          └── Each contact can be marked "Can view rescue protocol"
              → If lock-screen widget is implemented (Phase 2),
                 these contacts see the protocol without app unlock.
```

### Post-Ictal Safe Mode

**Trigger**: User manually activates it ("I just had a seizure" button on the rescue screen), or the app suggests it after a logged seizure event.

**What changes**:
- UI simplifies: only the daily checklist, seizure log button, and rescue protocol are visible.
- All non-essential reminders are silenced for a user-configured duration (default: 4 hours).
- Font size increases by 25%.
- Touch targets increase by 50%.
- Color scheme shifts to maximum contrast with muted tones.
- A prominent "I'm OK" button dismisses safe mode when the user is ready.
- If the user doesn't dismiss safe mode, it auto-deactivates after the configured duration.

**What doesn't change**:
- Medication reminders remain active (these are safety-critical).
- Emergency contacts remain accessible.
- Data continues to auto-save normally.

---

## 2.5 UI Sketch — Key Screens

### Screen 1: Unified Today View (Home)

```
┌─────────────────────────────────────────────┐
│  [≡]    Today, Sep 27          [🔔] [SOS]  │
│─────────────────────────────────────────────│
│                                             │
│  ┌─ Status Bar ──────────────────────────┐  │
│  │ Seizure-free: 12 days                 │  │
│  │ Today: 14/20 items  ████████░░  70%   │  │
│  └───────────────────────────────────────┘  │
│                                             │
│  ┌─ Current / Next ─────────────────────┐  │
│  │ ▶ 14:00  Levetiracetam 500mg    [ ]  │  │
│  │   14:30  Water (glass 5/8)       [ ]  │  │
│  │   15:00  Afternoon snack         [ ]  │  │
│  └──────────────────────────────────────┘  │
│                                             │
│  ┌─ Earlier Today ──────────────────────┐  │
│  │ ✓ 08:00  Lamotrigine 200mg       [✓] │  │
│  │ ✓ 08:30  Breakfast               [✓] │  │
│  │ ✓ 10:00  Water                   [✓] │  │
│  │ — 12:00  Lunch                   [—] │  │
│  │ ✓ 12:30  Stress check            [✓] │  │
│  └──────────────────────────────────────┘  │
│                                             │
│  ┌─ Quick Stats ────────────────────────┐  │
│  │ This week: 1 seizure │ 92% adherence │  │
│  │ Avg sleep: 7.2 hrs   │ Hydration: OK │  │
│  └──────────────────────────────────────┘  │
│                                             │
│              [ + Log Seizure ]              │
│─────────────────────────────────────────────│
│  [Today]    [Insights]   [Schedule]  [More] │
└─────────────────────────────────────────────┘
```

**Layout notes**:
- Status bar is a compact summary, not a dashboard. Seizure-free count is optional (some patients find countdowns stressful — configurable).
- Checklist is the primary content area, sorted chronologically, scrolled to "now."
- SOS button is always visible in the header — high contrast, distinct from navigation.
- FAB for seizure logging is at the bottom, large, always accessible.
- Bottom navigation is minimal: 4 items maximum. "More" contains settings, data, profile.

### Screen 2: Event Capture Sheet (Seizure Detail)

```
┌─────────────────────────────────────────────┐
│  [✕ Cancel]     Log Seizure       [Save]    │
│─────────────────────────────────────────────│
│                                             │
│  When                                       │
│  ┌──────────────────────────────────────┐   │
│  │  Date: [Today, Sep 27]               │   │
│  │  Time: [14:32]                       │   │
│  │  Duration: [__ min __ sec]           │   │
│  └──────────────────────────────────────┘   │
│                                             │
│  Type                                       │
│  ┌──────────────────────────────────────┐   │
│  │ (●) Focal aware                      │   │
│  │ ( ) Focal impaired awareness         │   │
│  │ ( ) Focal to bilateral tonic-clonic  │   │
│  │ ( ) I don't know                     │   │
│  └──────────────────────────────────────┘   │
│                                             │
│  Severity                                   │
│  [ 1 ]  [ 2 ]  [ 3 ]  [ 4 ]  [ 5 ]        │
│  mild                          severe       │
│                                             │
│  Aura / Warning Signs                       │
│  [Déjà vu] [Fear] [Rising feeling] [+]      │
│                                             │
│  Suspected Triggers                         │
│  [Poor sleep] [Stress] [Missed meds] [+]    │
│                                             │
│  ┌──────────────────────────────────────┐   │
│  │  [ 🎤 Voice Note ]  [ 📝 Text Note ] │   │
│  └──────────────────────────────────────┘   │
│                                             │
│  Post-Ictal Symptoms                        │
│  [Confusion] [Fatigue] [Headache] [+]       │
│                                             │
│  Observer Present?  [Yes] [No]              │
│  Observer Notes: [________________]         │
│                                             │
│  Rescue Medication Used?  [Yes] [No]        │
│                                             │
│               [ Save Event ]                │
└─────────────────────────────────────────────┘
```

**Interaction notes**:
- All fields except Type and Severity are optional — the form works with minimal input.
- Aura and trigger tags are pill-shaped multi-select buttons. Most common appear first (learned from user history). [+] adds custom tags.
- Voice note button records immediately on tap — no confirmation dialog.
- Auto-save: if the user leaves the screen mid-entry, all entered data is preserved as a draft.
- Large touch targets throughout. No small checkboxes.

### Screen 3: Schedule Editor

```
┌─────────────────────────────────────────────┐
│  [← Back]     Schedule Editor     [Save]    │
│─────────────────────────────────────────────│
│                                             │
│  Template: [Weekday ▼]                      │
│  Active days: [M][T][W][T][F][ ][ ]         │
│                                             │
│  ┌──────────────────────────────────────┐   │
│  │  06:00  ──────────────────────────── │   │
│  │  ├── Wake up              [sleep]    │   │
│  │                                      │   │
│  │  07:00  ──────────────────────────── │   │
│  │  ├── Levetiracetam 500mg  [meds] 🔗 │   │
│  │  ├── Breakfast            [meal]     │   │
│  │                                      │   │
│  │  08:00  ──────────────────────────── │   │
│  │  ├── Water                [hydra]    │   │
│  │                                      │   │
│  │  ...                                 │   │
│  │                                      │   │
│  │  [+ Add Item at Hour]                │   │
│  └──────────────────────────────────────┘   │
│                                             │
│  Linked items (🔗) are auto-generated from  │
│  your medication schedule. Edit them in     │
│  Medication settings.                       │
└─────────────────────────────────────────────┘
```

**Interaction notes**:
- Hour-by-hour timeline with items nested under their hour.
- Drag handles for reordering items within the same hour block.
- Linked items (from medications) show a chain icon and cannot be deleted here — editing happens in the medication module.
- Tap any item to edit its label, category, time, and reminder settings.
- "Add Item" opens a small form: hour picker, label, category dropdown.

### Screen 4: Insights Dashboard

```
┌─────────────────────────────────────────────┐
│  [← Back]       Insights                    │
│─────────────────────────────────────────────│
│                                             │
│  Time Range: [Last 30 days ▼]               │
│                                             │
│  ┌─ Seizure Frequency ──────────────────┐   │
│  │  ▕█                                  │   │
│  │  ▕█    █                             │   │
│  │  ▕█  █ █      █                      │   │
│  │  ▕█  █ █  █   █         █            │   │
│  │  ──────────────────────────────────   │   │
│  │  W1   W2   W3   W4                   │   │
│  │  [View as table]                     │   │
│  └──────────────────────────────────────┘   │
│                                             │
│  ┌─ Key Insight ────────────────────────┐   │
│  │  "You had more seizures on days      │   │
│  │   when you slept less than 6 hours.  │   │
│  │   This pattern appeared in 4 of your │   │
│  │   last 6 seizures."                  │   │
│  │                                      │   │
│  │  Confidence: Moderate                │   │
│  │  [Dismiss] [Tell me more]            │   │
│  └──────────────────────────────────────┘   │
│                                             │
│  ┌─ Adherence ──────────────────────────┐   │
│  │  Overall: 94%                        │   │
│  │  ┌─Calendar heatmap────────────┐     │   │
│  │  │ [green/muted cells by day]  │     │   │
│  │  └─────────────────────────────┘     │   │
│  └──────────────────────────────────────┘   │
│                                             │
│  ┌─ Top Triggers ───────────────────────┐   │
│  │  Poor sleep        ████████  6       │   │
│  │  Stress            ██████    4       │   │
│  │  Missed medication ████      3       │   │
│  │  Illness           ██        1       │   │
│  └──────────────────────────────────────┘   │
│                                             │
│  [ Generate Report for Neurologist ]        │
└─────────────────────────────────────────────┘
```

**Interaction notes**:
- All charts use high-contrast colors with pattern fills (not color alone). Dark mode supported.
- "View as table" toggle on every chart for screen readers and users who prefer data tables.
- Key insights are generated locally using simple correlation analysis (not AI/ML in Phase 1 — straightforward statistical associations with a confidence qualifier).
- "Generate Report" produces a printable/shareable summary document (HTML rendered as PDF or plain text).

---

## 2.6 Privacy and Security

### Data Points Collected (Exhaustive List)

All of the following are health data:

| Category | Specific Data Points |
|---|---|
| **Identity** | Display name, date of birth (optional), timezone |
| **Epilepsy profile** | Epilepsy type, seizure focus, diagnosis date |
| **Seizure events** | Date, time, type, duration, severity, aura symptoms, post-ictal symptoms, triggers, location, activity, rescue medication use, observer notes, voice recordings |
| **Medications** | Drug names, dosages, schedules, prescriber name, pharmacy, adherence records, side effects |
| **Sleep** | Bedtime, wake time, duration, quality, interruptions |
| **Diet** | Meal times, food descriptions, trigger foods, hydration, carb counts |
| **Routine** | Daily checklist items, completion status, completion times |
| **Rescue protocol** | Seizure descriptions, rescue medication instructions, allergies, neurologist contact |
| **Emergency contacts** | Names, relationships, phone numbers, email addresses |
| **Behavioral patterns** | Stress levels, mood indicators, exercise logs |
| **Derived insights** | Correlation analyses, seizure forecasts (Phase 2) |

### Local-Only Storage Architecture

**Phase 1 (Web/PWA)**:
- All data stored in IndexedDB via a structured wrapper (e.g., Dexie.js or idb).
- No data leaves the device. No network requests for data storage or retrieval.
- Service worker caches the application shell and static assets for offline use.
- No analytics, no crash reporting, no telemetry.

**Encryption at Rest**:
- IndexedDB is not encrypted by default in most browsers. The encryption strategy for Phase 1:
  1. **Option A (recommended)**: Use the Web Crypto API to encrypt sensitive fields (seizure events, medication records, notes) with a user-derived key (PBKDF2 from a passphrase) before writing to IndexedDB. Decrypt on read. Store the salt in IndexedDB (the salt is not secret).
  2. **Option B**: Encrypt the entire export file. Leave IndexedDB unencrypted but require device-level passcode (the browser/OS provides this layer).
  3. **Recommended approach**: Option A for sensitive fields + Option B as a defense-in-depth measure. Document that browser-level security (device lock, browser password) is the first line of defense.

**Access Control**:
- Optional passcode or biometric gate on app launch (Web: passcode only; native: biometric via platform API).
- Auto-lock after configurable inactivity period (default: 5 minutes).
- No "remember me" — passcode is required every time the app is opened (if enabled).

**Secure Export**:
- Export produces a JSON file.
- Optional passphrase-based encryption (AES-256-GCM via Web Crypto API).
- Export file includes a checksum for integrity verification on import.
- Clear UI messaging: "This file contains all your health data. Store it securely."

**No-Analytics-by-Default Stance**:
- Phase 1: zero analytics. No Google Analytics, no Mixpanel, no Sentry, no error reporting to any server.
- If analytics are ever introduced (Phase 2+): opt-in only, clearly explained, and anonymized. No personally identifiable health data in analytics.

### Regulatory Context

**HIPAA (US)**:
- HIPAA applies to covered entities (healthcare providers, health plans, clearinghouses) and their business associates. A purely local app with no backend, no account system, and no data transmission is **not a covered entity** and does not handle PHI on behalf of one.
- **If a backend, sync, or caregiver sharing is added**: the app likely becomes a business associate if it processes data on behalf of a covered entity. A Business Associate Agreement (BAA) would be required. Data in transit must be encrypted (TLS). Data at rest must be encrypted. Access controls, audit logging, breach notification procedures, and a security risk assessment become mandatory.
- **If the app handles data independently (consumer health app, no covered entity involvement)**: HIPAA does not directly apply, but FTC Health Breach Notification Rule may apply to non-HIPAA health apps.

**GDPR (EU)**:
- Applies if any EU-resident user's data is processed. Health data is a "special category" under GDPR Article 9, requiring explicit consent.
- For a local-only app: data processing occurs on the user's device, and the app developer is not a data controller/processor in the traditional sense. However, if any data leaves the device (sync, export to cloud, analytics), full GDPR compliance is required: lawful basis (consent), data minimization, right to erasure, data portability, DPO appointment if processing at scale.

**App Store Rules**:
- **Apple App Store**: Apps accessing health data must have a privacy policy, must use HealthKit APIs appropriately, and must not use health data for advertising. "Health" category apps face additional review scrutiny.
- **Google Play Store**: Apps handling health data must comply with Google's Health Data Policy. Sensitive permissions (camera, microphone for voice notes) require justification.
- **Both**: Phase 1 (web/PWA) avoids most app store rules. Phase 2 (native) must comply.

**Phase 1 Summary**: A local-only web app with no server interaction avoids most regulatory burden. The developer should still write a clear privacy policy explaining what data is collected and that it stays on-device. This establishes trust and prepares for Phase 2 compliance.

### Pseudonymization for Future Research

If a shared/aggregated research dataset is ever created (Phase 2+):
- Strip all direct identifiers (name, DOB, contacts).
- Replace user IDs with random pseudonyms.
- Generalize timestamps to date (remove time-of-day).
- Generalize location to region (remove specific locations).
- Require explicit opt-in consent with clear explanation.
- Use differential privacy techniques if the dataset is small.
- An IRB (Institutional Review Board) or ethics committee review is appropriate before any data sharing.

---

## 2.7 Challenges and Mitigations

| # | Challenge | Mitigation |
|---|---|---|
| **1** | **User engagement during low-energy periods**: Post-ictal fatigue, depression, or simply bad days make consistent tracking burdensome. The app risks becoming another source of guilt. | Post-ictal safe mode auto-simplifies the UI. No punitive language anywhere — missed items say "Let's pick back up" not "You failed." Voice notes as a low-effort alternative to typing. Reduce daily checklist to "essentials only" mode (medications + sleep) that the user can toggle. Celebrate consistency without punishing gaps. |
| **2** | **Data accuracy and self-report bias**: Seizures with impaired awareness may not be self-reported. Duration estimates are unreliable. Trigger attribution is subjective and prone to confirmation bias. | Acknowledge this limitation in the app and in clinician reports ("Self-reported data; may undercount seizures with impaired awareness"). Support observer notes. Quick-log with timestamp captures timing even if details are incomplete. Correlation analysis uses statistical language ("associated with" not "caused by"). |
| **3** | **Reminder fatigue**: Too many notifications lead to dismissal and eventually uninstalling. Users with 5+ daily medications plus meals, hydration, and sleep reminders could receive 15+ notifications per day. | Consolidate reminders: group items within the same hour into a single notification ("2:00 PM: Levetiracetam + Water"). User controls reminder frequency, lead time, and can mute non-critical reminders. Adaptive: if the user consistently completes an item without the reminder, offer to disable it. Maximum notification cap: user-defined (default: 8/day). |
| **4** | **Migration from web to native (Phase 1 → Phase 2)**: Web APIs for notifications, background tasks, and storage differ substantially from native platforms. A rewrite is expensive. | Abstract platform-specific APIs behind interfaces from the start (see §2.8). Data model is JSON-serializable and database-agnostic. Business logic (checklist generation, insight computation, schedule management) lives in a pure TypeScript/Dart core with no DOM or platform dependencies. Only the storage adapter, notification scheduler, and UI layer change between platforms. |
| **5** | **Regulatory scope creep**: Adding features (AI forecasting, clinician sharing, telehealth) pushes the app from "personal health tool" into "medical device" or "health IT" territory with FDA/CE and HIPAA/GDPR implications. | Maintain a clear regulatory boundary document. Phase 1 is explicitly a personal tracking tool, not a diagnostic or therapeutic device. Any feature that provides clinical recommendations (beyond simple correlation), connects to healthcare providers, or processes data server-side triggers a regulatory review checkpoint. Use in-app disclaimers: "This app does not provide medical advice." |
| **6** | **Screen safety during implementation**: Developers unfamiliar with photosensitive epilepsy may inadvertently introduce flashing, rapid animations, or high-frequency visual patterns. | Integrate a linting rule or automated test that flags animations faster than 3 Hz, high-contrast alternating frames, and any use of `animation-duration` < 333ms. Add a "seizure safety" section to the component library documentation. Manual review of all visual changes by someone aware of photosensitivity guidelines (WCAG 2.3.1 Three Flashes or Below Threshold). |
| **7** | **Data portability and longevity**: If the app is abandoned, user data must remain accessible. Proprietary formats lock users in. | JSON export is always available. The export schema is versioned and self-documenting. The schema is published and documented so third-party tools or future apps can import it. No proprietary encoding or compression on exports. |

---

## 2.8 Technology Stack

### Phase 1: Web / PWA

| Layer | Recommendation | Rationale |
|---|---|---|
| **Framework** | **React** (with TypeScript) or **SolidJS** | React has the largest ecosystem for accessibility components, PWA tooling, and charting libraries. SolidJS is a lighter alternative with similar DX. Both support strict TypeScript. Avoid Next.js/Remix — no server needed. Use Vite as the build tool. |
| **State management** | **Zustand** or React Context + useReducer | Lightweight, no boilerplate. State is local (no server sync), so complex state libraries (Redux, MobX) are unnecessary. |
| **Local storage** | **Dexie.js** (IndexedDB wrapper) | TypeScript-friendly, supports complex queries, versioned schema migrations built-in, well-maintained. Abstracts raw IndexedDB complexity. |
| **Encryption** | **Web Crypto API** (native) | No external library needed. AES-256-GCM for field-level encryption, PBKDF2 for key derivation. |
| **PWA / Offline** | **Workbox** (via Vite PWA plugin) | Handles service worker generation, precaching, and runtime caching strategies. Offline-first: cache the app shell, serve from cache, update in background. |
| **Notifications** | **Notification API + Service Worker** | Schedule reminders via the service worker. Limitations: web push requires user permission, and scheduled local notifications are not natively supported in all browsers. Workaround: use the `setTimeout` / `setInterval` in the service worker for approximate timing when the app is open, and push notifications via a lightweight notification relay if exact timing is critical (but this introduces a server — flag as optional). |
| **Charting** | **Recharts** (React) or **Chart.js** with accessibility plugins | Both support high-contrast themes, responsive sizing, and aria labels. Recharts integrates naturally with React. Chart.js has broader browser support. Both can render static SVG fallbacks for screen readers. |
| **Accessibility tooling** | **axe-core** (automated testing) + **eslint-plugin-jsx-a11y** (lint rules) | Automated a11y testing in CI/CD. Manual testing with VoiceOver/NVDA/TalkBack required in addition. |
| **CSS / Theming** | **Tailwind CSS** or **CSS Modules** with CSS custom properties for theming | CSS custom properties enable light/dark mode and high-contrast mode via a single theme toggle. `prefers-reduced-motion` and `prefers-color-scheme` media queries. |
| **Voice recording** | **MediaRecorder API** | Browser-native. Records audio as WebM/Opus. Store as a blob in IndexedDB alongside the seizure event. |
| **Testing** | **Vitest** (unit) + **Playwright** (e2e) + **axe-core** (a11y) | Vitest is fast and Vite-native. Playwright covers PWA testing and accessibility auditing. |

### Phase 2: Native (iOS + Android)

| Decision | Recommendation | Rationale |
|---|---|---|
| **Cross-platform framework** | **React Native** (if Phase 1 uses React) or **Flutter** | If Phase 1 is built in React/TypeScript, React Native allows maximum code sharing for business logic. Flutter offers better performance and a more consistent UI across platforms but requires rewriting UI in Dart. **Tradeoff**: React Native = more code sharing, more dependency on native modules for performance. Flutter = less code sharing but better UI consistency and performance. |
| **Local database** | **WatermelonDB** (React Native) or **Drift/sqflite** (Flutter) | Both are SQLite-backed, support offline-first patterns, and handle schema migrations. WatermelonDB has lazy-loading and observable queries optimized for large datasets. |
| **Notification scheduling** | **Notifee** (React Native) or **flutter_local_notifications** | Native local notification scheduling with exact timing, repeating schedules, and notification grouping. No server required. |
| **Health platform integration** | **react-native-health** (HealthKit) + **react-native-google-fit** (Health Connect) | Read sleep data from the platform health store (opt-in). Write seizure events to HealthKit/Health Connect if the user consents. |
| **Biometric auth** | **react-native-biometrics** or **local_auth** (Flutter) | FaceID, TouchID, fingerprint. Falls back to device passcode. |
| **Wearable integration** | Platform-specific SDKs | Apple Watch (WatchOS HealthKit), Wear OS, Empatica SDK. Phase 2+ only. |

### Abstractions That Make Phase 2 Cheap

The following interfaces should be defined in Phase 1 so that only the implementation (not the calling code) changes in Phase 2:

```typescript
// 1. Storage adapter — swap IndexedDB for SQLite
interface StorageAdapter {
  getAll<T>(collection: string): Promise<T[]>;
  getById<T>(collection: string, id: string): Promise<T | null>;
  put<T>(collection: string, item: T): Promise<void>;
  delete(collection: string, id: string): Promise<void>;
  query<T>(collection: string, filter: QueryFilter): Promise<T[]>;
  exportAll(): Promise<ExportEnvelope>;
  importAll(data: ExportEnvelope, mode: 'merge' | 'replace'): Promise<void>;
}

// 2. Notification scheduler — swap web notifications for native
interface NotificationScheduler {
  schedule(notification: ScheduledNotification): Promise<string>;  // returns notification ID
  cancel(id: string): Promise<void>;
  cancelAll(): Promise<void>;
  requestPermission(): Promise<boolean>;
}

// 3. Audio recorder — swap MediaRecorder for native recording
interface AudioRecorder {
  start(): Promise<void>;
  stop(): Promise<AudioBlob>;
  isRecording(): boolean;
}

// 4. Encryption provider — swap Web Crypto for platform crypto
interface EncryptionProvider {
  deriveKey(passphrase: string, salt: Uint8Array): Promise<CryptoKey>;
  encrypt(data: string, key: CryptoKey): Promise<EncryptedPayload>;
  decrypt(payload: EncryptedPayload, key: CryptoKey): Promise<string>;
}

// 5. Share/export — swap Web Share API for native share sheet
interface ShareProvider {
  shareFile(file: ExportFile): Promise<void>;
  shareText(text: string): Promise<void>;
}

// 6. Biometric auth — no-op on web, native implementation on mobile
interface AuthGate {
  isAvailable(): Promise<boolean>;
  authenticate(reason: string): Promise<boolean>;
}
```

**Core business logic** (checklist generation, insight computation, schedule management, data validation) should live in pure TypeScript functions with no DOM, no platform API, and no framework imports. These functions are directly reusable in React Native. For Flutter, they would need to be ported to Dart or called via a JS bridge (less ideal).

---

## 2.9 Future Expansion

| Feature | Phase | Dependencies | Notes |
|---|---|---|---|
| **Telehealth integration** | 3+ | Backend, authentication, video API | Allow the user to share their seizure diary and insights with a neurologist via a secure portal. Requires HIPAA compliance infrastructure. |
| **Caregiver / family features** | 2–3 | Optional backend for sharing, or local peer-to-peer sharing | Caregiver account that receives seizure alerts and can view (read-only) the user's rescue protocol. Must not compromise user autonomy. |
| **Clinician PDF report** | 2 (can be Phase 1 with HTML-to-PDF) | PDF generation library | Structured summary of seizure frequency, medication adherence, sleep, and triggers over a date range. Printable, shareable with neurologist. |
| **Wearable and detection device integration** | 2–3 | Platform SDKs, Bluetooth APIs | Import data from Empatica, Apple Watch, Fitbit. Auto-log detected events. Requires device-specific SDK work. |
| **AI seizure forecasting** | 3+ | Sufficient longitudinal data, on-device ML or privacy-preserving cloud ML | Predict seizure likelihood based on sleep, adherence, stress, cycle data. Must be clearly labeled as experimental, not diagnostic. |
| **Multi-language support** | 2 | i18n framework (react-intl, flutter_localizations) | Prioritize: English, Spanish, French, German, Portuguese, Mandarin. RTL support for Arabic/Hebrew. |
| **Community features** | 3+ | Backend, moderation, anonymization | Opt-in anonymous community for sharing trigger patterns, tips, support. Strict anonymization. Not a substitute for medical advice. |
| **Apple Watch / Wear OS companion** | 3 | Native watch SDK | Quick seizure logging from the wrist. Medication reminders on the watch. Heart rate data import. |
| **EHR/FHIR integration** | 3+ | FHIR R4 API, backend, healthcare system partnership | Export data in FHIR format for import into electronic health records. Requires healthcare IT partnership. |

---

## Build Order Checklist

This is the recommended implementation sequence. Each item builds on the previous ones.

### Phase 0: Foundation (Week 1–2)
- [ ] Initialize project: Vite + React + TypeScript + Tailwind CSS
- [ ] Set up Dexie.js with the full schema (all entities from §2.3)
- [ ] Implement `StorageAdapter` interface with IndexedDB/Dexie backend
- [ ] Implement data export/import (JSON, with schema version)
- [ ] Set up PWA: service worker (Workbox), manifest, offline caching
- [ ] Implement theming: light/dark mode, CSS custom properties, `prefers-reduced-motion`
- [ ] Set up accessibility tooling: axe-core, eslint-plugin-jsx-a11y
- [ ] Establish component library: buttons, cards, inputs, modals — all with WCAG AA targets

### Phase 1a: Core Features (Week 3–5)
- [ ] **Daily Routine Checklist** (Module 5): template CRUD, daily instantiation, checklist UI
- [ ] **Medication Management** (Module 2): medication CRUD, schedule, dose tracking, adherence %
- [ ] **Seizure Logging** (Module 1): quick-log FAB, full event capture, seizure timeline
- [ ] **Unified Today View** (Screen 1): integrate checklist, medication card, seizure count
- [ ] Notification system: `NotificationScheduler` interface, web implementation, reminder logic
- [ ] Passcode gate (optional): PIN entry screen, auto-lock timer

### Phase 1b: Supporting Features (Week 6–8)
- [ ] **Sleep Tracking** (Module 3): sleep diary, wind-down reminders, sleep–seizure chart
- [ ] **Diet & Hydration** (Module 4): meal logging, hydration tracker, trigger food tags
- [ ] **Rescue Protocol** (Module 6): seizure action plan, emergency contacts, SOS button
- [ ] **Post-Ictal Safe Mode** (§2.4): trigger, UI simplification, auto-deactivation
- [ ] **Schedule Editor** (Screen 3): hour-by-hour template editor
- [ ] Voice notes: MediaRecorder integration, blob storage in IndexedDB

### Phase 1c: Insights and Polish (Week 9–11)
- [ ] **Insights Dashboard** (Module 7): seizure frequency chart, adherence heatmap, trigger ranking
- [ ] Correlation analysis engine: sleep vs. seizures, adherence vs. seizures (simple statistics)
- [ ] Plain-language insight generation
- [ ] Clinician report generation (HTML/print-friendly view)
- [ ] Field-level encryption (Web Crypto API) for sensitive data
- [ ] End-to-end accessibility audit: screen reader testing (NVDA, VoiceOver), keyboard navigation
- [ ] Seizure-safe visual audit: no flashing, animation speed checks, color contrast verification
- [ ] Performance optimization: IndexedDB query tuning, lazy loading, bundle size

### Phase 1d: Testing and Launch (Week 12)
- [ ] Unit tests for all business logic (Vitest)
- [ ] E2E tests for critical workflows (Playwright): log seizure, complete checklist, export data
- [ ] Accessibility tests (axe-core in CI)
- [ ] Manual testing with a real user (the first user)
- [ ] Privacy policy page
- [ ] Deploy as PWA (static hosting: Netlify, Vercel, or GitHub Pages — no server)

### Phase 2: Native (Post-Launch)
- [ ] React Native or Flutter project setup
- [ ] Port `StorageAdapter` to WatermelonDB/SQLite
- [ ] Port `NotificationScheduler` to native local notifications
- [ ] Port `AuthGate` to biometric authentication
- [ ] Port UI components to native equivalents
- [ ] HealthKit / Health Connect integration (sleep data import)
- [ ] App Store / Play Store submission (privacy review, health data compliance)
