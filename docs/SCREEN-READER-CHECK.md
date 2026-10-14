# Screen-reader check (B-004)

A hands-on test with a real screen reader. About 30 minutes per reader. Automated checks (axe, the linter) cannot hear what a reader says, so this is the part only a person can do.

**Do it with sample data** (Welcome screen → "Try with sample data"), not the user's real data. Do it on the production site so you test what users get.

## What has already been checked without a reader

Done by Claude on 2026-10-01 in the browser, for 19 screens:

- Every screen has exactly one main heading and a "main" landmark, and no heading levels skipped (one skip was found and fixed).
- Every button, link, field, switch and radio has a name; no image without alt text; no duplicate ids; no positive tab order; the page language is set.
- Pages were all titled just "Steady". Now each page has its own title ("Medications – Steady"), so a reader says where you are when a page opens.
- On a page that loaded for the first time, focus could be lost (it landed on nothing). Now focus moves to the page heading every time.
- axe WCAG 2.2 AA passes on every main screen (the e2e suite).

None of that proves it sounds good. That is what the steps below are for.

## Set up the reader

| Reader | Turn it on | Basic moves |
|---|---|---|
| **VoiceOver, iPhone** | Settings → Accessibility → VoiceOver (or triple-click the side button if set) | Swipe right / left = next / previous item. Double-tap = press. Two-finger swipe down = read all. Rotor (twist two fingers) → Headings, to jump by heading. |
| **TalkBack, Android** | Settings → Accessibility → TalkBack | Swipe right / left = next / previous. Double-tap = press. Swipe up then right = reading controls (choose Headings). |
| **NVDA, Windows** (with Edge or Chrome) | Ctrl + Alt + N | Tab / Shift+Tab = controls. H = next heading. D = next landmark. Down arrow = read next line. Enter or Space = press. Insert + Down arrow = read all. |

Tip: close your eyes (or turn the screen brightness down, or use VoiceOver's screen curtain) for at least the first pass. If you can only do it by looking, it isn't a pass.

## The checks

For each, note **Pass**, **Annoying** (works but confusing or noisy), or **Fail** (can't do it, or says something wrong). Write down what it actually said.

**1. Opening a page.** From the bottom bar, open Medications, then Calendar, then More → Settings.
- Hear the page name when it opens (not just "Steady"), and be on its heading.

**2. Today.**
- Jump by headings. They should read in a sensible order (greeting, routine, medications, water, sleep, and so on).
- Each routine item says what it is, the time, and its state ("Still open", "To do").
- Mark one item done. You hear that it changed (and the "Undo" message). You can undo it.

**3. Log a seizure in two taps.**
- Find the quick-log button on any screen without looking. It has a clear name.
- The sheet that opens: you land inside it, you hear its title, Escape or "Cancel" closes it, and focus goes back to the button you used.
- Save. You hear the confirmation.

**4. Seizure timer.** Start it. Check it can be stopped, and that it doesn't read out every second (it would be unbearable). It should say something useful when you ask.

**5. Rescue and Support.** Open Rescue, then Support.
- The big emergency call button is found quickly and named with the number it will call.
- Each crisis line says its name, hours, and a Call button with the number.

**6. A medication dose.** From Today, "Did I take it?", mark a dose as taken. Then open a medication, change the dose, and hear the new "The dose is now… (it was…)" question (F-011). Choose "A new dose" and a date.

**7. A form.** Open Settings or Add medication.
- Each field says its label, and its hint ("optional", "e.g. 100").
- Leave the dose empty and save. The error is announced and you are told which field.
- Switches say on or off. The yes / no choices ("Period today?", the check-in questions) say which is selected.

**8. Charts have a table.** Insights → find "View as table" under a chart. Turn it on. The table reads row by row with its column names. Do the same for the bowel and bladder card.

**9. The calendar.** Move through a month. Each day says its date and what happened (seizure, missed dose, and so on), not just a symbol.

**10. Locking.** Turn on the passcode lock (use a test passcode), lock, and unlock. The lock screen says what it is, the passcode field is labelled, and a wrong passcode is announced. The Support number is reachable from it.

## Recording what you find

Add each **Fail** or **Annoying** as its own line in `BUGS.md` (the next free ID is at the top) with: reader and device, screen, what you did, what it said, what you expected. Fails on a safety screen (Rescue, the quick seizure log, doses, Support) are **P1**. Others are **P2**.

When all three readers have been tried (or the ones the user actually uses), tick B-004 and note the date and readers.

## Not covered here

- Switch Control, voice control, and magnification.
- Braille displays.
- The browser's own text-size setting beyond the in-app one (the in-app text scale is covered by the e2e suite).
